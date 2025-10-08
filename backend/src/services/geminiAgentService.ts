import { fetch } from 'undici'
import { env } from '../config/env'

export type AgentAction =
  | { type: 'navigate'; path: string }
  | { type: 'selectSensor'; sensorId: string }

export interface AgentContext {
  currentRoute: string
  routes: Array<{ path: string; description: string }>
  sensors: Array<{
    id: string
    name: string
    zone: string
    kind: string
    isActive: boolean
  }>
}

export interface AgentResult {
  reply: string
  actions: AgentAction[]
  raw?: unknown
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

const systemPrompt = `You are Squidward, the proactive assistant for an operations dashboard.
Always respond with strict JSON using this schema:
{
  "reply": string, // short friendly acknowledgement for operators
  "actions": [
    { "type": "navigate", "path": string } |
    { "type": "selectSensor", "sensorId": string }
  ]
}
Rules:
- Only use paths provided in the context.
- Only use sensorId values provided in the context when selecting a sensor.
- If no action is required, return an empty array for actions.
- Keep reply under 60 words.
- Never include Markdown.
- Avoid fabricating data. If you are unsure, say so and avoid actions.`

const buildUserPrompt = (input: string, context: AgentContext) => {
  const routesList = context.routes
    .map((route) => `- ${route.path}: ${route.description}`)
    .join('\n')

  const sensorsList = context.sensors
    .slice(0, 40)
    .map(
      (sensor) =>
        `- ${sensor.name} (id: ${sensor.id}, zone: ${sensor.zone}, kind: ${sensor.kind}, active: ${sensor.isActive ? 'yes' : 'no'})`
    )
    .join('\n')

  return `User request: ${input}\nCurrent route: ${context.currentRoute}\n\nAvailable routes:\n${routesList}\n\nKnown sensors (max 40 shown):\n${sensorsList || 'none registered'}\n\nReturn JSON only.`
}

const extractText = (payload: GeminiResponse): string | undefined => {
  const candidate = payload.candidates?.find((item) => item.content?.parts?.length)
  return candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim()
}

const coerceJson = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch (innerError) {
        console.error('Failed to parse Gemini JSON fragment', innerError)
      }
    }
    console.error('Failed to parse Gemini JSON', error)
    return undefined
  }
}

const normalizeActions = (actions: unknown): AgentAction[] => {
  if (!Array.isArray(actions)) return []
  return actions
    .map((action) => {
      if (!action || typeof action !== 'object') return undefined
      const type = (action as { type?: string }).type
      if (type === 'navigate' && typeof (action as { path?: unknown }).path === 'string') {
        return { type: 'navigate', path: (action as { path: string }).path.trim() }
      }
      if (type === 'selectSensor' && typeof (action as { sensorId?: unknown }).sensorId === 'string') {
        return { type: 'selectSensor', sensorId: (action as { sensorId: string }).sensorId.trim() }
      }
      return undefined
    })
    .filter((item): item is AgentAction => Boolean(item))
}

export const runAgentCommand = async (
  input: string,
  context: AgentContext
): Promise<AgentResult> => {
  if (!env.ai.enabled) {
    throw new Error('Gemini integration is not configured')
  }

  const endpoint = `${env.ai.endpoint}/models/${encodeURIComponent(env.ai.modelId)}:generateContent?key=${encodeURIComponent(env.ai.apiKey)}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: buildUserPrompt(input, context) }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as GeminiResponse
  const text = extractText(data)

  if (!text) {
    return {
      reply: 'Sorry, I was not able to generate a response right now.',
      actions: [],
      raw: data
    }
  }

  const parsed = coerceJson(text)
  if (!parsed || typeof parsed !== 'object') {
    return {
      reply: 'I could not understand the model output. Please try again.',
      actions: [],
      raw: text
    }
  }

  const reply = typeof (parsed as { reply?: unknown }).reply === 'string'
    ? (parsed as { reply: string }).reply
    : 'Action completed.'

  const actions = normalizeActions((parsed as { actions?: unknown }).actions)

  return {
    reply,
    actions,
    raw: parsed
  }
}

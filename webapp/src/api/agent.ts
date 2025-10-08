import { API_BASE_URL } from '../config'
import type { AgentResponse } from '../types'

interface AgentRequestPayload {
  message: string
  currentRoute?: string
}

interface AgentResponsePayload {
  reply: string
  actions: AgentResponse['actions']
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const message = await response.text().catch(() => 'Request failed')
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return (await response.json()) as AgentResponsePayload
}

export const sendAgentCommand = async (
  message: string,
  currentRoute?: string
): Promise<AgentResponse> => {
  const payload: AgentRequestPayload = {
    message,
    currentRoute
  }

  const response = await fetch(`${API_BASE_URL}/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await handleResponse(response)
  return {
    reply: data.reply,
    actions: data.actions ?? []
  }
}

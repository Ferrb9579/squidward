import { API_BASE_URL } from '../config'
import type {
  AutomationComparison,
  AutomationHttpMethod,
  AutomationMetric,
  SensorAutomation,
  SensorState
} from '../types'
import type { SensorDto } from './dashboard'
import { parseSensor } from './dashboard'

type AutomationDto = {
  id: string
  name: string
  description?: string | null
  sourceSensorId: string
  targetSensorId?: string | null
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: number | boolean
  action?: string | null
  targetMethod: AutomationHttpMethod
  targetUrl: string
  payloadTemplate?: Record<string, unknown> | null
  headers?: Record<string, string> | null
  timeoutMs: number
  cooldownSeconds: number
  enabled: boolean
  lastTriggeredAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type ListResponse = {
  sensor: SensorDto
  automations: AutomationDto[]
}

type MutationResponse = {
  automation: AutomationDto
}

type HeadersInput = Record<string, string>

type PayloadTemplateInput = Record<string, unknown>

export interface CreateAutomationPayload {
  name: string
  description?: string
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: number | boolean
  action?: string
  targetMethod?: AutomationHttpMethod
  targetUrl: string
  targetSensorId?: string
  payloadTemplate?: PayloadTemplateInput
  headers?: HeadersInput
  timeoutMs?: number
  cooldownSeconds?: number
  enabled?: boolean
}

export interface UpdateAutomationPayload {
  name?: string
  description?: string | null
  metric?: AutomationMetric
  comparison?: AutomationComparison
  threshold?: number | boolean
  action?: string | null
  targetMethod?: AutomationHttpMethod
  targetUrl?: string
  targetSensorId?: string | null
  payloadTemplate?: PayloadTemplateInput | null
  headers?: HeadersInput | null
  timeoutMs?: number
  cooldownSeconds?: number
  enabled?: boolean
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

const handleJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body && typeof body === 'object' ? (body as { message?: string }).message : undefined))
      .catch(() => undefined)
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

const parseAutomation = (dto: AutomationDto): SensorAutomation => ({
  id: dto.id,
  name: dto.name,
  description: dto.description ?? undefined,
  sourceSensorId: dto.sourceSensorId,
  targetSensorId: dto.targetSensorId ?? undefined,
  metric: dto.metric,
  comparison: dto.comparison,
  threshold: dto.threshold,
  action: dto.action ?? undefined,
  targetMethod: dto.targetMethod,
  targetUrl: dto.targetUrl,
  payloadTemplate: dto.payloadTemplate ?? undefined,
  headers: dto.headers ?? undefined,
  timeoutMs: dto.timeoutMs,
  cooldownSeconds: dto.cooldownSeconds,
  enabled: dto.enabled,
  lastTriggeredAt: dto.lastTriggeredAt ? new Date(dto.lastTriggeredAt) : undefined,
  createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined
})

export const fetchSensorAutomations = async (
  sensorId: string
): Promise<{ sensor: SensorState; automations: SensorAutomation[] }> => {
  const response = await fetch(buildUrl(`/sensors/${sensorId}/automations`))
  const payload = await handleJsonResponse<ListResponse>(response)
  return {
    sensor: parseSensor(payload.sensor),
    automations: payload.automations.map(parseAutomation)
  }
}

export const createSensorAutomation = async (
  sensorId: string,
  payload: CreateAutomationPayload
): Promise<SensorAutomation> => {
  const response = await fetch(buildUrl(`/sensors/${sensorId}/automations`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await handleJsonResponse<MutationResponse>(response)
  return parseAutomation(data.automation)
}

export const updateAutomation = async (
  automationId: string,
  payload: UpdateAutomationPayload
): Promise<SensorAutomation> => {
  const response = await fetch(buildUrl(`/automations/${automationId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await handleJsonResponse<MutationResponse>(response)
  return parseAutomation(data.automation)
}

export const deleteAutomation = async (automationId: string): Promise<void> => {
  const response = await fetch(buildUrl(`/automations/${automationId}`), {
    method: 'DELETE'
  })

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body && typeof body === 'object' ? (body as { message?: string }).message : undefined))
      .catch(() => undefined)
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }
}

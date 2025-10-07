import { API_BASE_URL } from '../config'
import type {
  LeakAlert,
  LeakAlertEvent,
  LeakAlertMetric,
  LeakAlertSeverity
} from '../types'

export type LeakAlertStatusFilter = 'active' | 'resolved' | 'all'

export interface FetchLeakAlertsOptions {
  status?: LeakAlertStatusFilter
  severity?: LeakAlertSeverity
  sensorId?: string
  acknowledged?: boolean
  limit?: number
  skip?: number
}

interface LeakAlertDto {
  id: string
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  metric: LeakAlertMetric
  message: string
  severity: LeakAlertSeverity
  triggeredAt: string
  currentValue?: number | null
  baselineValue?: number | null
  delta?: number | null
  acknowledged: boolean
  acknowledgedAt?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

interface ListLeakAlertsResponse {
  alerts: LeakAlertDto[]
}

interface MutationResponse {
  alert: LeakAlertDto
}

interface LeakAlertEventDto {
  type: 'created' | 'updated' | 'resolved'
  alert: LeakAlertDto
}

const buildUrl = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return (await response.json()) as T
}

const parseDate = (value?: string | null) =>
  value ? new Date(value) : undefined

const toOptionalNumber = (value?: number | null) =>
  value ?? undefined

const parseLeakAlert = (dto: LeakAlertDto): LeakAlert => ({
  id: dto.id,
  sensorId: dto.sensorId,
  sensorName: dto.sensorName,
  zone: dto.zone,
  metric: dto.metric,
  message: dto.message,
  severity: dto.severity,
  triggeredAt: new Date(dto.triggeredAt),
  currentValue: toOptionalNumber(dto.currentValue),
  baselineValue: toOptionalNumber(dto.baselineValue),
  delta: toOptionalNumber(dto.delta),
  acknowledged: dto.acknowledged,
  acknowledgedAt: parseDate(dto.acknowledgedAt),
  resolvedAt: parseDate(dto.resolvedAt),
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt)
})

export const fetchLeakAlerts = async (
  options: FetchLeakAlertsOptions = {}
): Promise<LeakAlert[]> => {
  const url = buildUrl('/alerts', {
    status: options.status,
    severity: options.severity,
    sensorId: options.sensorId,
    acknowledged: options.acknowledged,
    limit: options.limit,
    skip: options.skip
  })

  const response = await fetch(url)
  const payload = await handleResponse<ListLeakAlertsResponse>(response)
  return payload.alerts.map(parseLeakAlert)
}

export const acknowledgeLeakAlert = async (
  alertId: string
): Promise<LeakAlert> => {
  const response = await fetch(buildUrl(`/alerts/${alertId}/acknowledge`), {
    method: 'POST'
  })
  const payload = await handleResponse<MutationResponse>(response)
  return parseLeakAlert(payload.alert)
}

export const resolveLeakAlert = async (
  alertId: string
): Promise<LeakAlert> => {
  const response = await fetch(buildUrl(`/alerts/${alertId}/resolve`), {
    method: 'POST'
  })
  const payload = await handleResponse<MutationResponse>(response)
  return parseLeakAlert(payload.alert)
}

export const parseLeakAlertEvent = (data: string): LeakAlertEvent | null => {
  try {
    const parsed = JSON.parse(data) as LeakAlertEventDto
    return {
      type: parsed.type,
      alert: parseLeakAlert(parsed.alert)
    }
  } catch (error) {
    console.error('Failed to parse leak alert event', error)
    return null
  }
}

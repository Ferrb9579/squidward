import { API_BASE_URL } from '../config'
import type {
  WaterQualityLevel,
  WaterQualityMetricResult,
  WaterQualitySummary
} from '../types'

interface WaterQualityMetricDto {
  metric: WaterQualityMetricResult['metric']
  label: string
  unit?: string
  value?: number
  status: WaterQualityLevel
  message: string
  recommendedRange: string
}

interface WaterQualitySummaryDto {
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  measuredAt?: string | null
  status: WaterQualityLevel
  metrics: WaterQualityMetricDto[]
}

interface ListResponse {
  summaries: WaterQualitySummaryDto[]
}

interface SingleResponse {
  summary: WaterQualitySummaryDto
}

const parseMetric = (dto: WaterQualityMetricDto): WaterQualityMetricResult => ({
  metric: dto.metric,
  label: dto.label,
  unit: dto.unit,
  value: dto.value,
  status: dto.status,
  message: dto.message,
  recommendedRange: dto.recommendedRange
})

const parseSummary = (dto: WaterQualitySummaryDto): WaterQualitySummary => ({
  sensorId: dto.sensorId,
  sensorName: dto.sensorName,
  zone: dto.zone,
  measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : undefined,
  status: dto.status,
  metrics: dto.metrics.map(parseMetric)
})

const buildUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
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

export const fetchWaterQualitySummaries = async (): Promise<WaterQualitySummary[]> => {
  const response = await fetch(buildUrl('/water-quality'))
  const payload = await handleResponse<ListResponse>(response)
  return payload.summaries.map(parseSummary)
}

export const fetchWaterQualityForSensor = async (
  sensorId: string
): Promise<WaterQualitySummary> => {
  const response = await fetch(buildUrl(`/sensors/${sensorId}/water-quality`))
  const payload = await handleResponse<SingleResponse>(response)
  return parseSummary(payload.summary)
}

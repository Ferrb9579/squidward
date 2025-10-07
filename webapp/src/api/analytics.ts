import { API_BASE_URL } from '../config'
import type {
  UsageAnalytics,
  HourlyMetricPoint,
  ZoneFlowSummary,
  ExtremeMeasurement
} from '../types'

interface AnalyticsResponse {
  analytics: AnalyticsDto
}

interface AnalyticsDto {
  windowStart: string
  windowEnd: string
  hourly: HourlyMetricPointDto[]
  zoneFlow: ZoneFlowSummaryDto[]
  topFlowEvents: ExtremeMeasurementDto[]
  pressureExtremes: {
    max?: ExtremeMeasurementDto
    min?: ExtremeMeasurementDto
  }
  lowReservoirs: ExtremeMeasurementDto[]
}

interface HourlyMetricPointDto {
  hour: string
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

interface ZoneFlowSummaryDto {
  zoneId: string
  zoneName: string
  avgFlowLpm: number
  peakFlowLpm: number
  sensorsReporting: number
}

interface ExtremeMeasurementDto {
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  value: number
  timestamp: string
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return (await response.json()) as T
}

const parseHourlyPoint = (dto: HourlyMetricPointDto): HourlyMetricPoint => ({
  hour: new Date(dto.hour),
  avgFlowLpm: dto.avgFlowLpm ?? undefined,
  avgPressureBar: dto.avgPressureBar ?? undefined,
  avgLevelPercent: dto.avgLevelPercent ?? undefined
})

const parseZoneFlow = (dto: ZoneFlowSummaryDto): ZoneFlowSummary => ({
  zoneId: dto.zoneId,
  zoneName: dto.zoneName,
  avgFlowLpm: Number(dto.avgFlowLpm.toFixed(2)),
  peakFlowLpm: Number(dto.peakFlowLpm.toFixed(2)),
  sensorsReporting: dto.sensorsReporting
})

const parseExtreme = (dto: ExtremeMeasurementDto): ExtremeMeasurement => ({
  sensorId: dto.sensorId,
  sensorName: dto.sensorName,
  zone: dto.zone,
  value: dto.value,
  timestamp: new Date(dto.timestamp)
})

const parseAnalytics = (dto: AnalyticsDto): UsageAnalytics => ({
  windowStart: new Date(dto.windowStart),
  windowEnd: new Date(dto.windowEnd),
  hourly: dto.hourly.map(parseHourlyPoint),
  zoneFlow: dto.zoneFlow.map(parseZoneFlow),
  topFlowEvents: dto.topFlowEvents.map(parseExtreme),
  pressureExtremes: {
    max: dto.pressureExtremes.max
      ? parseExtreme(dto.pressureExtremes.max)
      : undefined,
    min: dto.pressureExtremes.min
      ? parseExtreme(dto.pressureExtremes.min)
      : undefined
  },
  lowReservoirs: dto.lowReservoirs.map(parseExtreme)
})

export const fetchUsageAnalytics = async (): Promise<UsageAnalytics> => {
  const response = await fetch(buildUrl('/analytics/usage'))
  const payload = await handleResponse<AnalyticsResponse>(response)
  return parseAnalytics(payload.analytics)
}

import { API_BASE_URL } from '../config'
import type {
  Measurement,
  OverviewMetrics,
  ReadingEventPayload,
  SensorState,
  ZoneSnapshot
} from '../types'

interface SensorsResponse {
  sensors: SensorDto[]
}

export interface SensorDto {
  id: string
  name: string
  kind: string
  zone: { id: string; name: string }
  location: { latitude: number; longitude: number }
  installDepthMeters?: number | null
  description?: string | null
  isActive: boolean
  lastReadingAt?: string | null
  lastValues?: Record<string, number | boolean | null>
  createdAt?: string
  updatedAt?: string
}

interface MeasurementsResponse {
  sensor: SensorDto
  measurements: MeasurementDto[]
}

interface MeasurementDto {
  id: string
  sensorId: string
  timestamp: string
  flowRateLpm?: number | null
  pressureBar?: number | null
  levelPercent?: number | null
  temperatureCelsius?: number | null
  ph?: number | null
  turbidityNTU?: number | null
  conductivityUsCm?: number | null
  batteryPercent?: number | null
  leakDetected?: boolean | null
  healthScore?: number | null
  createdAt?: string
  updatedAt?: string
}

interface ZonesResponse {
  zones: ZoneSnapshotDto[]
}

interface ZoneSnapshotDto {
  zone: { id: string; name: string }
  sensorCount: number
  activeSensors: number
  averageHealthScore: number | null
}

interface OverviewResponse {
  overview: OverviewMetricsDto
}

interface OverviewMetricsDto {
  totalSensors: number
  activeSensors: number
  leakAlertsLastHour: number
  averageHealthScore: number | null
}

const buildUrl = (path: string, params?: Record<string, string | number | undefined>) => {
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

const sanitizeRecord = <T>(record: Record<string, T | null | undefined> | undefined) => {
  if (!record) return undefined
  const sanitizedEntries = Object.entries(record).reduce<
    Record<string, T>
  >((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {})

  return Object.keys(sanitizedEntries).length ? sanitizedEntries : undefined
}

export const parseSensor = (dto: SensorDto): SensorState => ({
  id: dto.id,
  name: dto.name,
  kind: dto.kind as SensorState['kind'],
  zone: dto.zone,
  location: dto.location,
  installDepthMeters: dto.installDepthMeters ?? undefined,
  description: dto.description ?? undefined,
  isActive: dto.isActive,
  lastReadingAt: dto.lastReadingAt ? new Date(dto.lastReadingAt) : undefined,
  lastValues: sanitizeRecord(dto.lastValues),
  createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined
})

const parseMeasurement = (dto: MeasurementDto): Measurement => ({
  id: dto.id,
  sensorId: dto.sensorId,
  timestamp: new Date(dto.timestamp),
  flowRateLpm: dto.flowRateLpm ?? undefined,
  pressureBar: dto.pressureBar ?? undefined,
  levelPercent: dto.levelPercent ?? undefined,
  temperatureCelsius: dto.temperatureCelsius ?? undefined,
  ph: dto.ph ?? undefined,
  turbidityNTU: dto.turbidityNTU ?? undefined,
  conductivityUsCm: dto.conductivityUsCm ?? undefined,
  batteryPercent: dto.batteryPercent ?? undefined,
  leakDetected: dto.leakDetected ?? undefined,
  healthScore: dto.healthScore ?? undefined,
  createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
  updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined
})

const parseZone = (dto: ZoneSnapshotDto): ZoneSnapshot => ({
  zone: dto.zone,
  sensorCount: dto.sensorCount,
  activeSensors: dto.activeSensors,
  averageHealthScore: dto.averageHealthScore
})

const parseOverview = (dto: OverviewMetricsDto): OverviewMetrics => ({
  totalSensors: dto.totalSensors,
  activeSensors: dto.activeSensors,
  leakAlertsLastHour: dto.leakAlertsLastHour,
  averageHealthScore: dto.averageHealthScore
})

export const fetchSensors = async (): Promise<SensorState[]> => {
  const response = await fetch(buildUrl('/sensors'))
  const payload = await handleResponse<SensorsResponse>(response)
  return payload.sensors.map(parseSensor)
}

export const fetchSensorMeasurements = async (
  sensorId: string,
  limit: number
): Promise<{ sensor: SensorState; measurements: Measurement[] }> => {
  const response = await fetch(
    buildUrl(`/sensors/${sensorId}/measurements`, { limit })
  )
  const payload = await handleResponse<MeasurementsResponse>(response)
  return {
    sensor: parseSensor(payload.sensor),
    measurements: payload.measurements.map(parseMeasurement)
  }
}

export const fetchZoneSnapshots = async (): Promise<ZoneSnapshot[]> => {
  const response = await fetch(buildUrl('/zones'))
  const payload = await handleResponse<ZonesResponse>(response)
  return payload.zones.map(parseZone)
}

export const fetchOverviewMetrics = async (): Promise<OverviewMetrics> => {
  const response = await fetch(buildUrl('/overview'))
  const payload = await handleResponse<OverviewResponse>(response)
  return parseOverview(payload.overview)
}

export const parseReadingEvent = (data: string): ReadingEventPayload | null => {
  try {
    const parsed = JSON.parse(data) as {
      sensor: SensorDto
      reading: MeasurementDto
    }
    return {
      sensor: parseSensor(parsed.sensor),
      reading: parseMeasurement(parsed.reading)
    }
  } catch (error) {
    console.error('Failed to parse reading event', error)
    return null
  }
}

export const parseCycleEvent = (data: string): Date | null => {
  try {
    const parsed = JSON.parse(data) as { timestamp?: string }
    return parsed.timestamp ? new Date(parsed.timestamp) : new Date()
  } catch (error) {
    console.error('Failed to parse cycle event', error)
    return null
  }
}

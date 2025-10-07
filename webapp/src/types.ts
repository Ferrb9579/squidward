export type SensorKind = 'flow' | 'pressure' | 'level' | 'composite'

export interface SensorZone {
  id: string
  name: string
}

export interface SensorLocation {
  latitude: number
  longitude: number
}

export interface SensorState {
  id: string
  name: string
  kind: SensorKind
  zone: SensorZone
  location: SensorLocation
  installDepthMeters?: number
  description?: string
  isActive: boolean
  lastReadingAt?: Date
  lastValues?: Record<string, number | boolean>
  createdAt?: Date
  updatedAt?: Date
}

export interface Measurement {
  id: string
  sensorId: string
  timestamp: Date
  flowRateLpm?: number
  pressureBar?: number
  levelPercent?: number
  temperatureCelsius?: number
  batteryPercent?: number
  leakDetected?: boolean
  healthScore?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface ZoneSnapshot {
  zone: SensorZone
  sensorCount: number
  activeSensors: number
  averageHealthScore: number | null
}

export interface OverviewMetrics {
  totalSensors: number
  activeSensors: number
  leakAlertsLastHour: number
  averageHealthScore: number | null
}

export interface ReadingEventPayload {
  sensor: SensorState
  reading: Measurement
}

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'error'

export interface LiveEvent {
  sensor: SensorState
  reading: Measurement
}

export type LeakAlertMetric =
  | 'flowRateLpm'
  | 'pressureBar'
  | 'levelPercent'
  | 'composite'

export type LeakAlertSeverity = 'warning' | 'critical'

export interface LeakAlert {
  id: string
  sensorId: string
  sensorName: string
  zone: SensorZone
  metric: LeakAlertMetric
  message: string
  severity: LeakAlertSeverity
  triggeredAt: Date
  currentValue?: number
  baselineValue?: number
  delta?: number
  acknowledged: boolean
  acknowledgedAt?: Date
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type LeakAlertEventType = 'created' | 'updated' | 'resolved'

export interface LeakAlertEvent {
  type: LeakAlertEventType
  alert: LeakAlert
}

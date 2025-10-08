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
  ph?: number
  turbidityNTU?: number
  conductivityUsCm?: number
  batteryPercent?: number
  leakDetected?: boolean
  healthScore?: number
  createdAt?: Date
  updatedAt?: Date
}

export type WaterQualityLevel = 'missing' | 'safe' | 'warning' | 'contaminated'

export interface WaterQualityMetricResult {
  metric: 'ph' | 'temperatureCelsius' | 'turbidityNTU' | 'conductivityUsCm'
  label: string
  unit?: string
  value?: number
  status: WaterQualityLevel
  message: string
  recommendedRange: string
}

export interface WaterQualitySummary {
  sensorId: string
  sensorName: string
  zone: SensorZone
  measuredAt?: Date
  status: WaterQualityLevel
  metrics: WaterQualityMetricResult[]
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
  | 'offline'

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

export interface HourlyMetricPoint {
  hour: Date
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

export interface ZoneFlowSummary {
  zoneId: string
  zoneName: string
  avgFlowLpm: number
  peakFlowLpm: number
  sensorsReporting: number
}

export interface ExtremeMeasurement {
  sensorId: string
  sensorName: string
  zone: SensorZone
  value: number
  timestamp: Date
}

export interface UsageAnalytics {
  windowStart: Date
  windowEnd: Date
  hourly: HourlyMetricPoint[]
  zoneFlow: ZoneFlowSummary[]
  topFlowEvents: ExtremeMeasurement[]
  pressureExtremes: {
    max?: ExtremeMeasurement
    min?: ExtremeMeasurement
  }
  lowReservoirs: ExtremeMeasurement[]
}

export interface ApiKey {
  id: string
  label: string
  sensorId?: string
  preview: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt?: Date
}

export type AgentAction =
  | { type: 'navigate'; path: string }
  | { type: 'selectSensor'; sensorId: string }

export interface AgentResponse {
  reply: string
  actions: AgentAction[]
}

export type AutomationMetric =
  | 'flowRateLpm'
  | 'pressureBar'
  | 'levelPercent'
  | 'temperatureCelsius'
  | 'ph'
  | 'turbidityNTU'
  | 'conductivityUsCm'
  | 'batteryPercent'
  | 'healthScore'
  | 'leakDetected'

export type AutomationComparison = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq'

export type AutomationHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface SensorAutomation {
  id: string
  name: string
  description?: string
  sourceSensorId: string
  targetSensorId?: string
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: number | boolean
  action?: string
  targetMethod: AutomationHttpMethod
  targetUrl: string
  payloadTemplate?: Record<string, unknown> | null
  headers?: Record<string, string>
  timeoutMs: number
  cooldownSeconds: number
  enabled: boolean
  lastTriggeredAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

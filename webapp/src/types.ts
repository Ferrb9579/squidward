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
  ph?: number
  turbidityDust?: number
  chlorinePpm?: number
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

export interface MetricSummary {
  sampleSize: number
  mean: number
  median: number
  min: number
  max: number
  stdDev: number
  p25: number
  p75: number
}

export interface CorrelationSummary {
  from: string
  to: string
  coefficient: number
  sampleSize: number
}

export interface AnalyticsTimeseriesPoint {
  timestamp: Date
  sampleCount: number
  flowRateLpm?: number
  pressureBar?: number
  levelPercent?: number
  temperatureCelsius?: number
}

export interface ZoneAggregate {
  zoneId: string
  zoneName: string
  sampleCount: number
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

export interface RegressionPrediction {
  sensorId: string
  sensorName: string
  zone: SensorZone
  timestamp: Date
  actual: number
  predicted: number
  residual: number
}

export interface FeatureImportanceEntry {
  feature: string
  weight: number
  importance: number
}

export interface RegressionModelSummary {
  target: string
  features: string[]
  intercept: number
  coefficients: Record<string, number>
  trainingSamples: number
  validationSamples: number
  evaluation: {
    mae: number
    rmse: number
    r2: number
  }
  featureScaling: Record<string, { mean: number; stdDev: number }>
  featureImportance: FeatureImportanceEntry[]
  predictions: RegressionPrediction[]
  outliers: RegressionPrediction[]
  lastUpdated: Date
}

export interface AdvancedAnalytics {
  windowStart: Date
  windowEnd: Date
  sampleCount: number
  eda: {
    metrics: Record<string, MetricSummary>
    correlations: CorrelationSummary[]
    zoneAverages: ZoneAggregate[]
  }
  timeseries: AnalyticsTimeseriesPoint[]
  model?: RegressionModelSummary
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
  | 'batteryPercent'
  | 'healthScore'
  | 'ph'
  | 'turbidityDust'
  | 'chlorinePpm'
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

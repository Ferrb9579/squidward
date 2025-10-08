export type LeakAlertSeverity = 'warning' | 'critical'

export type LeakAlertMetric =
  | 'flowRateLpm'
  | 'pressureBar'
  | 'levelPercent'
  | 'composite'
  | 'offline'

export interface LeakAlertSummary {
  id: string
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  metric: LeakAlertMetric
  message: string
  triggeredAt: Date
  severity: LeakAlertSeverity
  currentValue?: number
  baselineValue?: number
  delta?: number
  acknowledged: boolean
  acknowledgedAt?: Date
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

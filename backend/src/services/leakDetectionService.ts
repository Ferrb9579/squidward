import { EventEmitter } from 'node:events'
import type { FilterQuery } from 'mongoose'
import { MeasurementModel } from '../models/measurement'
import {
  LeakAlertModel,
  LeakAlertDocument,
  LeakAlertSchemaType
} from '../models/leakAlert'
import { simulator } from '../iot/simulator'
import type { SensorReading, SensorState } from '../types/sensor'
import type {
  LeakAlertMetric,
  LeakAlertSeverity,
  LeakAlertSummary
} from '../types/alert'

interface DetectionResult {
  metric: LeakAlertMetric
  severity: LeakAlertSeverity
  message: string
  triggeredAt: Date
  currentValue?: number
  baselineValue?: number
  delta?: number
}

interface BaselineSample {
  baseline?: number
  previous?: number
}

export type AlertEventPayload = {
  type: 'created' | 'updated' | 'resolved'
  alert: LeakAlertDocument
}

const detectionEmitter = new EventEmitter()

export const leakDetectionEvents = detectionEmitter

const cooldownMs = 2 * 60 * 1000
const throttle = new Map<string, { timestamp: number; severity: LeakAlertSeverity }>()

const metricConfig: Record<LeakAlertMetric, { window: number }> = {
  flowRateLpm: { window: 10 },
  pressureBar: { window: 10 },
  levelPercent: { window: 12 },
  composite: { window: 8 },
  offline: { window: 1 }
}

const getMetricValue = (
  reading: SensorReading,
  metric: LeakAlertMetric
): number | undefined => {
  switch (metric) {
    case 'flowRateLpm':
      return reading.flowRateLpm
    case 'pressureBar':
      return reading.pressureBar
    case 'levelPercent':
      return reading.levelPercent
    case 'offline':
      return undefined
    default:
      return undefined
  }
}

const getHistoryBaseline = async (
  sensorId: string,
  metric: LeakAlertMetric,
  window = 8
): Promise<BaselineSample> => {
  if (metric === 'composite') {
    return {}
  }

  const field = metric as keyof SensorReading
  const query: FilterQuery<unknown> = {
    sensorId,
    [field]: { $ne: null }
  }

  const docs = await MeasurementModel.find(query)
    .sort({ timestamp: -1 })
    .limit(window + 1)
    .lean()
    .exec()

  if (docs.length === 0) {
    return {}
  }

  const [latest, ...rest] = docs
  const values = rest
    .map((doc) => (doc as unknown as Record<string, number | null>)[metric])
    .filter((value): value is number => typeof value === 'number')

  if (values.length === 0) {
    return {
      previous:
        (latest as unknown as Record<string, number | null>)[metric] ?? undefined
    }
  }

  const baseline =
    values.reduce((sum, value) => sum + value, 0) / values.length

  const previous = values[0]

  return { baseline, previous }
}

const evaluateFlow = async (
  sensor: SensorState,
  reading: SensorReading,
  now: Date
): Promise<DetectionResult | null> => {
  if (reading.flowRateLpm === undefined) return null

  const { baseline } = await getHistoryBaseline(
    sensor.id,
    'flowRateLpm',
    metricConfig.flowRateLpm.window
  )

  if (!baseline || baseline < 25) {
    return null
  }

  const delta = reading.flowRateLpm - baseline
  const ratio = baseline > 0 ? reading.flowRateLpm / baseline : 0

  if (ratio < 1.35 || delta < 28) {
    return null
  }

  const severity: LeakAlertSeverity = ratio >= 1.75 || delta >= 65 ? 'critical' : 'warning'

  return {
    metric: 'flowRateLpm',
    severity,
    triggeredAt: now,
    currentValue: reading.flowRateLpm,
    baselineValue: baseline,
    delta,
    message: `Flow spiked to ${reading.flowRateLpm.toFixed(0)} L/min (baseline ${baseline.toFixed(0)} L/min)`
  }
}

const evaluatePressure = async (
  sensor: SensorState,
  reading: SensorReading,
  now: Date
): Promise<DetectionResult | null> => {
  if (reading.pressureBar === undefined) return null

  const { baseline } = await getHistoryBaseline(
    sensor.id,
    'pressureBar',
    metricConfig.pressureBar.window
  )

  if (!baseline || baseline < 1) {
    return null
  }

  const delta = reading.pressureBar - baseline
  const ratio = baseline > 0 ? reading.pressureBar / baseline : 0

  if (ratio < 1.2 || delta < 0.45) {
    return null
  }

  const severity: LeakAlertSeverity = ratio >= 1.4 || delta >= 1 ? 'critical' : 'warning'

  return {
    metric: 'pressureBar',
    severity,
    triggeredAt: now,
    currentValue: reading.pressureBar,
    baselineValue: baseline,
    delta,
    message: `Pressure surge detected at ${reading.pressureBar.toFixed(2)} bar (baseline ${baseline.toFixed(2)} bar)`
  }
}

const evaluateLevel = async (
  sensor: SensorState,
  reading: SensorReading,
  now: Date
): Promise<DetectionResult | null> => {
  if (reading.levelPercent === undefined) return null

  const { baseline } = await getHistoryBaseline(
    sensor.id,
    'levelPercent',
    metricConfig.levelPercent.window
  )

  if (!baseline || baseline < 10) {
    return null
  }

  const drop = baseline - reading.levelPercent

  if (drop < Math.max(8, baseline * 0.12)) {
    return null
  }

  const severity: LeakAlertSeverity =
    drop >= Math.max(15, baseline * 0.22) ? 'critical' : 'warning'

  return {
    metric: 'levelPercent',
    severity,
    triggeredAt: now,
    currentValue: reading.levelPercent,
    baselineValue: baseline,
    delta: -drop,
    message: `Reservoir level dropped to ${reading.levelPercent.toFixed(1)}% (baseline ${baseline.toFixed(1)}%)`
  }
}

const evaluateCompositeFlag = (
  sensor: SensorState,
  reading: SensorReading,
  now: Date
): DetectionResult | null => {
  if (!reading.leakDetected) {
    return null
  }

  return {
    metric: 'composite',
    severity: 'critical',
    triggeredAt: now,
    message: `${sensor.name} reported a leak signature based on multi-metric analysis.`
  }
}

const processDetection = async (
  sensor: SensorState,
  result: DetectionResult
): Promise<void> => {
  const key = `${sensor.id}:${result.metric}`
  const existing = await LeakAlertModel.findOne({
    sensorId: sensor.id,
    metric: result.metric,
    resolvedAt: { $exists: false }
  })
    .sort({ triggeredAt: -1 })
    .exec()

  if (existing) {
    let requiresUpdate = false

    if (existing.severity !== result.severity) {
      existing.severity = result.severity
      requiresUpdate = true
    }

    if (result.currentValue !== undefined) {
      existing.currentValue = result.currentValue
      requiresUpdate = true
    }

    if (result.baselineValue !== undefined) {
      existing.baselineValue = result.baselineValue
      requiresUpdate = true
    }

    if (result.delta !== undefined) {
      existing.delta = result.delta
      requiresUpdate = true
    }

    if (existing.message !== result.message) {
      existing.message = result.message
      requiresUpdate = true
    }

    if (requiresUpdate) {
      await existing.save()
      detectionEmitter.emit('alert', { type: 'updated', alert: existing })
    }

    throttle.set(key, { timestamp: Date.now(), severity: result.severity })
    return
  }

  const recent = throttle.get(key)
  if (recent) {
    const withinCooldown = Date.now() - recent.timestamp < cooldownMs
    const severityDowngraded =
      recent.severity === 'critical' && result.severity === 'warning'

    if (withinCooldown && severityDowngraded) {
      return
    }
  }

  const alert = await LeakAlertModel.create({
    sensorId: sensor.id,
    sensorName: sensor.name,
    zone: sensor.zone,
    metric: result.metric,
    message: result.message,
    severity: result.severity,
    triggeredAt: result.triggeredAt,
    currentValue: result.currentValue,
    baselineValue: result.baselineValue,
    delta: result.delta,
    acknowledged: false
  })

  throttle.set(key, { timestamp: Date.now(), severity: result.severity })
  detectionEmitter.emit('alert', { type: 'created', alert })
}

const resolveRecoveredAlerts = async (
  sensor: SensorState,
  reading: SensorReading
) => {
  const activeAlerts = await LeakAlertModel.find({
    sensorId: sensor.id,
    resolvedAt: { $exists: false }
  })
    .sort({ triggeredAt: -1 })
    .exec()

  if (activeAlerts.length === 0) {
    return
  }

  const now = new Date()

  await Promise.all(
    activeAlerts.map(async (alert) => {
      const metric = alert.metric

      if (metric === 'offline') {
        alert.resolvedAt = now
        alert.message = `${sensor.name} is back online as of ${now.toLocaleString()}`
        await alert.save()
        detectionEmitter.emit('alert', { type: 'resolved', alert })
        return
      }

      const currentValue = getMetricValue(reading, metric)

      if (metric === 'composite') {
        if (!reading.leakDetected) {
          alert.resolvedAt = now
          await alert.save()
          detectionEmitter.emit('alert', { type: 'resolved', alert })
        }
        return
      }

      if (typeof currentValue !== 'number') {
        return
      }

      const { baseline } = await getHistoryBaseline(
        sensor.id,
        metric,
        metricConfig[metric].window
      )

      if (!baseline || baseline <= 0) {
        return
      }

      const safeThresholds: Record<LeakAlertMetric, (value: number, base: number) => boolean> = {
        flowRateLpm: (value, base) => value <= base * 1.2,
        pressureBar: (value, base) => value <= base * 1.18,
        levelPercent: (value, base) => value >= base - Math.max(6, base * 0.08),
        composite: () => true,
        offline: () => true
      }

      const isRecovered = safeThresholds[metric](currentValue, baseline)

      if (isRecovered) {
        alert.resolvedAt = now
        alert.currentValue = currentValue
        alert.baselineValue = baseline
        alert.delta = currentValue - baseline
        await alert.save()
        detectionEmitter.emit('alert', { type: 'resolved', alert })
      }
    })
  )
}

const handleReading = async (sensor: SensorState, reading: SensorReading) => {
  const now = reading.timestamp ?? new Date()

  const detections = await Promise.all([
    evaluateFlow(sensor, reading, now),
    evaluatePressure(sensor, reading, now),
    evaluateLevel(sensor, reading, now)
  ])

  const composite = evaluateCompositeFlag(sensor, reading, now)
  if (composite) {
    detections.push(composite)
  }

  const validDetections = detections.filter(
    (item): item is DetectionResult => Boolean(item)
  )

  if (validDetections.length > 0) {
    await Promise.all(validDetections.map((result) => processDetection(sensor, result)))
  } else {
    await resolveRecoveredAlerts(sensor, reading)
  }
}

export const initializeLeakDetection = () => {
  simulator.on('reading', (payload) => {
    void handleReading(payload.sensor, payload.reading).catch((error) => {
      console.error('Leak detection error', error)
    })
  })
}

type AlertLike = LeakAlertDocument | (LeakAlertSchemaType & { _id: unknown })

const toPlainAlert = (alert: AlertLike) => {
  const alertAny = alert as LeakAlertDocument & { _id: unknown }
  const source =
    typeof alertAny.toObject === 'function'
      ? alertAny.toObject({ virtuals: false })
      : (alert as LeakAlertSchemaType & { _id: unknown })

  const rawId = source._id
  const id =
    typeof rawId === 'string'
      ? rawId
      : rawId?.toString?.() ?? String(rawId)

  return {
    id,
    sensorId: source.sensorId,
    sensorName: source.sensorName,
    zone: source.zone,
    metric: source.metric,
    message: source.message,
    severity: source.severity,
    triggeredAt: source.triggeredAt,
    currentValue: source.currentValue ?? undefined,
    baselineValue: source.baselineValue ?? undefined,
    delta: source.delta ?? undefined,
    acknowledged: source.acknowledged,
    acknowledgedAt: source.acknowledgedAt ?? undefined,
    resolvedAt: source.resolvedAt ?? undefined,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  }
}

export const normalizeAlertPayload = (alert: AlertLike): LeakAlertSummary => {
  const doc = toPlainAlert(alert)
  return {
    ...doc
  }
}

export const onAlertEvent = (
  listener: (payload: AlertEventPayload) => void
) => {
  detectionEmitter.on('alert', listener)
}

export const offAlertEvent = (
  listener: (payload: AlertEventPayload) => void
) => {
  detectionEmitter.off('alert', listener)
}

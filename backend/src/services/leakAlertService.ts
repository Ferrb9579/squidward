import type { FilterQuery } from 'mongoose'
import { LeakAlertModel, LeakAlertSchemaType } from '../models/leakAlert'
import { leakDetectionEvents, normalizeAlertPayload } from './leakDetectionService'
import type {
  LeakAlertMetric,
  LeakAlertSeverity,
  LeakAlertSummary
} from '../types/alert'

export interface ListLeakAlertOptions {
  status?: 'active' | 'resolved' | 'all'
  severity?: LeakAlertSeverity
  sensorId?: string
  acknowledged?: boolean
  limit?: number
  skip?: number
}

const buildStatusFilter = (
  status: ListLeakAlertOptions['status']
): FilterQuery<LeakAlertSchemaType> => {
  if (status === 'resolved') {
    return { resolvedAt: { $exists: true } }
  }

  if (status === 'all') {
    return {}
  }

  return { resolvedAt: { $exists: false } }
}

export const listLeakAlerts = async (
  options: ListLeakAlertOptions = {}
): Promise<LeakAlertSummary[]> => {
  const {
    status = 'active',
    severity,
    sensorId,
    acknowledged,
    limit = 50,
    skip = 0
  } = options

  const query: FilterQuery<LeakAlertSchemaType> = {
    ...buildStatusFilter(status)
  }

  if (severity) {
    query.severity = severity
  }

  if (sensorId) {
    query.sensorId = sensorId
  }

  if (acknowledged !== undefined) {
    query.acknowledged = acknowledged
  }

  const docs = await LeakAlertModel.find(query)
    .sort({ triggeredAt: -1 })
    .skip(skip)
    .limit(Math.max(1, Math.min(limit, 200)))
    .exec()

  return docs.map((doc) => normalizeAlertPayload(doc))
}

export const markAlertAcknowledged = async (
  alertId: string
): Promise<LeakAlertSummary | null> => {
  const alert = await LeakAlertModel.findById(alertId).exec()
  if (!alert) {
    return null
  }

  if (!alert.acknowledged) {
    alert.acknowledged = true
    alert.acknowledgedAt = new Date()
    await alert.save()
  }

  return normalizeAlertPayload(alert)
}

export const markAlertResolved = async (
  alertId: string
): Promise<LeakAlertSummary | null> => {
  const alert = await LeakAlertModel.findById(alertId).exec()
  if (!alert) {
    return null
  }

  let shouldSave = false

  if (!alert.resolvedAt) {
    alert.resolvedAt = new Date()
    shouldSave = true
  }

  if (!alert.acknowledged) {
    alert.acknowledged = true
    alert.acknowledgedAt = alert.acknowledgedAt ?? new Date()
    shouldSave = true
  }

  if (shouldSave) {
    await alert.save()
  }

  return normalizeAlertPayload(alert)
}

export interface CreateManualLeakAlertInput {
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  metric: LeakAlertMetric
  severity: LeakAlertSeverity
  message: string
  triggeredAt?: Date
  currentValue?: number
  baselineValue?: number
  delta?: number
}

export const createManualLeakAlert = async (
  input: CreateManualLeakAlertInput
): Promise<LeakAlertSummary> => {
  const alert = await LeakAlertModel.create({
    sensorId: input.sensorId,
    sensorName: input.sensorName,
    zone: input.zone,
    metric: input.metric,
    message: input.message,
    severity: input.severity,
    triggeredAt: input.triggeredAt ?? new Date(),
    currentValue: input.currentValue,
    baselineValue: input.baselineValue,
    delta: input.delta,
    acknowledged: false
  })

  leakDetectionEvents.emit('alert', { type: 'created', alert })

  return normalizeAlertPayload(alert)
}

export const deleteResolvedAlertsBefore = async (before: Date) => {
  const query: FilterQuery<LeakAlertSchemaType> = {
    resolvedAt: { $exists: true, $lte: before }
  }

  await LeakAlertModel.deleteMany(query).exec()
}

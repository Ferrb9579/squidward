import axios, { type AxiosRequestConfig } from 'axios'
import {
  SensorAutomationModel,
  type SensorAutomationDocument
} from '../models/sensorAutomation'
import type { SensorReading, SensorState } from '../types/sensor'

export type AutomationComparison = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq'

export type AutomationMetric = keyof Omit<SensorReading, 'sensorId' | 'timestamp'>

export interface AutomationPayload {
  id: string
  name: string
  description?: string
  sourceSensorId: string
  targetSensorId?: string
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: number | boolean
  action?: string
  targetMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
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

const numericMetrics: AutomationMetric[] = [
  'flowRateLpm',
  'pressureBar',
  'levelPercent',
  'temperatureCelsius',
  'ph',
  'turbidityNTU',
  'conductivityUsCm',
  'batteryPercent',
  'healthScore'
]

const booleanMetrics: AutomationMetric[] = ['leakDetected']

const toAutomationPayload = (doc: SensorAutomationDocument): AutomationPayload => {
  const plain = doc.toObject()

  const headersSource = plain.headers ?? (doc.headers as Map<string, string> | undefined)
  const headers = headersSource
    ? Object.fromEntries(
        headersSource instanceof Map
          ? headersSource.entries()
          : Object.entries(headersSource as Record<string, string>)
      )
    : undefined

  return {
    id: doc.id,
    name: plain.name,
    description: plain.description ?? undefined,
    sourceSensorId: plain.sourceSensorId,
    targetSensorId: plain.targetSensorId ?? undefined,
    metric: plain.metric as AutomationMetric,
    comparison: plain.comparison as AutomationComparison,
    threshold: plain.threshold as number | boolean,
    action: plain.action ?? undefined,
    targetMethod: plain.targetMethod as AutomationPayload['targetMethod'],
    targetUrl: plain.targetUrl,
    payloadTemplate:
      plain.payloadTemplate && typeof plain.payloadTemplate === 'object'
        ? (plain.payloadTemplate as Record<string, unknown>)
        : null,
    headers,
    timeoutMs: plain.timeoutMs ?? 8000,
    cooldownSeconds: plain.cooldownSeconds ?? 30,
    enabled: plain.enabled ?? true,
    lastTriggeredAt: plain.lastTriggeredAt ?? undefined,
    createdAt: plain.createdAt ?? undefined,
    updatedAt: plain.updatedAt ?? undefined
  }
}

const isNumericMetric = (metric: AutomationMetric) => numericMetrics.includes(metric)
const isBooleanMetric = (metric: AutomationMetric) => booleanMetrics.includes(metric)

const ensureThresholdType = (metric: AutomationMetric, value: number | boolean) => {
  if (isNumericMetric(metric) && typeof value !== 'number') {
    throw new Error('Numeric metric requires numeric threshold')
  }
  if (isBooleanMetric(metric) && typeof value !== 'boolean') {
    throw new Error('Boolean metric requires boolean threshold')
  }
}

const compareValues = (
  value: number | boolean,
  threshold: number | boolean,
  comparison: AutomationComparison
) => {
  switch (comparison) {
    case 'lt':
      return typeof value === 'number' && typeof threshold === 'number' && value < threshold
    case 'lte':
      return typeof value === 'number' && typeof threshold === 'number' && value <= threshold
    case 'gt':
      return typeof value === 'number' && typeof threshold === 'number' && value > threshold
    case 'gte':
      return typeof value === 'number' && typeof threshold === 'number' && value >= threshold
    case 'eq':
      return value === threshold
    case 'neq':
      return value !== threshold
    default:
      return false
  }
}

const extractMetricValue = (
  reading: SensorReading,
  sensor: SensorState,
  metric: AutomationMetric
) => {
  const readingValue = reading[metric]
  if (readingValue !== undefined) {
    return readingValue
  }
  const fallback = sensor.lastValues?.[metric]
  return fallback
}

const buildPayload = (
  rule: SensorAutomationDocument,
  sensor: SensorState,
  value: number | boolean,
  reading: SensorReading,
  triggeredAt: Date
) => {
  const basePayload: Record<string, unknown> = {
    action: rule.action ?? 'trigger',
    sourceSensorId: rule.sourceSensorId,
    sourceSensorName: sensor.name,
    targetSensorId: rule.targetSensorId ?? undefined,
    metric: rule.metric,
    comparison: rule.comparison,
    threshold: rule.threshold,
    value,
    readingTimestamp: reading.timestamp?.toISOString?.() ?? new Date().toISOString(),
    triggeredAt: triggeredAt.toISOString(),
  automationId: String(rule.id)
  }

  const template = rule.payloadTemplate
  if (template && typeof template === 'object') {
    Object.assign(basePayload, template)
  }

  return basePayload
}

const sendAutomationRequest = async (
  rule: SensorAutomationDocument,
  payload: Record<string, unknown>
) => {
  const method = rule.targetMethod ?? 'POST'
  const config: AxiosRequestConfig = {
    method,
    url: rule.targetUrl,
    headers: rule.headers
      ? Object.fromEntries((rule.headers as Map<string, string>).entries())
      : undefined,
    timeout: rule.timeoutMs ?? 8000
  }

  if (method === 'GET' || method === 'DELETE') {
    return axios.request({ ...config, params: payload })
  }

  return axios.request({ ...config, data: payload })
}

export interface CreateAutomationInput {
  name: string
  description?: string
  sourceSensorId: string
  targetSensorId?: string
  metric: AutomationMetric
  comparison: AutomationComparison
  threshold: number | boolean
  action?: string
  targetMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  targetUrl: string
  payloadTemplate?: Record<string, unknown>
  headers?: Record<string, string>
  timeoutMs?: number
  cooldownSeconds?: number
  enabled?: boolean
}

export const createAutomation = async (
  input: CreateAutomationInput
): Promise<AutomationPayload> => {
  ensureThresholdType(input.metric, input.threshold)

  const doc = await SensorAutomationModel.create({
    name: input.name,
    description: input.description ?? undefined,
    sourceSensorId: input.sourceSensorId,
    targetSensorId: input.targetSensorId ?? undefined,
    metric: input.metric,
    comparison: input.comparison,
    threshold: input.threshold,
    action: input.action ?? undefined,
    targetMethod: (input.targetMethod ?? 'POST').toUpperCase(),
    targetUrl: input.targetUrl,
    payloadTemplate: input.payloadTemplate ?? undefined,
    headers: input.headers ? new Map(Object.entries(input.headers)) : undefined,
    timeoutMs:
      input.timeoutMs && input.timeoutMs > 0 ? Math.round(input.timeoutMs) : 8000,
    cooldownSeconds:
      input.cooldownSeconds !== undefined && input.cooldownSeconds >= 0
        ? Math.round(input.cooldownSeconds)
        : 30,
    enabled: input.enabled ?? true
  })

  return toAutomationPayload(doc)
}

export interface UpdateAutomationInput {
  name?: string
  description?: string | null
  targetSensorId?: string | null
  metric?: AutomationMetric
  comparison?: AutomationComparison
  threshold?: number | boolean
  action?: string | null
  targetMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  targetUrl?: string
  payloadTemplate?: Record<string, unknown> | null
  headers?: Record<string, string> | null
  timeoutMs?: number
  cooldownSeconds?: number
  enabled?: boolean
}

export const updateAutomation = async (
  automationId: string,
  updates: UpdateAutomationInput
): Promise<AutomationPayload | null> => {
  const doc = await SensorAutomationModel.findById(automationId).exec()
  if (!doc) {
    return null
  }

  if (updates.metric) {
    doc.metric = updates.metric
  }
  if (updates.threshold !== undefined) {
    ensureThresholdType(doc.metric as AutomationMetric, updates.threshold)
    doc.threshold = updates.threshold
  }
  if (updates.comparison) {
    doc.comparison = updates.comparison
  }
  if (updates.name !== undefined) {
    doc.name = updates.name
  }
  if (updates.description !== undefined) {
    doc.description = updates.description ?? undefined
  }
  if (updates.targetSensorId !== undefined) {
    doc.targetSensorId = updates.targetSensorId ?? undefined
  }
  if (updates.action !== undefined) {
    doc.action = updates.action ?? undefined
  }
  if (updates.targetMethod) {
    doc.targetMethod = updates.targetMethod.toUpperCase() as AutomationPayload['targetMethod']
  }
  if (updates.targetUrl) {
    doc.targetUrl = updates.targetUrl
  }
  if (updates.payloadTemplate !== undefined) {
    doc.payloadTemplate = updates.payloadTemplate ?? undefined
  }
  if (updates.headers !== undefined) {
    doc.headers = updates.headers ? new Map(Object.entries(updates.headers)) : undefined
  }
  if (updates.timeoutMs !== undefined) {
    doc.timeoutMs = Math.round(Math.max(updates.timeoutMs, 1))
  }
  if (updates.cooldownSeconds !== undefined) {
    doc.cooldownSeconds = Math.max(0, Math.round(updates.cooldownSeconds))
  }
  if (updates.enabled !== undefined) {
    doc.enabled = updates.enabled
  }

  await doc.save()
  return toAutomationPayload(doc)
}

export const deleteAutomation = async (automationId: string): Promise<boolean> => {
  const result = await SensorAutomationModel.deleteOne({ _id: automationId }).exec()
  return result.deletedCount === 1
}

export const listAutomationsForSensor = async (
  sensorId: string
): Promise<AutomationPayload[]> => {
  const docs = await SensorAutomationModel.find({ sourceSensorId: sensorId }).exec()
  return docs.map(toAutomationPayload)
}

export const listAllAutomations = async (): Promise<AutomationPayload[]> => {
  const docs = await SensorAutomationModel.find({}).exec()
  return docs.map(toAutomationPayload)
}

export const getAutomationById = async (
  automationId: string
): Promise<AutomationPayload | null> => {
  const doc = await SensorAutomationModel.findById(automationId).exec()
  if (!doc) {
    return null
  }
  return toAutomationPayload(doc)
}

const shouldThrottle = (rule: SensorAutomationDocument, now: Date) => {
  if (!rule.cooldownSeconds || rule.cooldownSeconds <= 0) {
    return false
  }
  if (!rule.lastTriggeredAt) {
    return false
  }

  const elapsedSeconds = (now.getTime() - rule.lastTriggeredAt.getTime()) / 1000
  return elapsedSeconds < rule.cooldownSeconds
}

const handleRuleTrigger = async (
  rule: SensorAutomationDocument,
  sensor: SensorState,
  reading: SensorReading,
  value: number | boolean,
  now: Date
) => {
  const payload = buildPayload(rule, sensor, value, reading, now)

  try {
  await sendAutomationRequest(rule, payload)
  rule.lastTriggeredAt = now
  await rule.save()
  } catch (error) {
    console.error('Automation request failed', {
      ruleId: String(rule._id),
      error
    })
  }
}

export const evaluateAutomationsForReading = async (
  sensor: SensorState,
  reading: SensorReading
) => {
  try {
    const rules = await SensorAutomationModel.find({
      sourceSensorId: sensor.id,
      enabled: true
    }).exec()

    if (!rules.length) {
      return
    }

    const now = new Date()
    await Promise.all(
      rules.map(async (rule) => {
        if (shouldThrottle(rule, now)) {
          return
        }

        const value = extractMetricValue(reading, sensor, rule.metric as AutomationMetric)
        if (value === undefined) {
          return
        }

        const matches = compareValues(
          value as number | boolean,
          rule.threshold as number | boolean,
          rule.comparison as AutomationComparison
        )

        if (!matches) {
          return
        }

        await handleRuleTrigger(rule, sensor, reading, value as number | boolean, now)
      })
    )
  } catch (error) {
    console.error('Failed to evaluate automations for reading', {
      sensorId: sensor.id,
      error
    })
  }
}

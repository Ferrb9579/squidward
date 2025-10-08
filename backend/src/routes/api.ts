import type { Request, Response } from 'express'
import { Router } from 'express'
import { establishSseConnection } from '../realtime/sse'
import {
  getAllSensors,
  getSensorById,
  getRecentMeasurementsForSensor,
  getZoneSnapshots,
  getOverviewMetrics,
  createSensor
} from '../services/sensorService'
import {
  createAutomation,
  deleteAutomation,
  getAutomationById,
  listAutomationsForSensor,
  updateAutomation
} from '../services/sensorAutomationService'
import type {
  AutomationComparison,
  AutomationMetric,
  UpdateAutomationInput
} from '../services/sensorAutomationService'
import {
  listLeakAlerts,
  markAlertAcknowledged,
  markAlertResolved
} from '../services/leakAlertService'
import { getUsageAnalytics } from '../services/analyticsService'
import {
  createApiKey,
  deleteApiKey,
  listApiKeys
} from '../services/apiKeyService'
import { env } from '../config/env'
import { runAgentCommand } from '../services/geminiAgentService'
import {
  getWaterQualitySummaryForSensor,
  listWaterQualitySummaries
} from '../services/waterQualityService'

const api = Router()

const agentRoutes = [
  { path: '/', description: 'Operations dashboard overview with analytics and alerts' },
  { path: '/sensors/new', description: 'Create a new IoT sensor with map placement' },
  { path: '/api-keys', description: 'Manage ingestion API keys' }
] as const

type AsyncHandler = (req: Request, res: Response) => Promise<void>

const asyncHandler = (handler: AsyncHandler) => {
  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    handler(req, res).catch(next)
  }
}

const automationMetrics: AutomationMetric[] = [
  'flowRateLpm',
  'pressureBar',
  'levelPercent',
  'temperatureCelsius',
  'ph',
  'turbidityNTU',
  'conductivityUsCm',
  'batteryPercent',
  'healthScore',
  'leakDetected'
]

const automationComparisons: AutomationComparison[] = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq']
const automationMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
type AutomationHttpMethod = (typeof automationMethods)[number]

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const parseAutomationThreshold = (
  metric: AutomationMetric,
  raw: unknown
): number | boolean | null => {
  if (metric === 'leakDetected') {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    return null
  }

  const asNumber = Number(raw)
  if (Number.isFinite(asNumber)) {
    return asNumber
  }
  return null
}

const coerceHeaders = (raw: unknown): Record<string, string> | undefined => {
  if (!isPlainObject(raw)) {
    return undefined
  }

  const entries = Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value
    }
    return acc
  }, {})

  return Object.keys(entries).length ? entries : undefined
}

const coercePayloadTemplate = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isPlainObject(raw)) {
    return undefined
  }
  return raw
}

api.get(
  '/stream',
  (req, res) => {
    establishSseConnection(req, res)
  }
)

api.get(
  '/sensors',
  asyncHandler(async (_req, res) => {
    const sensors = await getAllSensors()
    res.json({ sensors })
  })
)

api.post(
  '/sensors',
  asyncHandler(async (req, res) => {
    const { id, name, kind, zone, location, installDepthMeters, description, isActive } = req.body ?? {}
    if (
      !name ||
      !kind ||
      !zone?.id ||
      !zone?.name ||
      typeof location?.latitude !== 'number' ||
      typeof location?.longitude !== 'number'
    ) {
      res.status(400).json({ message: 'Invalid sensor payload' })
      return
    }

    try {
      const sensor = await createSensor({
        id: typeof id === 'string' && id.trim() ? id : undefined,
        name,
        kind,
        zone: { id: zone.id, name: zone.name },
        location: {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude)
        },
        installDepthMeters:
          installDepthMeters !== undefined ? Number(installDepthMeters) : undefined,
        description: description ?? undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined
      })

      res.status(201).json({ sensor })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({ message: error.message })
          return
        }
        if (error.message.includes('required')) {
          res.status(400).json({ message: error.message })
          return
        }
      }
      throw error
    }
  })
)

api.get(
  '/sensors/:sensorId',
  asyncHandler(async (req, res) => {
    const sensor = await getSensorById(req.params.sensorId)
    if (!sensor) {
      res.status(404).json({ message: 'Sensor not found' })
      return
    }

    res.json({ sensor })
  })
)

api.get(
  '/sensors/:sensorId/measurements',
  asyncHandler(async (req, res) => {
    const sensor = await getSensorById(req.params.sensorId)
    if (!sensor) {
      res.status(404).json({ message: 'Sensor not found' })
      return
    }

    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50)
    )

    const sinceParam = req.query.since
    let since: Date | undefined
    if (sinceParam) {
      const parsed = new Date(String(sinceParam))
      if (!Number.isNaN(parsed.valueOf())) {
        since = parsed
      }
    }

    const measurements = await getRecentMeasurementsForSensor(sensor.id, {
      limit,
      since
    })

    res.json({ sensor, measurements })
  })
)

api.get(
  '/sensors/:sensorId/automations',
  asyncHandler(async (req, res) => {
    const sensor = await getSensorById(req.params.sensorId)
    if (!sensor) {
      res.status(404).json({ message: 'Sensor not found' })
      return
    }

    const automations = await listAutomationsForSensor(sensor.id)
    res.json({ sensor, automations })
  })
)

api.post(
  '/sensors/:sensorId/automations',
  asyncHandler(async (req, res) => {
    const sensor = await getSensorById(req.params.sensorId)
    if (!sensor) {
      res.status(404).json({ message: 'Sensor not found' })
      return
    }

    const {
      name,
      description,
      metric,
      comparison,
      threshold,
      action,
      targetUrl,
      targetMethod,
      targetSensorId,
      payloadTemplate,
      headers,
      timeoutMs,
      cooldownSeconds,
      enabled
    } = req.body ?? {}

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Automation name is required' })
      return
    }

    if (typeof targetUrl !== 'string' || !targetUrl.trim()) {
      res.status(400).json({ message: 'Target URL is required' })
      return
    }

    const metricValue = String(metric ?? '').trim() as AutomationMetric
    if (!automationMetrics.includes(metricValue)) {
      res.status(400).json({ message: 'Unsupported metric for automation' })
      return
    }

    const comparisonValue = String(comparison ?? '').trim() as AutomationComparison
    if (!automationComparisons.includes(comparisonValue)) {
      res.status(400).json({ message: 'Unsupported comparison operator' })
      return
    }

    const parsedThreshold = parseAutomationThreshold(metricValue, threshold)
    if (parsedThreshold === null) {
      res.status(400).json({ message: 'Invalid threshold for metric' })
      return
    }

    const parsedMethod = String(targetMethod ?? 'POST').toUpperCase() as AutomationHttpMethod
    if (!automationMethods.includes(parsedMethod)) {
      res.status(400).json({ message: 'Unsupported HTTP method' })
      return
    }

    const parsedHeaders = coerceHeaders(headers)
    const parsedPayloadTemplate = coercePayloadTemplate(payloadTemplate)

    try {
      const automation = await createAutomation({
        name: name.trim(),
        description:
          typeof description === 'string' && description.trim() ? description.trim() : undefined,
        sourceSensorId: sensor.id,
        targetSensorId:
          typeof targetSensorId === 'string' && targetSensorId.trim()
            ? targetSensorId.trim()
            : undefined,
        metric: metricValue,
        comparison: comparisonValue,
        threshold: parsedThreshold,
        action: typeof action === 'string' && action.trim() ? action.trim() : undefined,
  targetMethod: parsedMethod,
        targetUrl: targetUrl.trim(),
        payloadTemplate: parsedPayloadTemplate,
        headers: parsedHeaders,
        timeoutMs:
          Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
            ? Number(timeoutMs)
            : undefined,
        cooldownSeconds:
          Number.isFinite(Number(cooldownSeconds)) && Number(cooldownSeconds) >= 0
            ? Number(cooldownSeconds)
            : undefined,
        enabled:
          typeof enabled === 'boolean'
            ? enabled
            : typeof enabled === 'string'
              ? enabled.trim().toLowerCase() === 'true'
              : undefined
      })

      res.status(201).json({ automation })
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message })
        return
      }
      throw error
    }
  })
)

api.patch(
  '/automations/:automationId',
  asyncHandler(async (req, res) => {
    const automationId = req.params.automationId
    const updates = req.body ?? {}

    const updatePayload: UpdateAutomationInput = {}

    let existingAutomationMetric: AutomationMetric | undefined
    if (updates.threshold !== undefined && updates.metric === undefined) {
      const existing = await getAutomationById(automationId)
      if (!existing) {
        res.status(404).json({ message: 'Automation not found' })
        return
      }
      existingAutomationMetric = existing.metric
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        res.status(400).json({ message: 'Automation name must be a non-empty string' })
        return
      }
      updatePayload.name = updates.name.trim()
    }

    if (updates.description !== undefined) {
      if (updates.description === null) {
        updatePayload.description = null
      } else if (typeof updates.description === 'string') {
        updatePayload.description = updates.description.trim() || null
      } else {
        res.status(400).json({ message: 'Description must be a string or null' })
        return
      }
    }

    if (updates.metric !== undefined) {
      const metricValue = String(updates.metric ?? '').trim() as AutomationMetric
      if (!automationMetrics.includes(metricValue)) {
        res.status(400).json({ message: 'Unsupported metric for automation' })
        return
      }
  updatePayload.metric = metricValue
  existingAutomationMetric = metricValue
    }

    if (updates.comparison !== undefined) {
      const comparisonValue = String(updates.comparison ?? '').trim() as AutomationComparison
      if (!automationComparisons.includes(comparisonValue)) {
        res.status(400).json({ message: 'Unsupported comparison operator' })
        return
      }
      updatePayload.comparison = comparisonValue
    }

    if (updates.threshold !== undefined) {
      const metricForThreshold = existingAutomationMetric ?? updatePayload.metric
      if (!metricForThreshold) {
        res.status(400).json({ message: 'Metric must be known to parse threshold' })
        return
      }
      const parsedThreshold = parseAutomationThreshold(metricForThreshold, updates.threshold)
      if (parsedThreshold === null) {
        res.status(400).json({ message: 'Invalid threshold for metric' })
        return
      }
      updatePayload.threshold = parsedThreshold
    }

    if (updates.action !== undefined) {
      if (updates.action === null) {
        updatePayload.action = null
      } else if (typeof updates.action === 'string') {
        updatePayload.action = updates.action.trim() || null
      } else {
        res.status(400).json({ message: 'Action must be a string or null' })
        return
      }
    }

    if (updates.targetMethod !== undefined) {
      const parsedMethod = String(updates.targetMethod ?? '').toUpperCase() as AutomationHttpMethod
      if (!automationMethods.includes(parsedMethod)) {
        res.status(400).json({ message: 'Unsupported HTTP method' })
        return
      }
      updatePayload.targetMethod = parsedMethod
    }

    if (updates.targetUrl !== undefined) {
      if (typeof updates.targetUrl !== 'string' || !updates.targetUrl.trim()) {
        res.status(400).json({ message: 'Target URL must be a non-empty string' })
        return
      }
      updatePayload.targetUrl = updates.targetUrl.trim()
    }

    if (updates.targetSensorId !== undefined) {
      if (updates.targetSensorId === null) {
        updatePayload.targetSensorId = null
      } else if (typeof updates.targetSensorId === 'string') {
        updatePayload.targetSensorId = updates.targetSensorId.trim() || null
      } else {
        res.status(400).json({ message: 'targetSensorId must be a string or null' })
        return
      }
    }

    if (updates.payloadTemplate !== undefined) {
      if (updates.payloadTemplate === null) {
        updatePayload.payloadTemplate = null
      } else if (isPlainObject(updates.payloadTemplate)) {
        updatePayload.payloadTemplate = updates.payloadTemplate
      } else {
        res.status(400).json({ message: 'payloadTemplate must be an object or null' })
        return
      }
    }

    if (updates.headers !== undefined) {
      if (updates.headers === null) {
        updatePayload.headers = null
      } else {
        const parsedHeaders = coerceHeaders(updates.headers)
        updatePayload.headers = parsedHeaders ?? null
      }
    }

    if (updates.timeoutMs !== undefined) {
      const parsedTimeout = Number(updates.timeoutMs)
      if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
        res.status(400).json({ message: 'timeoutMs must be a positive number' })
        return
      }
      updatePayload.timeoutMs = parsedTimeout
    }

    if (updates.cooldownSeconds !== undefined) {
      const parsedCooldown = Number(updates.cooldownSeconds)
      if (!Number.isFinite(parsedCooldown) || parsedCooldown < 0) {
        res.status(400).json({ message: 'cooldownSeconds must be zero or a positive number' })
        return
      }
      updatePayload.cooldownSeconds = parsedCooldown
    }

    if (updates.enabled !== undefined) {
      if (typeof updates.enabled === 'boolean') {
        updatePayload.enabled = updates.enabled
      } else if (typeof updates.enabled === 'string') {
        updatePayload.enabled = updates.enabled.trim().toLowerCase() === 'true'
      } else {
        res.status(400).json({ message: 'enabled must be a boolean' })
        return
      }
    }

    const automation = await updateAutomation(automationId, updatePayload as any)
    if (!automation) {
      res.status(404).json({ message: 'Automation not found' })
      return
    }

    res.json({ automation })
  })
)

api.delete(
  '/automations/:automationId',
  asyncHandler(async (req, res) => {
    const deleted = await deleteAutomation(req.params.automationId)
    if (!deleted) {
      res.status(404).json({ message: 'Automation not found' })
      return
    }

    res.status(204).send()
  })
)

api.get(
  '/zones',
  asyncHandler(async (_req, res) => {
    const zones = await getZoneSnapshots()
    res.json({ zones })
  })
)

api.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const overview = await getOverviewMetrics()
    res.json({ overview })
  })
)

api.get(
  '/analytics/usage',
  asyncHandler(async (_req, res) => {
    const analytics = await getUsageAnalytics()
    res.json({ analytics })
  })
)

api.get(
  '/water-quality',
  asyncHandler(async (req, res) => {
    const sensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : undefined

    if (sensorId) {
      const summary = await getWaterQualitySummaryForSensor(sensorId)
      if (!summary) {
        res.status(404).json({ message: 'Sensor not found' })
        return
      }
      res.json({ summary })
      return
    }

    const summaries = await listWaterQualitySummaries()
    res.json({ summaries })
  })
)

api.get(
  '/sensors/:sensorId/water-quality',
  asyncHandler(async (req, res) => {
    const summary = await getWaterQualitySummaryForSensor(req.params.sensorId)
    if (!summary) {
      res.status(404).json({ message: 'Sensor not found' })
      return
    }

    res.json({ summary })
  })
)

api.get(
  '/api-keys',
  asyncHandler(async (_req, res) => {
    const apiKeys = await listApiKeys()
    res.json({ apiKeys })
  })
)

api.post(
  '/api-keys',
  asyncHandler(async (req, res) => {
    const { label, sensorId, createdBy } = req.body ?? {}
    if (!label || typeof label !== 'string') {
      res.status(400).json({ message: 'API key label is required' })
      return
    }

    const { key, apiKey } = await createApiKey({
      label: label.trim(),
      sensorId: typeof sensorId === 'string' && sensorId.trim() ? sensorId : undefined,
      createdBy: typeof createdBy === 'string' ? createdBy : undefined
    })

    res.status(201).json({ apiKey, key })
  })
)

api.delete(
  '/api-keys/:apiKeyId',
  asyncHandler(async (req, res) => {
    await deleteApiKey(req.params.apiKeyId)
    res.status(204).send()
  })
)

api.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const { status, severity, sensorId, acknowledged, limit, skip } = req.query

    const parsedStatus =
      status === 'resolved' || status === 'all' || status === 'active'
        ? status
        : undefined

    const parsedSeverity =
      severity === 'warning' || severity === 'critical' ? severity : undefined

    const parsedAcknowledged =
      acknowledged === undefined
        ? undefined
        : acknowledged === 'true'
          ? true
          : acknowledged === 'false'
            ? false
            : undefined

    const parsedLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.min(Number(limit), 200))
      : undefined

    const parsedSkip = Number.isFinite(Number(skip))
      ? Math.max(0, Number(skip))
      : undefined

    const alerts = await listLeakAlerts({
      status: parsedStatus,
      severity: parsedSeverity,
      sensorId: sensorId ? String(sensorId) : undefined,
      acknowledged: parsedAcknowledged,
      limit: parsedLimit,
      skip: parsedSkip
    })

    res.json({ alerts })
  })
)

api.post(
  '/alerts/:alertId/acknowledge',
  asyncHandler(async (req, res) => {
    const alert = await markAlertAcknowledged(req.params.alertId)
    if (!alert) {
      res.status(404).json({ message: 'Alert not found' })
      return
    }

    res.json({ alert })
  })
)

api.post(
  '/alerts/:alertId/resolve',
  asyncHandler(async (req, res) => {
    const alert = await markAlertResolved(req.params.alertId)
    if (!alert) {
      res.status(404).json({ message: 'Alert not found' })
      return
    }

    res.json({ alert })
  })
)

api.post(
  '/agent',
  asyncHandler(async (req, res) => {
    if (!env.ai.enabled) {
      res.status(503).json({ message: 'AI assistant is not configured' })
      return
    }

    const { message, currentRoute } = req.body ?? {}

    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ message: 'Agent message is required' })
      return
    }

    const sensors = await getAllSensors()

    const context = {
      currentRoute:
        typeof currentRoute === 'string' && currentRoute.trim()
          ? currentRoute
          : '/',
      routes: agentRoutes.map((route) => ({ ...route })),
      sensors: sensors.slice(0, 60).map((sensor) => ({
        id: sensor.id,
        name: sensor.name,
        zone: sensor.zone.name,
        kind: sensor.kind,
        isActive: sensor.isActive
      }))
    }

    const result = await runAgentCommand(message.trim(), context)
    res.json({ reply: result.reply, actions: result.actions })
  })
)

export default api

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

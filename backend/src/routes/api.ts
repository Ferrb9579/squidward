import type { Request, Response } from 'express'
import { Router } from 'express'
import { establishSseConnection } from '../realtime/sse'
import {
  getAllSensors,
  getSensorById,
  getRecentMeasurementsForSensor,
  getZoneSnapshots,
  getOverviewMetrics
} from '../services/sensorService'
import {
  listLeakAlerts,
  markAlertAcknowledged,
  markAlertResolved
} from '../services/leakAlertService'
import { getUsageAnalytics } from '../services/analyticsService'

const api = Router()

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

export default api

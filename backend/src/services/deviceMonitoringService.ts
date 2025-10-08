import { env } from '../config/env'
import { LeakAlertModel } from '../models/leakAlert'
import { SensorModel } from '../models/sensor'
import { getAllSensors } from './sensorService'
import { leakDetectionEvents } from './leakDetectionService'

let monitorTimer: NodeJS.Timeout | null = null
let isChecking = false

const ensureThresholdMs = () => Math.max(env.alerts.offlineThresholdMinutes, 0) * 60 * 1000

const createOfflineAlert = async (
  sensor: Awaited<ReturnType<typeof getAllSensors>>[number],
  now: Date
) => {
  const existing = await LeakAlertModel.findOne({
    sensorId: sensor.id,
    metric: 'offline',
    resolvedAt: { $exists: false }
  }).exec()

  if (existing) {
    return
  }

  const lastSeen = sensor.lastReadingAt
  const message = lastSeen
    ? `${sensor.name} has not reported data since ${lastSeen.toLocaleString()}.`
    : `${sensor.name} has never reported a reading.`

  const alert = await LeakAlertModel.create({
    sensorId: sensor.id,
    sensorName: sensor.name,
    zone: sensor.zone,
    metric: 'offline',
    message,
    severity: 'critical',
    triggeredAt: lastSeen ?? now,
    acknowledged: false
  })

  await SensorModel.updateOne(
    { _id: sensor.id },
    { $set: { isActive: false } }
  ).exec()

  leakDetectionEvents.emit('alert', { type: 'created', alert })
}

const checkForOfflineSensors = async () => {
  if (isChecking) return
  if (ensureThresholdMs() <= 0) return

  isChecking = true
  try {
    const sensors = await getAllSensors()
    if (!sensors.length) {
      return
    }

    const now = new Date()
    const cutoff = new Date(now.getTime() - ensureThresholdMs())

    await Promise.all(
      sensors.map(async (sensor) => {
        const reference = sensor.lastReadingAt ?? sensor.updatedAt ?? sensor.createdAt
        if (!reference || reference >= cutoff) {
          return
        }

        await createOfflineAlert(sensor, now)
      })
    )
  } catch (error) {
    console.error('Offline sensor monitor failed', error)
  } finally {
    isChecking = false
  }
}

export const startDeviceMonitoring = () => {
  if (monitorTimer) return
  if (ensureThresholdMs() <= 0) return

  const interval = Math.max(env.alerts.offlineCheckIntervalMs, 15000)
  monitorTimer = setInterval(() => {
    void checkForOfflineSensors()
  }, interval)

  void checkForOfflineSensors()
}

export const stopDeviceMonitoring = () => {
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
}

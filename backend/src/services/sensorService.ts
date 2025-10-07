import { FilterQuery } from 'mongoose'
import { MeasurementModel, MeasurementDocument } from '../models/measurement'
import {
  SensorModel,
  SensorSchemaType
} from '../models/sensor'
import type { SensorState } from '../types/sensor'

type SensorLean = SensorSchemaType & {
  createdAt?: Date
  updatedAt?: Date
}

const sanitizeLastValues = (
  values: SensorSchemaType['lastValues']
): SensorState['lastValues'] => {
  if (!values) {
    return undefined
  }

  const sanitizedEntries = Object.entries(values).reduce<
    Record<string, number | boolean>
  >((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value as number | boolean
    }
    return acc
  }, {})

  return Object.keys(sanitizedEntries).length
    ? (sanitizedEntries as SensorState['lastValues'])
    : undefined
}

const mapSensorDocToState = (doc: SensorLean): SensorState => ({
  id: doc._id,
  name: doc.name,
  kind: doc.kind,
  zone: doc.zone,
  location: doc.location,
  installDepthMeters: doc.installDepthMeters ?? undefined,
  description: doc.description ?? undefined,
  isActive: doc.isActive,
  lastReadingAt: doc.lastReadingAt ?? undefined,
  lastValues: sanitizeLastValues(doc.lastValues),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
})

export const getAllSensors = async (filter: FilterQuery<SensorSchemaType> = {}) => {
  const docs = await SensorModel.find(filter).sort({ name: 1 }).lean().exec()
  return docs.map(mapSensorDocToState)
}

export const getSensorById = async (sensorId: string) => {
  const doc = await SensorModel.findById(sensorId).lean().exec()
  return doc ? mapSensorDocToState(doc) : null
}

export interface MeasurementQueryOptions {
  limit?: number
  since?: Date
}

export const getRecentMeasurementsForSensor = async (
  sensorId: string,
  options: MeasurementQueryOptions = {}
) => {
  const { limit = 50, since } = options

  const query: FilterQuery<MeasurementDocument> = { sensorId }
  if (since) {
    query.timestamp = { $gte: since }
  }

  const docs = await MeasurementModel.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
    .exec()

  return docs.map((doc) => ({
    id: doc._id,
    sensorId: doc.sensorId,
    timestamp: doc.timestamp,
    flowRateLpm: doc.flowRateLpm ?? undefined,
    pressureBar: doc.pressureBar ?? undefined,
    levelPercent: doc.levelPercent ?? undefined,
    temperatureCelsius: doc.temperatureCelsius ?? undefined,
    batteryPercent: doc.batteryPercent ?? undefined,
    leakDetected: doc.leakDetected ?? undefined,
    healthScore: doc.healthScore ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }))
}

export interface ZoneSnapshot {
  zone: SensorState['zone']
  sensorCount: number
  activeSensors: number
  averageHealthScore: number | null
}

export const getZoneSnapshots = async (): Promise<ZoneSnapshot[]> => {
  const sensors = await SensorModel.find({}).lean().exec()
  const grouped = new Map<
    string,
    {
      zone: SensorState['zone']
      sensorCount: number
      activeSensors: number
      healthSum: number
      healthCount: number
    }
  >()

  sensors.forEach((sensor) => {
    const key = sensor.zone.id
    const health = sensor.lastValues?.healthScore
    const accumulator = grouped.get(key) ?? {
      zone: sensor.zone,
      sensorCount: 0,
      activeSensors: 0,
      healthSum: 0,
      healthCount: 0
    }

    accumulator.sensorCount += 1
    if (sensor.isActive) {
      accumulator.activeSensors += 1
    }
    if (typeof health === 'number') {
      accumulator.healthSum += health
      accumulator.healthCount += 1
    }

    grouped.set(key, accumulator)
  })

  return Array.from(grouped.values()).map((entry) => ({
    zone: entry.zone,
    sensorCount: entry.sensorCount,
    activeSensors: entry.activeSensors,
    averageHealthScore: entry.healthCount
      ? Number((entry.healthSum / entry.healthCount).toFixed(1))
      : null
  }))
}

export interface OverviewMetrics {
  totalSensors: number
  activeSensors: number
  leakAlertsLastHour: number
  averageHealthScore: number | null
}

export const getOverviewMetrics = async (): Promise<OverviewMetrics> => {
  const [sensorDocs, leakCount] = await Promise.all([
    SensorModel.find({}).lean().exec(),
    MeasurementModel.countDocuments({
      leakDetected: true,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    })
  ])

  const totalSensors = sensorDocs.length
  const activeSensors = sensorDocs.filter((sensor) => sensor.isActive).length
  const scores = sensorDocs
    .map((sensor) => sensor.lastValues?.healthScore)
    .filter((score): score is number => typeof score === 'number')

  const averageHealthScore = scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
    : null

  return {
    totalSensors,
    activeSensors,
    leakAlertsLastHour: leakCount,
    averageHealthScore
  }
}

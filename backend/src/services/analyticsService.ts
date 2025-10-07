import { MeasurementModel } from '../models/measurement'
import { SensorModel } from '../models/sensor'
import type { SensorZone } from '../types/sensor'

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

export interface UsageAnalyticsSummary {
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

const HOURS_24 = 24 * 60 * 60 * 1000

interface SensorLookup {
  id: string
  name: string
  zone: SensorZone
}

const mapSensors = async () => {
  const sensors = await SensorModel.find({}).lean().exec()
  const map = new Map<string, SensorLookup>()
  sensors.forEach((sensor) => {
    map.set(sensor._id, {
      id: sensor._id,
      name: sensor.name,
      zone: sensor.zone
    })
  })
  return map
}

export const getUsageAnalytics = async (
  options: { windowMs?: number } = {}
): Promise<UsageAnalyticsSummary> => {
  const now = new Date()
  const windowMs = options.windowMs ?? HOURS_24
  const since = new Date(now.getTime() - windowMs)

  const sensorMap = await mapSensors()

  const [hourlyMetrics, sensorFlow, topFlowDocs, maxPressureDoc, minPressureDoc, lowReservoirDocs] =
    await Promise.all([
      MeasurementModel.aggregate<{
        _id: Date
        avgFlowLpm?: number
        avgPressureBar?: number
        avgLevelPercent?: number
      }>([
        {
          $match: {
            timestamp: { $gte: since }
          }
        },
        {
          $addFields: {
            hour: {
              $dateTrunc: {
                date: '$timestamp',
                unit: 'hour'
              }
            }
          }
        },
        {
          $group: {
            _id: '$hour',
            avgFlowLpm: { $avg: '$flowRateLpm' },
            avgPressureBar: { $avg: '$pressureBar' },
            avgLevelPercent: { $avg: '$levelPercent' }
          }
        },
        { $sort: { _id: 1 } }
      ]).exec(),
      MeasurementModel.aggregate<{
        _id: string
        avgFlowLpm: number
        peakFlowLpm: number
      }>([
        {
          $match: {
            timestamp: { $gte: since },
            flowRateLpm: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$sensorId',
            avgFlowLpm: { $avg: '$flowRateLpm' },
            peakFlowLpm: { $max: '$flowRateLpm' }
          }
        }
      ]).exec(),
      MeasurementModel.find({
        timestamp: { $gte: since },
        flowRateLpm: { $ne: null }
      })
        .sort({ flowRateLpm: -1 })
        .limit(5)
        .lean()
        .exec(),
      MeasurementModel.findOne({
        timestamp: { $gte: since },
        pressureBar: { $ne: null }
      })
        .sort({ pressureBar: -1 })
        .lean()
        .exec(),
      MeasurementModel.findOne({
        timestamp: { $gte: since },
        pressureBar: { $ne: null }
      })
        .sort({ pressureBar: 1 })
        .lean()
        .exec(),
      MeasurementModel.find({
        timestamp: { $gte: since },
        levelPercent: { $ne: null, $lte: 35 }
      })
        .sort({ levelPercent: 1 })
        .limit(5)
        .lean()
        .exec()
    ])

  const zoneAggregates = sensorFlow.reduce<Map<string, ZoneFlowSummary>>((acc, item) => {
    const sensor = sensorMap.get(item._id)
    if (!sensor) return acc
    const zone = sensor.zone
    const existing = acc.get(zone.id)
    const summary: ZoneFlowSummary = existing ?? {
      zoneId: zone.id,
      zoneName: zone.name,
      avgFlowLpm: 0,
      peakFlowLpm: 0,
      sensorsReporting: 0
    }

    summary.avgFlowLpm += item.avgFlowLpm
    summary.peakFlowLpm = Math.max(summary.peakFlowLpm, item.peakFlowLpm)
    summary.sensorsReporting += 1

    acc.set(zone.id, summary)
    return acc
  }, new Map())

  const zoneFlow = Array.from(zoneAggregates.values()).map((entry) => ({
    ...entry,
    avgFlowLpm: Number((entry.avgFlowLpm / entry.sensorsReporting).toFixed(2))
  }))

  const toExtreme = (doc: any | null): ExtremeMeasurement | undefined => {
    if (!doc) return undefined
    const sensor = sensorMap.get(doc.sensorId)
    if (!sensor) return undefined
    return {
      sensorId: sensor.id,
      sensorName: sensor.name,
      zone: sensor.zone,
      value: doc.flowRateLpm ?? doc.pressureBar ?? doc.levelPercent ?? 0,
      timestamp: doc.timestamp
    }
  }

  const topFlowEvents = topFlowDocs
    .map((doc) => {
      const sensor = sensorMap.get(doc.sensorId)
      if (!sensor || doc.flowRateLpm === undefined || doc.flowRateLpm === null) {
        return undefined
      }
      return {
        sensorId: sensor.id,
        sensorName: sensor.name,
        zone: sensor.zone,
        value: doc.flowRateLpm,
        timestamp: doc.timestamp
      } as ExtremeMeasurement
    })
    .filter((item): item is ExtremeMeasurement => Boolean(item))

  const lowReservoirs = lowReservoirDocs
    .map((doc) => {
      const sensor = sensorMap.get(doc.sensorId)
      if (!sensor || doc.levelPercent === undefined || doc.levelPercent === null) {
        return undefined
      }
      return {
        sensorId: sensor.id,
        sensorName: sensor.name,
        zone: sensor.zone,
        value: doc.levelPercent,
        timestamp: doc.timestamp
      } as ExtremeMeasurement
    })
    .filter((item): item is ExtremeMeasurement => Boolean(item))

  return {
    windowStart: since,
    windowEnd: now,
    hourly: hourlyMetrics.map((entry) => ({
      hour: entry._id,
      avgFlowLpm:
        entry.avgFlowLpm !== undefined && entry.avgFlowLpm !== null
          ? Number(entry.avgFlowLpm.toFixed(2))
          : undefined,
      avgPressureBar:
        entry.avgPressureBar !== undefined && entry.avgPressureBar !== null
          ? Number(entry.avgPressureBar.toFixed(3))
          : undefined,
      avgLevelPercent:
        entry.avgLevelPercent !== undefined && entry.avgLevelPercent !== null
          ? Number(entry.avgLevelPercent.toFixed(1))
          : undefined
    })),
    zoneFlow: zoneFlow.sort((a, b) => b.avgFlowLpm - a.avgFlowLpm),
    topFlowEvents,
    pressureExtremes: {
      max: toExtreme(maxPressureDoc),
      min: toExtreme(minPressureDoc)
    },
    lowReservoirs
  }
}

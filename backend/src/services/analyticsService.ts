import { MeasurementModel } from '../models/measurement'
import type { MeasurementDocument } from '../models/measurement'
import { SensorModel } from '../models/sensor'
import type { SensorZone } from '../types/sensor'

type NullableNumber = number | null | undefined

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

const DEFAULT_ANALYTICS_WINDOW_MS = 6 * 60 * 60 * 1000
const FLOW_BUCKET_MINUTES = 10
const ADVANCED_ANALYTICS_WINDOW_MS = 24 * 60 * 60 * 1000
const ADVANCED_ANALYTICS_MAX_RECORDS = 6000
const ADVANCED_ANALYTICS_BUCKET_MINUTES = 10
const MIN_FEATURE_SAMPLES = 40
const MIN_REGRESSION_SAMPLES = 60
const MIN_VALIDATION_SAMPLES = 12
const FEATURE_STD_EPSILON = 1e-6

const REGRESSION_FEATURES = [
  {
    key: 'pressureBar' as const,
    label: 'Pressure (bar)'
  },
  {
    key: 'levelPercent' as const,
    label: 'Reservoir level (%)'
  },
  {
    key: 'temperatureCelsius' as const,
    label: 'Temperature (°C)'
  }
]

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
  const windowMs = options.windowMs ?? DEFAULT_ANALYTICS_WINDOW_MS
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
                unit: 'minute',
                binSize: FLOW_BUCKET_MINUTES
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

const isFiniteNumber = (value: NullableNumber): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const computeMean = (values: number[]) =>
  values.reduce((acc, value) => acc + value, 0) / values.length

const computeVariance = (values: number[], mean: number) => {
  if (values.length < 2) {
    return 0
  }
  const numerator = values.reduce((acc, value) => {
    const diff = value - mean
    return acc + diff * diff
  }, 0)
  return numerator / (values.length - 1)
}

const percentile = (sorted: number[], ratio: number) => {
  if (sorted.length === 0) {
    return undefined
  }
  if (sorted.length === 1) {
    return sorted[0]
  }
  const position = (sorted.length - 1) * ratio
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex]
  }
  const weight = position - lowerIndex
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight
}

export interface MetricSummary {
  sampleSize: number
  mean: number
  median: number
  min: number
  max: number
  stdDev: number
  p25: number
  p75: number
}

export interface CorrelationSummary {
  from: string
  to: string
  coefficient: number
  sampleSize: number
}

export interface TimeseriesPoint {
  timestamp: Date
  sampleCount: number
  flowRateLpm?: number
  pressureBar?: number
  levelPercent?: number
  temperatureCelsius?: number
}

export interface ZoneAggregate {
  zoneId: string
  zoneName: string
  sampleCount: number
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

export interface RegressionPrediction {
  sensorId: string
  sensorName: string
  zone: SensorZone
  timestamp: Date
  actual: number
  predicted: number
  residual: number
}

export interface FeatureImportanceEntry {
  feature: string
  weight: number
  importance: number
}

export interface RegressionModelSummary {
  target: string
  features: string[]
  intercept: number
  coefficients: Record<string, number>
  trainingSamples: number
  validationSamples: number
  evaluation: {
    mae: number
    rmse: number
    r2: number
  }
  featureScaling: Record<string, { mean: number; stdDev: number }>
  featureImportance: FeatureImportanceEntry[]
  predictions: RegressionPrediction[]
  outliers: RegressionPrediction[]
  lastUpdated: Date
}

export interface InsightAnalytics {
  windowStart: Date
  windowEnd: Date
  sampleCount: number
  eda: {
    metrics: Record<string, MetricSummary>
    correlations: CorrelationSummary[]
    zoneAverages: ZoneAggregate[]
  }
  timeseries: TimeseriesPoint[]
  model?: RegressionModelSummary
}

interface PreparedRegressionRow {
  features: number[]
  target: number
  measurement: MeasurementDocument
}

const computeMetricSummary = (values: number[]): MetricSummary | undefined => {
  if (values.length === 0) {
    return undefined
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = computeMean(sorted)
  const variance = computeVariance(sorted, mean)
  const stdDev = Math.sqrt(Math.max(variance, 0))
  const median = percentile(sorted, 0.5) ?? sorted[Math.floor(sorted.length / 2)]
  const p25 = percentile(sorted, 0.25) ?? sorted[0]
  const p75 = percentile(sorted, 0.75) ?? sorted[sorted.length - 1]

  return {
    sampleSize: sorted.length,
    mean: Number(mean.toFixed(3)),
    median: Number(median.toFixed(3)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev: Number(stdDev.toFixed(3)),
    p25: Number(p25.toFixed(3)),
    p75: Number(p75.toFixed(3))
  }
}

const computeCorrelation = (pairs: Array<[number, number]>) => {
  if (pairs.length < 2) {
    return undefined
  }
  const xs = pairs.map(([x]) => x)
  const ys = pairs.map(([, y]) => y)
  const meanX = computeMean(xs)
  const meanY = computeMean(ys)

  let numerator = 0
  let sumSqX = 0
  let sumSqY = 0
  for (const [x, y] of pairs) {
    const diffX = x - meanX
    const diffY = y - meanY
    numerator += diffX * diffY
    sumSqX += diffX * diffX
    sumSqY += diffY * diffY
  }

  const denominator = Math.sqrt(sumSqX) * Math.sqrt(sumSqY)
  if (denominator === 0) {
    return undefined
  }

  return numerator / denominator
}

const predictValue = (features: number[], weights: number[]) => {
  let result = weights[0]
  for (let index = 0; index < features.length; index += 1) {
    result += weights[index + 1] * features[index]
  }
  return result
}

const trainLinearModel = (rows: PreparedRegressionRow[], featureCount: number) => {
  const weights = new Array(featureCount + 1).fill(0)
  if (rows.length === 0) {
    return weights
  }

  const learningRate = 0.015
  const maxIterations = 900

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let biasGradient = 0
    const gradients = new Array(featureCount).fill(0)

    for (const row of rows) {
      const prediction = predictValue(row.features, weights)
      const error = prediction - row.target
      biasGradient += error
      for (let index = 0; index < featureCount; index += 1) {
        gradients[index] += error * row.features[index]
      }
    }

    const scale = 1 / rows.length
    weights[0] -= learningRate * biasGradient * scale
    for (let index = 0; index < featureCount; index += 1) {
      weights[index + 1] -= learningRate * gradients[index] * scale
    }
  }

  return weights
}

const buildRegressionSummary = (
  weights: number[],
  features: typeof REGRESSION_FEATURES[number][],
  featureScaling: Record<string, { mean: number; stdDev: number }>,
  validationRows: PreparedRegressionRow[],
  trainingSampleCount: number,
  allRows: PreparedRegressionRow[],
  sensorMap: Map<string, SensorLookup>
): {
  summary?: RegressionModelSummary
  predictions: RegressionPrediction[]
  outliers: RegressionPrediction[]
} => {
  if (features.length === 0 || validationRows.length === 0) {
    return { predictions: [], outliers: [] }
  }

  const predictions: RegressionPrediction[] = []
  const residuals: RegressionPrediction[] = []

  const collectPrediction = (row: PreparedRegressionRow) => {
    const sensor = sensorMap.get(row.measurement.sensorId)
    if (!sensor) {
      return undefined
    }
    const timestamp = new Date(row.measurement.timestamp ?? new Date())
    const predicted = predictValue(row.features, weights)
    const actual = row.target
    const residual = actual - predicted
    const entry: RegressionPrediction = {
      sensorId: sensor.id,
      sensorName: sensor.name,
      zone: sensor.zone,
      timestamp,
      actual: Number(actual.toFixed(2)),
      predicted: Number(predicted.toFixed(2)),
      residual: Number(residual.toFixed(2))
    }
    return entry
  }

  for (const row of validationRows) {
    const entry = collectPrediction(row)
    if (entry) {
      predictions.push(entry)
    }
  }

  for (const row of allRows) {
    const entry = collectPrediction(row)
    if (entry) {
      residuals.push(entry)
    }
  }

  if (predictions.length === 0) {
    return { predictions: [], outliers: [] }
  }

  const mae = predictions.reduce((acc, entry) => acc + Math.abs(entry.residual), 0) / predictions.length
  const rmse = Math.sqrt(
    predictions.reduce((acc, entry) => acc + entry.residual * entry.residual, 0) /
      predictions.length
  )
  const meanActual = predictions.reduce((acc, entry) => acc + entry.actual, 0) / predictions.length
  const ssTot = predictions.reduce((acc, entry) => {
    const diff = entry.actual - meanActual
    return acc + diff * diff
  }, 0)
  const ssRes = predictions.reduce((acc, entry) => {
    const diff = entry.actual - entry.predicted
    return acc + diff * diff
  }, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  const coefficients = features.reduce<Record<string, number>>((acc, feature, index) => {
    acc[feature.key] = Number(weights[index + 1].toFixed(4))
    return acc
  }, {})

  const featureImportance = features.map<FeatureImportanceEntry>((feature, index) => {
    const scaling = featureScaling[feature.key]
    const rawWeight = weights[index + 1]
    const importance = scaling?.stdDev
      ? Math.abs(rawWeight * scaling.stdDev)
      : Math.abs(rawWeight)
    return {
      feature: feature.label,
      weight: Number(rawWeight.toFixed(4)),
      importance
    }
  })

  const maxImportance = featureImportance.reduce(
    (max, item) => (item.importance > max ? item.importance : max),
    0
  )

  const normalizedFeatureImportance = featureImportance.map((item) => ({
    feature: item.feature,
    weight: item.weight,
    importance: maxImportance > 0 ? Number((item.importance / maxImportance).toFixed(4)) : 0
  }))

  const outliers = residuals
    .slice()
    .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))
    .slice(0, 8)

  return {
    summary: {
      target: 'flowRateLpm',
      features: features.map((feature) => feature.label),
      intercept: Number(weights[0].toFixed(4)),
      coefficients,
      trainingSamples: trainingSampleCount,
      validationSamples: predictions.length,
      evaluation: {
        mae: Number(mae.toFixed(3)),
        rmse: Number(rmse.toFixed(3)),
        r2: Number(r2.toFixed(3))
      },
      featureScaling,
      featureImportance: normalizedFeatureImportance,
      predictions: predictions.slice(-20),
      outliers,
      lastUpdated: new Date()
    },
    predictions,
    outliers
  }
}

export const getInsightAnalytics = async (
  options: { windowMs?: number } = {}
): Promise<InsightAnalytics> => {
  const now = new Date()
  const windowMs = options.windowMs ?? ADVANCED_ANALYTICS_WINDOW_MS
  const since = new Date(now.getTime() - windowMs)

  const sensorMap = await mapSensors()

  const rawMeasurements = await MeasurementModel.find({
    timestamp: { $gte: since }
  })
    .sort({ timestamp: -1 })
    .limit(ADVANCED_ANALYTICS_MAX_RECORDS)
    .lean()
    .exec()

  const measurements = rawMeasurements.reverse()

  const sampleCount = measurements.length

  const valueCollections: Record<string, number[]> = {
    flowRateLpm: [],
    pressureBar: [],
    levelPercent: [],
    temperatureCelsius: []
  }

  const correlationPairs: Record<string, Array<[number, number]>> = {
    'flowRateLpm:pressureBar': [],
    'flowRateLpm:levelPercent': [],
    'flowRateLpm:temperatureCelsius': []
  }

  const zoneAggregates = new Map<
    string,
    {
      zoneId: string
      zoneName: string
      sampleCount: number
      flowSum: number
      flowCount: number
      pressureSum: number
      pressureCount: number
      levelSum: number
      levelCount: number
    }
  >()

  const bucketSizeMs = ADVANCED_ANALYTICS_BUCKET_MINUTES * 60 * 1000
  const buckets = new Map<
    number,
    {
      timestamp: Date
      sampleCount: number
      flowSum: number
      flowCount: number
      pressureSum: number
      pressureCount: number
      levelSum: number
      levelCount: number
      temperatureSum: number
      temperatureCount: number
    }
  >()

  for (const measurement of measurements) {
    const timestamp = new Date(measurement.timestamp ?? now)
    const sensor = sensorMap.get(measurement.sensorId)

    const values: Record<string, NullableNumber> = {
      flowRateLpm: measurement.flowRateLpm,
      pressureBar: measurement.pressureBar,
      levelPercent: measurement.levelPercent,
      temperatureCelsius: measurement.temperatureCelsius
    }

    for (const [key, value] of Object.entries(values)) {
      if (isFiniteNumber(value)) {
        valueCollections[key]?.push(value)
      }
    }

    const flow = measurement.flowRateLpm
    const pressure = measurement.pressureBar
    const level = measurement.levelPercent
    const temperature = measurement.temperatureCelsius

    if (isFiniteNumber(flow) && isFiniteNumber(pressure)) {
      correlationPairs['flowRateLpm:pressureBar'].push([flow, pressure])
    }
    if (isFiniteNumber(flow) && isFiniteNumber(level)) {
      correlationPairs['flowRateLpm:levelPercent'].push([flow, level])
    }
    if (isFiniteNumber(flow) && isFiniteNumber(temperature)) {
      correlationPairs['flowRateLpm:temperatureCelsius'].push([flow, temperature])
    }

    if (sensor) {
      const zoneEntry = zoneAggregates.get(sensor.zone.id) ?? {
        zoneId: sensor.zone.id,
        zoneName: sensor.zone.name,
        sampleCount: 0,
        flowSum: 0,
        flowCount: 0,
        pressureSum: 0,
        pressureCount: 0,
        levelSum: 0,
        levelCount: 0
      }

      zoneEntry.sampleCount += 1
      if (isFiniteNumber(flow)) {
        zoneEntry.flowSum += flow
        zoneEntry.flowCount += 1
      }
      if (isFiniteNumber(pressure)) {
        zoneEntry.pressureSum += pressure
        zoneEntry.pressureCount += 1
      }
      if (isFiniteNumber(level)) {
        zoneEntry.levelSum += level
        zoneEntry.levelCount += 1
      }

      zoneAggregates.set(sensor.zone.id, zoneEntry)
    }

    const bucketKey = Math.floor(timestamp.getTime() / bucketSizeMs) * bucketSizeMs
    const bucket = buckets.get(bucketKey) ?? {
      timestamp: new Date(bucketKey),
      sampleCount: 0,
      flowSum: 0,
      flowCount: 0,
      pressureSum: 0,
      pressureCount: 0,
      levelSum: 0,
      levelCount: 0,
      temperatureSum: 0,
      temperatureCount: 0
    }

    bucket.sampleCount += 1
    if (isFiniteNumber(flow)) {
      bucket.flowSum += flow
      bucket.flowCount += 1
    }
    if (isFiniteNumber(pressure)) {
      bucket.pressureSum += pressure
      bucket.pressureCount += 1
    }
    if (isFiniteNumber(level)) {
      bucket.levelSum += level
      bucket.levelCount += 1
    }
    if (isFiniteNumber(temperature)) {
      bucket.temperatureSum += temperature
      bucket.temperatureCount += 1
    }

    buckets.set(bucketKey, bucket)
  }

  const metricSummaries = Object.entries(valueCollections).reduce<Record<string, MetricSummary>>(
    (acc, [metric, values]) => {
      const summary = computeMetricSummary(values)
      if (summary) {
        acc[metric] = summary
      }
      return acc
    },
    {}
  )

  const correlations = Object.entries(correlationPairs)
    .map(([key, pairs]) => {
      const coefficient = computeCorrelation(pairs)
      if (coefficient === undefined) {
        return undefined
      }
      const [from, to] = key.split(':')
      return {
        from,
        to,
        coefficient: Number(coefficient.toFixed(3)),
        sampleSize: pairs.length
      } satisfies CorrelationSummary
    })
    .filter((entry): entry is CorrelationSummary => Boolean(entry))
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))

  const zoneAverages = Array.from(zoneAggregates.values())
    .map<ZoneAggregate>((entry) => ({
      zoneId: entry.zoneId,
      zoneName: entry.zoneName,
      sampleCount: entry.sampleCount,
      avgFlowLpm:
        entry.flowCount > 0 ? Number((entry.flowSum / entry.flowCount).toFixed(2)) : undefined,
      avgPressureBar:
        entry.pressureCount > 0
          ? Number((entry.pressureSum / entry.pressureCount).toFixed(3))
          : undefined,
      avgLevelPercent:
        entry.levelCount > 0 ? Number((entry.levelSum / entry.levelCount).toFixed(2)) : undefined
    }))
    .sort((a, b) => (b.avgFlowLpm ?? 0) - (a.avgFlowLpm ?? 0))

  const timeseries = Array.from(buckets.values())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map<TimeseriesPoint>((bucket) => ({
      timestamp: bucket.timestamp,
      sampleCount: bucket.sampleCount,
      flowRateLpm:
        bucket.flowCount > 0 ? Number((bucket.flowSum / bucket.flowCount).toFixed(2)) : undefined,
      pressureBar:
        bucket.pressureCount > 0
          ? Number((bucket.pressureSum / bucket.pressureCount).toFixed(3))
          : undefined,
      levelPercent:
        bucket.levelCount > 0
          ? Number((bucket.levelSum / bucket.levelCount).toFixed(2))
          : undefined,
      temperatureCelsius:
        bucket.temperatureCount > 0
          ? Number((bucket.temperatureSum / bucket.temperatureCount).toFixed(2))
          : undefined
    }))

  const applicableFeatures = REGRESSION_FEATURES.filter((feature) => {
    const values = correlationPairs[`flowRateLpm:${feature.key}`]
    return values && values.length >= MIN_FEATURE_SAMPLES
  })

  let modelSummary: RegressionModelSummary | undefined

  if (applicableFeatures.length > 0) {
    const regressionDocs = measurements.filter((measurement) =>
      isFiniteNumber(measurement.flowRateLpm) &&
      applicableFeatures.every((feature) => isFiniteNumber(measurement[feature.key]))
    )

    if (regressionDocs.length >= MIN_REGRESSION_SAMPLES) {
      const featureScaling: Record<string, { mean: number; stdDev: number }> = {}

      for (const feature of applicableFeatures) {
        const values = regressionDocs
          .map((doc) => doc[feature.key])
          .filter((value): value is number => isFiniteNumber(value))
        const mean = computeMean(values)
        const stdDev = Math.sqrt(Math.max(computeVariance(values, mean), 0))
        if (stdDev > FEATURE_STD_EPSILON) {
          featureScaling[feature.key] = {
            mean,
            stdDev
          }
        }
      }

      const activeFeatures = applicableFeatures.filter(
        (feature) => featureScaling[feature.key] !== undefined
      )

      if (activeFeatures.length > 0) {
        const preparedRows: PreparedRegressionRow[] = regressionDocs.map((doc) => {
          const features = activeFeatures.map((feature) => {
            const scaling = featureScaling[feature.key]
            const rawValue = Number(doc[feature.key] ?? 0)
            return (rawValue - scaling.mean) / scaling.stdDev
          })
          return {
            features,
            target: Number(doc.flowRateLpm ?? 0),
            measurement: doc
          }
        })

        const splitIndex = Math.max(
          Math.floor(preparedRows.length * 0.8),
          MIN_VALIDATION_SAMPLES
        )

        let trainingRows = preparedRows.slice(0, splitIndex)
        let validationRows = preparedRows.slice(splitIndex)

        if (validationRows.length < MIN_VALIDATION_SAMPLES) {
          validationRows = preparedRows.slice(-MIN_VALIDATION_SAMPLES)
          const validationStart = Math.max(preparedRows.length - validationRows.length, 0)
          trainingRows = preparedRows.slice(0, validationStart)
        }

        if (trainingRows.length > activeFeatures.length) {
          const weights = trainLinearModel(trainingRows, activeFeatures.length)
          const { summary } = buildRegressionSummary(
            weights,
            activeFeatures,
            featureScaling,
            validationRows,
            trainingRows.length,
            preparedRows,
            sensorMap
          )

          if (summary) {
            modelSummary = summary
          }
        }
      }
    }
  }

  return {
    windowStart: since,
    windowEnd: now,
    sampleCount,
    eda: {
      metrics: metricSummaries,
      correlations,
      zoneAverages
    },
    timeseries,
    model: modelSummary
  }
}

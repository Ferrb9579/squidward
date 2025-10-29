import { API_BASE_URL } from '../config'
import type {
  UsageAnalytics,
  HourlyMetricPoint,
  ZoneFlowSummary,
  ExtremeMeasurement,
  AdvancedAnalytics,
  MetricSummary,
  CorrelationSummary,
  ZoneAggregate,
  AnalyticsTimeseriesPoint,
  RegressionModelSummary,
  RegressionPrediction,
  FeatureImportanceEntry
} from '../types'

interface AnalyticsResponse {
  analytics: AnalyticsDto
}

interface InsightResponse {
  insights: InsightDto
}

interface AnalyticsDto {
  windowStart: string
  windowEnd: string
  hourly: HourlyMetricPointDto[]
  zoneFlow: ZoneFlowSummaryDto[]
  topFlowEvents: ExtremeMeasurementDto[]
  pressureExtremes: {
    max?: ExtremeMeasurementDto
    min?: ExtremeMeasurementDto
  }
  lowReservoirs: ExtremeMeasurementDto[]
}

interface MetricSummaryDto {
  sampleSize: number
  mean: number
  median: number
  min: number
  max: number
  stdDev: number
  p25: number
  p75: number
}

interface CorrelationSummaryDto {
  from: string
  to: string
  coefficient: number
  sampleSize: number
}

interface TimeseriesPointDto {
  timestamp: string
  sampleCount: number
  flowRateLpm?: number
  pressureBar?: number
  levelPercent?: number
  temperatureCelsius?: number
}

interface ZoneAggregateDto {
  zoneId: string
  zoneName: string
  sampleCount: number
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

interface RegressionPredictionDto {
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  timestamp: string
  actual: number
  predicted: number
  residual: number
}

interface FeatureImportanceDto {
  feature: string
  weight: number
  importance: number
}

interface RegressionModelDto {
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
  featureImportance: FeatureImportanceDto[]
  predictions: RegressionPredictionDto[]
  outliers: RegressionPredictionDto[]
  lastUpdated: string
}

interface InsightDto {
  windowStart: string
  windowEnd: string
  sampleCount: number
  eda: {
    metrics: Record<string, MetricSummaryDto>
    correlations: CorrelationSummaryDto[]
    zoneAverages: ZoneAggregateDto[]
  }
  timeseries: TimeseriesPointDto[]
  model?: RegressionModelDto
}

interface HourlyMetricPointDto {
  hour: string
  avgFlowLpm?: number
  avgPressureBar?: number
  avgLevelPercent?: number
}

interface ZoneFlowSummaryDto {
  zoneId: string
  zoneName: string
  avgFlowLpm: number
  peakFlowLpm: number
  sensorsReporting: number
}

interface ExtremeMeasurementDto {
  sensorId: string
  sensorName: string
  zone: { id: string; name: string }
  value: number
  timestamp: string
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return (await response.json()) as T
}

const parseHourlyPoint = (dto: HourlyMetricPointDto): HourlyMetricPoint => ({
  hour: new Date(dto.hour),
  avgFlowLpm: dto.avgFlowLpm ?? undefined,
  avgPressureBar: dto.avgPressureBar ?? undefined,
  avgLevelPercent: dto.avgLevelPercent ?? undefined
})

const parseZoneFlow = (dto: ZoneFlowSummaryDto): ZoneFlowSummary => ({
  zoneId: dto.zoneId,
  zoneName: dto.zoneName,
  avgFlowLpm: Number(dto.avgFlowLpm.toFixed(2)),
  peakFlowLpm: Number(dto.peakFlowLpm.toFixed(2)),
  sensorsReporting: dto.sensorsReporting
})

const parseExtreme = (dto: ExtremeMeasurementDto): ExtremeMeasurement => ({
  sensorId: dto.sensorId,
  sensorName: dto.sensorName,
  zone: dto.zone,
  value: dto.value,
  timestamp: new Date(dto.timestamp)
})

const parseAnalytics = (dto: AnalyticsDto): UsageAnalytics => ({
  windowStart: new Date(dto.windowStart),
  windowEnd: new Date(dto.windowEnd),
  hourly: dto.hourly.map(parseHourlyPoint),
  zoneFlow: dto.zoneFlow.map(parseZoneFlow),
  topFlowEvents: dto.topFlowEvents.map(parseExtreme),
  pressureExtremes: {
    max: dto.pressureExtremes.max
      ? parseExtreme(dto.pressureExtremes.max)
      : undefined,
    min: dto.pressureExtremes.min
      ? parseExtreme(dto.pressureExtremes.min)
      : undefined
  },
  lowReservoirs: dto.lowReservoirs.map(parseExtreme)
})

const parseMetricSummary = (dto: MetricSummaryDto): MetricSummary => ({
  sampleSize: dto.sampleSize,
  mean: dto.mean,
  median: dto.median,
  min: dto.min,
  max: dto.max,
  stdDev: dto.stdDev,
  p25: dto.p25,
  p75: dto.p75
})

const parseCorrelationSummary = (dto: CorrelationSummaryDto): CorrelationSummary => ({
  from: dto.from,
  to: dto.to,
  coefficient: dto.coefficient,
  sampleSize: dto.sampleSize
})

const parseTimeseriesPoint = (dto: TimeseriesPointDto): AnalyticsTimeseriesPoint => ({
  timestamp: new Date(dto.timestamp),
  sampleCount: dto.sampleCount,
  flowRateLpm: dto.flowRateLpm ?? undefined,
  pressureBar: dto.pressureBar ?? undefined,
  levelPercent: dto.levelPercent ?? undefined,
  temperatureCelsius: dto.temperatureCelsius ?? undefined
})

const parseZoneAggregate = (dto: ZoneAggregateDto): ZoneAggregate => ({
  zoneId: dto.zoneId,
  zoneName: dto.zoneName,
  sampleCount: dto.sampleCount,
  avgFlowLpm: dto.avgFlowLpm ?? undefined,
  avgPressureBar: dto.avgPressureBar ?? undefined,
  avgLevelPercent: dto.avgLevelPercent ?? undefined
})

const parseRegressionPrediction = (dto: RegressionPredictionDto): RegressionPrediction => ({
  sensorId: dto.sensorId,
  sensorName: dto.sensorName,
  zone: dto.zone,
  timestamp: new Date(dto.timestamp),
  actual: dto.actual,
  predicted: dto.predicted,
  residual: dto.residual
})

const parseFeatureImportance = (dto: FeatureImportanceDto): FeatureImportanceEntry => ({
  feature: dto.feature,
  weight: dto.weight,
  importance: dto.importance
})

const parseRegressionModel = (dto: RegressionModelDto): RegressionModelSummary => ({
  target: dto.target,
  features: dto.features,
  intercept: dto.intercept,
  coefficients: dto.coefficients,
  trainingSamples: dto.trainingSamples,
  validationSamples: dto.validationSamples,
  evaluation: {
    mae: dto.evaluation.mae,
    rmse: dto.evaluation.rmse,
    r2: dto.evaluation.r2
  },
  featureScaling: dto.featureScaling,
  featureImportance: dto.featureImportance.map(parseFeatureImportance),
  predictions: dto.predictions.map(parseRegressionPrediction),
  outliers: dto.outliers.map(parseRegressionPrediction),
  lastUpdated: new Date(dto.lastUpdated)
})

const parseInsight = (dto: InsightDto): AdvancedAnalytics => ({
  windowStart: new Date(dto.windowStart),
  windowEnd: new Date(dto.windowEnd),
  sampleCount: dto.sampleCount,
  eda: {
    metrics: Object.entries(dto.eda.metrics).reduce<Record<string, MetricSummary>>(
      (acc, [key, value]) => {
        acc[key] = parseMetricSummary(value)
        return acc
      },
      {}
    ),
    correlations: dto.eda.correlations.map(parseCorrelationSummary),
    zoneAverages: dto.eda.zoneAverages.map(parseZoneAggregate)
  },
  timeseries: dto.timeseries.map(parseTimeseriesPoint),
  model: dto.model ? parseRegressionModel(dto.model) : undefined
})

export const fetchUsageAnalytics = async (): Promise<UsageAnalytics> => {
  const response = await fetch(buildUrl('/analytics/usage'))
  const payload = await handleResponse<AnalyticsResponse>(response)
  return parseAnalytics(payload.analytics)
}

export const fetchInsightAnalytics = async (): Promise<AdvancedAnalytics> => {
  const response = await fetch(buildUrl('/analytics/insights'))
  const payload = await handleResponse<InsightResponse>(response)
  return parseInsight(payload.insights)
}

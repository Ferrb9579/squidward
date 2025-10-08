import type {
  SensorState,
  WaterQualityLevel,
  WaterQualityMetricResult,
  WaterQualitySummary
} from '../types'

const statusPriority: Record<WaterQualityLevel, number> = {
  missing: 0,
  safe: 1,
  warning: 2,
  contaminated: 3
}

type WaterQualityInput = {
  sensorId: string
  timestamp: Date
  ph?: number
  temperatureCelsius?: number
  turbidityNTU?: number
  conductivityUsCm?: number
}

const summarizeStatus = (metrics: WaterQualityMetricResult[]): WaterQualityLevel => {
  let worst: WaterQualityLevel = 'safe'
  let hasData = false

  for (const metric of metrics) {
    if (metric.status === 'missing') continue
    hasData = true
    if (statusPriority[metric.status] > statusPriority[worst]) {
      worst = metric.status
    }
  }

  return hasData ? worst : 'missing'
}

const evaluatePh = (value: number | undefined): WaterQualityMetricResult => {
  if (value === undefined || Number.isNaN(value)) {
    return {
      metric: 'ph',
      label: 'pH',
      status: 'missing',
      message: 'No pH sample recorded in the latest reading.',
      recommendedRange: '6.8 – 8.2'
    }
  }

  if (value < 6.5 || value > 8.5) {
    return {
      metric: 'ph',
      label: 'pH',
      value,
      status: 'contaminated',
      message: 'pH is outside the acceptable drinking water band.',
      recommendedRange: '6.8 – 8.2'
    }
  }

  if (value < 6.8 || value > 8.2) {
    return {
      metric: 'ph',
      label: 'pH',
      value,
      status: 'warning',
      message: 'pH drifting toward acidic/alkaline levels.',
      recommendedRange: '6.8 – 8.2'
    }
  }

  return {
    metric: 'ph',
    label: 'pH',
    value,
    status: 'safe',
    message: 'pH is within the recommended range.',
    recommendedRange: '6.8 – 8.2'
  }
}

const evaluateTemperature = (value: number | undefined): WaterQualityMetricResult => {
  if (value === undefined || Number.isNaN(value)) {
    return {
      metric: 'temperatureCelsius',
      label: 'Temperature',
      unit: '°C',
      status: 'missing',
      message: 'No water temperature recorded in the latest reading.',
      recommendedRange: '≤ 25°C'
    }
  }

  if (value > 30) {
    return {
      metric: 'temperatureCelsius',
      label: 'Temperature',
      unit: '°C',
      value,
      status: 'contaminated',
      message: 'Water temperature exceeds 30°C, creating pathogen risk.',
      recommendedRange: '≤ 25°C'
    }
  }

  if (value > 25) {
    return {
      metric: 'temperatureCelsius',
      label: 'Temperature',
      unit: '°C',
      value,
      status: 'warning',
      message: 'Water temperature is elevated; monitor for biological growth.',
      recommendedRange: '≤ 25°C'
    }
  }

  return {
    metric: 'temperatureCelsius',
    label: 'Temperature',
    unit: '°C',
    value,
    status: 'safe',
    message: 'Water temperature is within acceptable bounds.',
    recommendedRange: '≤ 25°C'
  }
}

const evaluateTurbidity = (value: number | undefined): WaterQualityMetricResult => {
  if (value === undefined || Number.isNaN(value)) {
    return {
      metric: 'turbidityNTU',
      label: 'Turbidity',
      unit: 'NTU',
      status: 'missing',
      message: 'No turbidity sample recorded in the latest reading.',
      recommendedRange: '≤ 1 NTU (target), <= 5 NTU (max)'
    }
  }

  if (value > 5) {
    return {
      metric: 'turbidityNTU',
      label: 'Turbidity',
      unit: 'NTU',
      value,
      status: 'contaminated',
      message: 'Turbidity exceeds 5 NTU; filtration likely failing.',
      recommendedRange: '≤ 1 NTU (target), <= 5 NTU (max)'
    }
  }

  if (value > 1) {
    return {
      metric: 'turbidityNTU',
      label: 'Turbidity',
      unit: 'NTU',
      value,
      status: 'warning',
      message: 'Turbidity above target; monitor filter performance.',
      recommendedRange: '≤ 1 NTU (target), <= 5 NTU (max)'
    }
  }

  return {
    metric: 'turbidityNTU',
    label: 'Turbidity',
    unit: 'NTU',
    value,
    status: 'safe',
    message: 'Turbidity is within the recommended target.',
    recommendedRange: '≤ 1 NTU (target), <= 5 NTU (max)'
  }
}

const evaluateConductivity = (value: number | undefined): WaterQualityMetricResult => {
  if (value === undefined || Number.isNaN(value)) {
    return {
      metric: 'conductivityUsCm',
      label: 'Conductivity',
      unit: 'µS/cm',
      status: 'missing',
      message: 'No conductivity sample recorded in the latest reading.',
      recommendedRange: '100 – 600 µS/cm'
    }
  }

  if (value < 75 || value > 800) {
    return {
      metric: 'conductivityUsCm',
      label: 'Conductivity',
      unit: 'µS/cm',
      value,
      status: 'contaminated',
      message: 'Conductivity far outside normal dissolved solids range.',
      recommendedRange: '100 – 600 µS/cm'
    }
  }

  if (value < 100 || value > 600) {
    return {
      metric: 'conductivityUsCm',
      label: 'Conductivity',
      unit: 'µS/cm',
      value,
      status: 'warning',
      message: 'Conductivity trending outside recommended range.',
      recommendedRange: '100 – 600 µS/cm'
    }
  }

  return {
    metric: 'conductivityUsCm',
    label: 'Conductivity',
    unit: 'µS/cm',
    value,
    status: 'safe',
    message: 'Conductivity is within the acceptable range.',
    recommendedRange: '100 – 600 µS/cm'
  }
}

export const evaluateWaterQuality = (
  sensor: SensorState,
  input: WaterQualityInput
): WaterQualitySummary => {
  const metrics: WaterQualityMetricResult[] = [
    evaluatePh(input.ph),
    evaluateTemperature(input.temperatureCelsius),
    evaluateTurbidity(input.turbidityNTU),
    evaluateConductivity(input.conductivityUsCm)
  ]

  const status = summarizeStatus(metrics)

  return {
    sensorId: sensor.id,
    sensorName: sensor.name,
    zone: sensor.zone,
    measuredAt: input.timestamp,
    status,
    metrics
  }
}

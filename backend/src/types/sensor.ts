export type SensorKind = 'flow' | 'pressure' | 'level' | 'composite'

export interface SensorLocation {
  latitude: number
  longitude: number
}

export interface SensorZone {
  id: string
  name: string
}

export interface SensorMetadata {
  id: string
  name: string
  kind: SensorKind
  zone: SensorZone
  location: SensorLocation
  installDepthMeters?: number
  description?: string
  isActive: boolean
}

export interface SensorReading {
  sensorId: string
  timestamp: Date
  flowRateLpm?: number
  pressureBar?: number
  levelPercent?: number
  temperatureCelsius?: number
  batteryPercent?: number
  leakDetected?: boolean
  healthScore?: number
}

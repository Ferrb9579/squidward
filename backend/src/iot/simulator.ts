import { EventEmitter } from 'node:events'

import { env } from '../config/env'
import { SensorModel } from '../models/sensor'
import type {
  SensorMetadata,
  SensorReading,
  SensorState
} from '../types/sensor'
import { ingestSensorReading } from '../services/sensorService'

const seedSensors: SensorMetadata[] = [
  {
    id: 'north-tower-main-flow',
    name: 'North Tower Main Flow',
    kind: 'flow',
    zone: { id: 'north', name: 'North Tower' },
    location: { latitude: 37.423021, longitude: -122.083739 },
    installDepthMeters: 1.3,
    description: 'Primary supply into the north tower',
    isActive: true
  },
  {
    id: 'north-tower-pressure-01',
    name: 'North Tower Pressure Monitor',
    kind: 'pressure',
    zone: { id: 'north', name: 'North Tower' },
    location: { latitude: 37.422958, longitude: -122.082986 },
    installDepthMeters: 1.1,
    description: 'Monitoring valve cluster pressure',
    isActive: true
  },
  {
    id: 'central-reservoir-level',
    name: 'Central Reservoir Level',
    kind: 'level',
    zone: { id: 'central', name: 'Central Reservoir' },
    location: { latitude: 37.421999, longitude: -122.084057 },
    description: 'Underground storage level sensor',
    isActive: true
  },
  {
    id: 'maintenance-yard-composite',
    name: 'Maintenance Yard Composite',
    kind: 'composite',
    zone: { id: 'south', name: 'Maintenance Yard' },
    location: { latitude: 37.421443, longitude: -122.086297 },
    description: 'Multi-metric sensor for maintenance analytics',
    isActive: true
  },
  {
    id: 'north-labs-secondary-flow',
    name: 'North Labs Secondary Flow',
    kind: 'flow',
    zone: { id: 'north', name: 'North Tower' },
    location: { latitude: 37.423612, longitude: -122.084512 },
    installDepthMeters: 1,
    description: 'Redundant feed for the laboratories wing',
    isActive: true
  },
  {
    id: 'central-atrium-pressure',
    name: 'Central Atrium Pressure',
    kind: 'pressure',
    zone: { id: 'central', name: 'Central Reservoir' },
    location: { latitude: 37.422381, longitude: -122.083154 },
    installDepthMeters: 0.9,
    description: 'Monitoring downstream atrium distribution pressure',
    isActive: true
  },
  {
    id: 'south-irrigation-level',
    name: 'South Irrigation Level',
    kind: 'level',
    zone: { id: 'south', name: 'Maintenance Yard' },
    location: { latitude: 37.420956, longitude: -122.085642 },
    description: 'Reservoir level for irrigation staging tanks',
    isActive: true
  },
  {
    id: 'west-quad-flow',
    name: 'West Quad Flow',
    kind: 'flow',
    zone: { id: 'west', name: 'West Quad' },
    location: { latitude: 37.422765, longitude: -122.087148 },
    installDepthMeters: 1.2,
    description: 'Monitor supply to the west academic quad',
    isActive: true
  },
  {
    id: 'east-research-pressure',
    name: 'East Research Pressure',
    kind: 'pressure',
    zone: { id: 'east', name: 'Research Annex' },
    location: { latitude: 37.423982, longitude: -122.082374 },
    installDepthMeters: 1,
    description: 'Lab building loop pressure for research annex',
    isActive: true
  },
  {
    id: 'campus-green-composite',
    name: 'Campus Green Composite',
    kind: 'composite',
    zone: { id: 'green', name: 'Campus Green' },
    location: { latitude: 37.422415, longitude: -122.085931 },
    description: 'Composite monitoring for central greenspace',
    isActive: true
  },
  {
    id: 'karunya-cse-block-flow',
    name: 'Karunya CSE Block Flow',
    kind: 'flow',
    zone: { id: 'karunya-cse', name: 'Karunya CSE Block' },
    location: { latitude: 10.933558, longitude: 76.743181 },
    installDepthMeters: 1.2,
    description: 'Primary distribution feed for the CSE academic block',
    isActive: true
  },
  {
    id: 'karunya-emmanuel-aud-pressure',
    name: 'Karunya Emmanuel Auditorium Pressure',
    kind: 'pressure',
    zone: { id: 'karunya-emmanuel', name: 'Karunya Emmanuel Auditorium' },
    location: { latitude: 10.934023, longitude: 76.745069 },
    installDepthMeters: 1,
    description: 'Pressure monitoring for auditorium supply lines',
    isActive: true
  },
  {
    id: 'karunya-ece-block-level',
    name: 'Karunya ECE Block Level',
    kind: 'level',
    zone: { id: 'karunya-ece', name: 'Karunya ECE Block' },
    location: { latitude: 10.936495, longitude: 76.743055 },
    description: 'Reservoir level sensor for electronics labs',
    isActive: true
  },
  {
    id: 'karunya-admin-composite',
    name: 'Karunya Administration Composite',
    kind: 'composite',
    zone: { id: 'karunya-admin', name: 'Karunya Administration Block' },
    location: { latitude: 10.936278, longitude: 76.744139 },
    description: 'Composite monitoring for the central administration block',
    isActive: true
  }
]

const createInitialState = (doc: any): SensorState => ({
  id: doc._id,
  name: doc.name,
  kind: doc.kind,
  zone: doc.zone,
  location: doc.location,
  installDepthMeters: doc.installDepthMeters ?? undefined,
  description: doc.description ?? undefined,
  isActive: doc.isActive,
  lastReadingAt: doc.lastReadingAt ?? undefined,
  lastValues: doc.lastValues ?? undefined,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
})

const jitter = (base: number, variance: number) => {
  const offset = (Math.random() * 2 - 1) * variance
  return base + offset
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const baseBatteryDrain = () => clamp(95 - Math.random() * 10, 70, 98)

const computeHealthScore = (reading: SensorReading) => {
  const battery = reading.batteryPercent ?? 90
  const leakPenalty = reading.leakDetected ? 35 : 0
  return clamp(Math.round(battery - leakPenalty), 10, 100)
}

export interface SimulatorOptions {
  intervalMs?: number
}

export interface ReadingEventPayload {
  sensor: SensorState
  reading: SensorReading
}

interface SimulatorEvents {
  reading: (payload: ReadingEventPayload) => void
  cycle: (timestamp: Date) => void
  error: (error: unknown) => void
}

class IotSimulator extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private sensors: SensorState[] = []
  private intervalMs: number = env.simulationIntervalMs

  async start(options: SimulatorOptions = {}) {
    if (this.timer) {
      return
    }

    this.intervalMs = options.intervalMs ?? env.simulationIntervalMs
    await this.seedSensors()
    await this.refreshActiveSensors()
    await this.runCycle()

    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => {
        this.emit('error', error)
      })
    }, this.intervalMs)
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  on<E extends keyof SimulatorEvents>(
    event: E,
    listener: SimulatorEvents[E]
  ): this {
    return super.on(event, listener)
  }

  once<E extends keyof SimulatorEvents>(
    event: E,
    listener: SimulatorEvents[E]
  ): this {
    return super.once(event, listener)
  }

  off<E extends keyof SimulatorEvents>(
    event: E,
    listener: SimulatorEvents[E]
  ): this {
    return super.off(event, listener)
  }

  private async seedSensors() {
    await Promise.all(
      seedSensors.map((sensor) =>
        SensorModel.updateOne(
          { _id: sensor.id },
          {
            $set: {
              name: sensor.name,
              kind: sensor.kind,
              zone: sensor.zone,
              location: sensor.location,
              installDepthMeters: sensor.installDepthMeters,
              description: sensor.description,
              isActive: sensor.isActive
            }
          },
          { upsert: true }
        ).exec()
      )
    )
  }

  private async refreshActiveSensors() {
    const results = await SensorModel.find({ isActive: true }).lean().exec()
    this.sensors = results.map(createInitialState)
  }

  private async runCycle() {
    if (!this.sensors.length) {
      await this.refreshActiveSensors()
      if (!this.sensors.length) {
        return
      }
    }

    const timestamp = new Date()

    await Promise.all(
      this.sensors.map((sensor, index) =>
        this.generateAndPersist(sensor, index, timestamp)
      )
    )

    this.emit('cycle', timestamp)
  }

  private async generateAndPersist(
    sensor: SensorState,
    index: number,
    timestamp: Date
  ) {
    const reading = this.generateReading(sensor, timestamp)

    const updatedSensor = await ingestSensorReading({
      sensorId: sensor.id,
      timestamp: reading.timestamp,
      flowRateLpm: reading.flowRateLpm,
      pressureBar: reading.pressureBar,
      levelPercent: reading.levelPercent,
      temperatureCelsius: reading.temperatureCelsius,
      batteryPercent: reading.batteryPercent,
      leakDetected: reading.leakDetected,
      healthScore: reading.healthScore
    })

    this.sensors[index] = updatedSensor

    this.emit('reading', {
      sensor: updatedSensor,
      reading
    })
  }

  private generateReading(sensor: SensorState, timestamp: Date): SensorReading {
    const baseBattery = sensor.lastValues?.batteryPercent ?? baseBatteryDrain()
    const leakTrigger = Math.random() < 0.03

    const reading: SensorReading = {
      sensorId: sensor.id,
      timestamp,
      batteryPercent: clamp(jitter(baseBattery, 1.5), 65, 100)
    }

    switch (sensor.kind) {
      case 'flow': {
        const nominal = 120
        const flowRate = clamp(jitter(nominal, 18), 40, 220)
        reading.flowRateLpm = flowRate
        reading.leakDetected = leakTrigger && flowRate > nominal * 1.35
        break
      }
      case 'pressure': {
        const pressure = clamp(jitter(3.2, 0.4), 1.5, 5.5)
        reading.pressureBar = pressure
        reading.leakDetected = leakTrigger && pressure > 4.6
        break
      }
      case 'level': {
        const lastLevel = sensor.lastValues?.levelPercent ?? 75
        const level = clamp(jitter(lastLevel, 5), 20, 100)
        reading.levelPercent = level
        // leak when level dropping quickly
        reading.leakDetected = leakTrigger && level < lastLevel - 8
        break
      }
      case 'composite': {
        const flow = clamp(jitter(80, 15), 20, 180)
        const pressure = clamp(jitter(2.8, 0.3), 1.2, 4.8)
        const level = clamp(jitter(68, 6), 25, 100)
        const ph = clamp(jitter(7.1, 0.35), 5.8, 8.6)
        const turbidity = clamp(jitter(1.6, 0.9), 0.1, 8.5)
        const conductivity = clamp(jitter(420, 55), 160, 880)
        reading.flowRateLpm = flow
        reading.pressureBar = pressure
        reading.levelPercent = level
        reading.temperatureCelsius = clamp(jitter(19, 1.5), 15, 30)
        reading.ph = ph
        reading.turbidityNTU = turbidity
        reading.conductivityUsCm = conductivity
        reading.leakDetected = leakTrigger && (flow > 150 || pressure > 4.2)
        break
      }
      default:
        break
    }

    reading.healthScore = computeHealthScore(reading)
    return reading
  }
}

export const simulator = new IotSimulator()

export const startSimulator = (options?: SimulatorOptions) =>
  simulator.start(options)

export const stopSimulator = () => simulator.stop()

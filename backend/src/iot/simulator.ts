import { EventEmitter } from 'node:events'

import { env } from '../config/env'
import { MeasurementModel } from '../models/measurement'
import { SensorModel } from '../models/sensor'
import type {
  SensorMetadata,
  SensorReading,
  SensorState
} from '../types/sensor'

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

    await MeasurementModel.create({ ...reading })

    const { sensorId: _sensorId, timestamp: _timestamp, ...latestValues } = reading

    await SensorModel.updateOne(
      { _id: sensor.id },
      {
        $set: {
          lastReadingAt: timestamp,
          lastValues: latestValues
        }
      }
    ).exec()

    const updatedSensor: SensorState = {
      ...sensor,
      lastReadingAt: timestamp,
      lastValues: latestValues,
      updatedAt: timestamp
    }

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
        reading.flowRateLpm = flow
        reading.pressureBar = pressure
        reading.levelPercent = level
        reading.temperatureCelsius = clamp(jitter(19, 1.5), 15, 30)
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

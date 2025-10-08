import { EventEmitter } from 'node:events'
import type { SensorReading, SensorState } from '../types/sensor'

export interface SensorReadingEvent {
  sensor: SensorState
  reading: SensorReading
}

type SensorEventMap = {
  reading: [SensorReadingEvent]
}

class SensorEventEmitter extends EventEmitter<SensorEventMap> {}

export const sensorEvents = new SensorEventEmitter()

export const emitSensorReading = (payload: SensorReadingEvent) => {
  sensorEvents.emit('reading', payload)
}

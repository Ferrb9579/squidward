import { Schema, model, InferSchemaType } from 'mongoose'
import { SensorKind } from '../types/sensor'

const zoneSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true }
  },
  { _id: false }
)

const locationSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  { _id: false }
)

const lastValuesSchema = new Schema(
  {
    flowRateLpm: Number,
    pressureBar: Number,
    levelPercent: Number,
    temperatureCelsius: Number,
    batteryPercent: Number,
    leakDetected: Boolean,
    healthScore: Number,
    ph: Number,
    turbidityDust: Number,
    chlorinePpm: Number
  },
  { _id: false }
)

const sensorSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ['flow', 'pressure', 'level', 'composite'] as SensorKind[]
    },
    zone: { type: zoneSchema, required: true },
    location: { type: locationSchema, required: true },
    installDepthMeters: Number,
    description: String,
    isActive: { type: Boolean, required: true, default: true },
    lastReadingAt: Date,
    lastValues: lastValuesSchema
  },
  {
    timestamps: true,
    versionKey: false
  }
)

sensorSchema.index({ 'zone.id': 1 })
sensorSchema.index({ isActive: 1 })

export type SensorDocument = InferSchemaType<typeof sensorSchema>

export const SensorModel = model<SensorDocument>('Sensor', sensorSchema)

export type SensorSchemaType = InferSchemaType<typeof sensorSchema>

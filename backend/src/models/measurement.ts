import { Schema, model, InferSchemaType } from 'mongoose'

const measurementSchema = new Schema(
  {
    sensorId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
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
  {
    timestamps: true,
    versionKey: false
  }
)

measurementSchema.index({ sensorId: 1, timestamp: -1 })
measurementSchema.index({ timestamp: -1 })
export type MeasurementDocument = InferSchemaType<typeof measurementSchema>

export const MeasurementModel = model<MeasurementDocument>(
  'Measurement',
  measurementSchema
)

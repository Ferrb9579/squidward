import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose'

const sensorAutomationSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    sourceSensorId: { type: String, required: true, index: true },
    targetSensorId: { type: String },
    metric: { type: String, required: true },
    comparison: {
      type: String,
      required: true,
      enum: ['lt', 'lte', 'gt', 'gte', 'eq', 'neq']
    },
    threshold: { type: Schema.Types.Mixed, required: true },
    action: { type: String },
    targetMethod: {
      type: String,
      required: true,
      default: 'POST',
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
  targetUrl: { type: String, required: true },
  payloadTemplate: { type: Schema.Types.Mixed },
    headers: {
      type: Map,
      of: String,
      default: undefined
    },
    timeoutMs: { type: Number, default: 8000 },
    cooldownSeconds: { type: Number, default: 30 },
    enabled: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date }
  },
  {
    timestamps: true,
    versionKey: false
  }
)

sensorAutomationSchema.index({ enabled: 1, sourceSensorId: 1 })

export type SensorAutomationSchemaType = InferSchemaType<typeof sensorAutomationSchema>
export type SensorAutomationDocument = HydratedDocument<SensorAutomationSchemaType>

export const SensorAutomationModel = model<SensorAutomationSchemaType>(
  'SensorAutomation',
  sensorAutomationSchema
)

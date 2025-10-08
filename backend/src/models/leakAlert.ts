import { Schema, model, HydratedDocument, InferSchemaType } from 'mongoose'

const zoneSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true }
  },
  { _id: false }
)

const leakAlertSchema = new Schema(
  {
    sensorId: { type: String, required: true, index: true },
    sensorName: { type: String, required: true },
    zone: { type: zoneSchema, required: true },
    metric: {
      type: String,
      required: true,
      enum: ['flowRateLpm', 'pressureBar', 'levelPercent', 'composite', 'offline']
    },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ['warning', 'critical'] },
    triggeredAt: { type: Date, required: true, index: true },
    currentValue: Number,
    baselineValue: Number,
    delta: Number,
    acknowledged: { type: Boolean, required: true, default: false },
    acknowledgedAt: Date,
    resolvedAt: Date
  },
  {
    timestamps: true,
    versionKey: false
  }
)

leakAlertSchema.index({ acknowledged: 1, resolvedAt: 1, triggeredAt: -1 })
leakAlertSchema.index({ severity: 1, triggeredAt: -1 })

export type LeakAlertSchemaType = InferSchemaType<typeof leakAlertSchema>
export type LeakAlertDocument = HydratedDocument<LeakAlertSchemaType>

export const LeakAlertModel = model<LeakAlertSchemaType>(
  'LeakAlert',
  leakAlertSchema
)

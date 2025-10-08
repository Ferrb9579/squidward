import { Schema, model, InferSchemaType } from 'mongoose'

const apiKeySchema = new Schema(
  {
    _id: { type: String, required: true },
    label: { type: String, required: true },
    sensorId: { type: String, required: false, index: true },
  hash: { type: String, required: true, index: true },
    preview: { type: String, required: true },
    lastUsedAt: { type: Date, required: false },
    createdBy: { type: String, required: false }
  },
  {
    timestamps: true,
    versionKey: false
  }
)

export type ApiKeyDocument = InferSchemaType<typeof apiKeySchema>
export const ApiKeyModel = model<ApiKeyDocument>('ApiKey', apiKeySchema)

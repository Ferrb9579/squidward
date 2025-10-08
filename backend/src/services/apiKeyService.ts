import { randomBytes, createHash } from 'crypto'
import { ApiKeyModel, ApiKeyDocument } from '../models/apiKey'

export interface ApiKeyOptions {
  label: string
  sensorId?: string
  createdBy?: string
}

export interface ApiKeyDto {
  id: string
  label: string
  sensorId?: string
  preview: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt?: Date
}

const mapDocToDto = (doc: ApiKeyDocument): ApiKeyDto => ({
  id: doc._id,
  label: doc.label,
  sensorId: doc.sensorId ?? undefined,
  preview: doc.preview,
  createdAt: doc.createdAt ?? new Date(0),
  updatedAt: doc.updatedAt ?? new Date(0),
  lastUsedAt: doc.lastUsedAt ?? undefined
})

const generateKeyId = () => `ak_${randomBytes(4).toString('hex')}`

const buildPreview = (key: string) => {
  const cleaned = key.replace(/[^A-Z0-9]/gi, '')
  const start = cleaned.slice(0, 4)
  const end = cleaned.slice(-4)
  return `${start}••••${end}`
}

const hashKey = (key: string) =>
  createHash('sha256').update(key).digest('hex')

export const createApiKey = async (
  options: ApiKeyOptions
): Promise<{ key: string; apiKey: ApiKeyDto }> => {
  const key = `sk_${randomBytes(24).toString('hex')}`
  const hash = hashKey(key)
  const preview = buildPreview(key)
  const id = generateKeyId()

  const doc = await ApiKeyModel.create({
    _id: id,
    label: options.label,
    sensorId: options.sensorId,
    createdBy: options.createdBy,
    hash,
    preview
  })

  return { key, apiKey: mapDocToDto(doc) }
}

export const listApiKeys = async (): Promise<ApiKeyDto[]> => {
  const docs = await ApiKeyModel.find({}).sort({ createdAt: -1 }).exec()
  return docs.map(mapDocToDto)
}

export const deleteApiKey = async (id: string) => {
  await ApiKeyModel.findByIdAndDelete(id).exec()
}

export const verifyApiKey = async (
  key: string
): Promise<ApiKeyDocument | null> => {
  const hash = hashKey(key)
  const doc = await ApiKeyModel.findOne({ hash }).exec()
  if (!doc) {
    return null
  }
  doc.lastUsedAt = new Date()
  await doc.save()
  return doc
}

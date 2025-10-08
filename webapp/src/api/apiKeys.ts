import { API_BASE_URL } from '../config'

export interface ApiKeySummary {
  id: string
  label: string
  sensorId?: string
  preview: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt?: Date
}

interface ApiKeyDto {
  id: string
  label: string
  sensorId?: string
  preview: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

interface ListApiKeysResponse {
  apiKeys: ApiKeyDto[]
}

interface CreateApiKeyResponse {
  apiKey: ApiKeyDto
  key: string
}

export const listApiKeys = async (): Promise<ApiKeySummary[]> => {
  const response = await fetch(`${API_BASE_URL}/api-keys`)
  if (!response.ok) {
    throw new Error(`Failed to load API keys (${response.status})`)
  }
  const payload = (await response.json()) as ListApiKeysResponse
  return payload.apiKeys.map((item) => ({
    id: item.id,
    label: item.label,
    sensorId: item.sensorId ?? undefined,
    preview: item.preview,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    lastUsedAt: item.lastUsedAt ? new Date(item.lastUsedAt) : undefined
  }))
}

export const createApiKey = async (input: {
  label: string
  sensorId?: string
  createdBy?: string
}): Promise<{ apiKey: ApiKeySummary; key: string }> => {
  const response = await fetch(`${API_BASE_URL}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  })
  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => body?.message as string | undefined)
      .catch(() => undefined)
    throw new Error(message ?? `Failed to create API key (${response.status})`)
  }
  const payload = (await response.json()) as CreateApiKeyResponse
  return {
    key: payload.key,
    apiKey: {
      id: payload.apiKey.id,
      label: payload.apiKey.label,
      sensorId: payload.apiKey.sensorId ?? undefined,
      preview: payload.apiKey.preview,
      createdAt: new Date(payload.apiKey.createdAt),
      updatedAt: new Date(payload.apiKey.updatedAt),
      lastUsedAt: payload.apiKey.lastUsedAt
        ? new Date(payload.apiKey.lastUsedAt)
        : undefined
    }
  }
}

export const deleteApiKey = async (apiKeyId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api-keys/${apiKeyId}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error(`Failed to delete API key (${response.status})`)
  }
}

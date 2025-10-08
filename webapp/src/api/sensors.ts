import { API_BASE_URL } from '../config'
import type { SensorState } from '../types'
import type { SensorDto } from './dashboard'
import { parseSensor } from './dashboard'

interface CreateSensorResponse {
  sensor: SensorDto
}

export interface CreateSensorPayload {
  id?: string
  name: string
  kind: SensorState['kind']
  zone: { id: string; name: string }
  location: { latitude: number; longitude: number }
  installDepthMeters?: number
  description?: string
  isActive?: boolean
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

const handleJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => body?.message as string | undefined)
      .catch(() => undefined)
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export const createSensor = async (
  payload: CreateSensorPayload
): Promise<SensorState> => {
  const response = await fetch(buildUrl('/sensors'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await handleJsonResponse<CreateSensorResponse>(response)
  return parseSensor(data.sensor)
}

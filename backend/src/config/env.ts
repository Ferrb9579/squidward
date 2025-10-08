import { config } from 'dotenv'

config()

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === null) return fallback
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false
  }
  return fallback
}

const parseList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const parseString = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 4000),
  mongoUri: parseString(process.env.MONGO_URI, 'mongodb://localhost:27017/squidward'),
  simulationIntervalMs: parseNumber(process.env.SIMULATION_INTERVAL_MS, 5000),
  email: {
    host: process.env.EMAIL_HOST ?? '',
    port: parseNumber(process.env.EMAIL_PORT, 587),
    secure: parseBoolean(process.env.EMAIL_SECURE, false),
    user: process.env.EMAIL_USER ?? '',
    password: process.env.EMAIL_PASSWORD ?? '',
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? '',
    recipients: parseList(process.env.ALERT_RECIPIENTS),
    enabled: Boolean(
      (process.env.EMAIL_HOST ?? '').trim() &&
        (process.env.EMAIL_USER ?? '').trim() &&
        (process.env.EMAIL_PASSWORD ?? '').trim()
    )
  },
  alerts: {
    offlineThresholdMinutes: parseNumber(process.env.OFFLINE_THRESHOLD_MINUTES, 3),
    offlineCheckIntervalMs: parseNumber(process.env.OFFLINE_CHECK_INTERVAL_MS, 60000)
  },
  ai: {
    apiKey: process.env.AI_STUDIO_API_KEY ?? '',
    modelId: process.env.MODEL_ID ?? 'gemini-1.5-flash',
    enabled: Boolean((process.env.AI_STUDIO_API_KEY ?? '').trim()),
    endpoint:
      process.env.AI_STUDIO_ENDPOINT?.trim() ||
      'https://generativelanguage.googleapis.com/v1beta'
  }
} as const

export const isProduction = env.nodeEnv === 'production'
export const isDevelopment = env.nodeEnv === 'development'

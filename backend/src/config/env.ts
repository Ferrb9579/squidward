import { config } from 'dotenv'

config()

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/squidward',
  simulationIntervalMs: parseNumber(process.env.SIMULATION_INTERVAL_MS, 5000)
} as const

export const isProduction = env.nodeEnv === 'production'
export const isDevelopment = env.nodeEnv === 'development'

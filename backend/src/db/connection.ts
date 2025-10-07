import mongoose from 'mongoose'
import { env } from '../config/env'

mongoose.set('strictQuery', true)

let connectionPromise: Promise<typeof mongoose> | null = null

export const connectToDatabase = async () => {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000
    })
  }

  try {
    const conn = await connectionPromise
    return conn
  } catch (error) {
    connectionPromise = null
    throw error
  }
}

export const disconnectFromDatabase = async () => {
  if (connectionPromise) {
    await mongoose.disconnect()
    connectionPromise = null
  }
}

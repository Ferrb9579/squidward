import type { Request, Response } from 'express'
import { simulator } from '../iot/simulator'
import { sensorEvents } from '../events/sensorEvents'
import type { SensorReadingEvent } from '../events/sensorEvents'
import {
  leakDetectionEvents,
  normalizeAlertPayload
} from '../services/leakDetectionService'

interface Client {
  id: number
  res: Response
  keepAlive: NodeJS.Timeout
}

const clients = new Map<number, Client>()
let nextClientId = 1

const writeEvent = (client: Client, event: string, data: unknown) => {
  client.res.write(`event: ${event}\n`)
  client.res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const broadcast = (event: string, data: unknown) => {
  clients.forEach((client) => {
    try {
      writeEvent(client, event, data)
    } catch (error) {
      console.error('Failed to dispatch SSE event', error)
    }
  })
}

const startKeepAlive = (res: Response) => {
  return setInterval(() => {
    res.write(': keep-alive\n\n')
  }, 20000)
}

export const establishSseConnection = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const keepAlive = startKeepAlive(res)

  const client: Client = {
    id: nextClientId++,
    res,
    keepAlive
  }

  clients.set(client.id, client)
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`)

  const cleanup = () => {
    clearInterval(client.keepAlive)
    clients.delete(client.id)
  }

  req.on('close', cleanup)
  req.on('end', cleanup)
  req.on('error', cleanup)
}

const includeReading = ({ sensor, reading }: SensorReadingEvent) => ({
  sensor,
  reading
})

sensorEvents.on('reading', (payload) => {
  broadcast('reading', includeReading(payload))
})

simulator.on('cycle', (timestamp) => {
  broadcast('cycle', { timestamp })
})

simulator.on('error', (error) => {
  broadcast('simulator-error', {
    message: error instanceof Error ? error.message : 'Unknown error'
  })
})

leakDetectionEvents.on('alert', (payload) => {
  broadcast('leak-alert', {
    type: payload.type,
    alert: normalizeAlertPayload(payload.alert)
  })
})

export const getConnectedClientCount = () => clients.size

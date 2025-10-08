import type { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import express from 'express'
import { env } from './config/env'
import { connectToDatabase, disconnectFromDatabase } from './db/connection'
import { simulator, startSimulator, stopSimulator } from './iot/simulator'
import apiRouter from './routes/api'
import { verifyApiKey } from './services/apiKeyService'
import { ingestSensorReading } from './services/sensorService'
import { startAlertNotifications } from './services/alertNotificationService'
import {
	startDeviceMonitoring,
	stopDeviceMonitoring
} from './services/deviceMonitoringService'

const app = express()
app.use(cors())
app.use(express.json())

simulator.on('error', (error) => {
	console.error('Simulator error', error)
})

app.use('/api', apiRouter)

const parseNumberField = (value: unknown): number | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

const parseBooleanField = (value: unknown): boolean | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined
	}
	if (typeof value === 'boolean') return value
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (normalized === 'true') return true
		if (normalized === 'false') return false
	}
	return undefined
}

app.post('/sensor/:sensorId', async (req, res) => {
	const apiKeyHeader = req.header('x-api-key')
	if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
		res.status(401).json({ message: 'Missing API key' })
		return
	}

	try {
		const apiKey = await verifyApiKey(apiKeyHeader)
		if (!apiKey) {
			res.status(401).json({ message: 'Invalid API key' })
			return
		}

		const sensorId = req.params.sensorId
		if (apiKey.sensorId && apiKey.sensorId !== sensorId) {
			res.status(403).json({ message: 'API key is not authorized for this sensor' })
			return
		}

		const timestampRaw = req.body?.timestamp
		let timestamp: Date | undefined
		if (timestampRaw) {
			const parsed = new Date(timestampRaw)
			if (Number.isNaN(parsed.valueOf())) {
				res.status(400).json({ message: 'Invalid timestamp' })
				return
			}
			timestamp = parsed
		}

		const sensor = await ingestSensorReading({
			sensorId,
			timestamp,
			flowRateLpm: parseNumberField(req.body?.flowRateLpm),
			pressureBar: parseNumberField(req.body?.pressureBar),
			levelPercent: parseNumberField(req.body?.levelPercent),
			temperatureCelsius: parseNumberField(req.body?.temperatureCelsius),
			batteryPercent: parseNumberField(req.body?.batteryPercent),
			leakDetected: parseBooleanField(req.body?.leakDetected),
			healthScore: parseNumberField(req.body?.healthScore),
			ph: parseNumberField(req.body?.ph),
			turbidityDust: parseNumberField(req.body?.turbidityDust),
			chlorinePpm: parseNumberField(req.body?.chlorinePpm)
		})

		res.status(202).json({ sensor })
		} catch (error) {
			if (error instanceof Error && error.message === 'Sensor not found') {
				res.status(404).json({ message: 'Sensor not found' })
				return
			}
			console.error('Sensor ingestion failed', error)
			res.status(500).json({ message: 'Unable to ingest sensor data' })
		}
})

app.get('/health', (_req, res) => {
	res.json({
		status: 'ok',
		environment: env.nodeEnv,
		timestamp: new Date().toISOString()
	})
})

app.use((_req, res) => {
	res.status(404).json({ message: 'Not Found' })
})

app.use(
	(error: unknown, _req: Request, res: Response, _next: NextFunction) => {
		console.error('API error', error)
		res.status(500).json({ message: 'Internal server error' })
	}
)

const startServer = async () => {
	try {
		await connectToDatabase()
		await startSimulator()
		startAlertNotifications()
		startDeviceMonitoring()
		app.listen(env.port, () => {
			console.log(`Backend ready on port ${env.port}`)
		})
	} catch (error) {
		console.error('Failed to start backend', error)
		process.exitCode = 1
	}
}

if (require.main === module) {
	void startServer()
}

const shutdown = async (signal: NodeJS.Signals) => {
	console.log(`Received ${signal}. Shutting down gracefully...`)
	try {
		await stopSimulator()
		stopDeviceMonitoring()
		await disconnectFromDatabase()
	} finally {
		process.exit(0)
	}
}

process.on('SIGINT', () => {
	void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
	void shutdown('SIGTERM')
})

export { app, startServer }

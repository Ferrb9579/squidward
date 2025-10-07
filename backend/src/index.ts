import type { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import express from 'express'
import { env } from './config/env'
import { connectToDatabase, disconnectFromDatabase } from './db/connection'
import { simulator, startSimulator, stopSimulator } from './iot/simulator'
import apiRouter from './routes/api'

const app = express()
app.use(cors())
app.use(express.json())

simulator.on('error', (error) => {
	console.error('Simulator error', error)
})

app.use('/api', apiRouter)

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

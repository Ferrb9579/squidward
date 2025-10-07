import express from 'express'
import { env } from './config/env'
import { connectToDatabase, disconnectFromDatabase } from './db/connection'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
	res.json({
		status: 'ok',
		environment: env.nodeEnv,
		timestamp: new Date().toISOString()
	})
})

const startServer = async () => {
	try {
		await connectToDatabase()
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

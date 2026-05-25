import 'express-async-errors'
import express, { Request, Response, NextFunction } from 'express'
import { createServer } from 'http'
import { config } from './config'
import authRouter from './routes/auth'
import tracesRouter from './routes/traces'
import servicesRouter from './routes/services'
import alertsRouter from './routes/alerts'
import { setupWebSocket } from './ws/server'

const app = express()
app.use(express.json())

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/traces', tracesRouter)
app.use('/api/v1/services', servicesRouter)
app.use('/api/v1/alerts', alertsRouter)

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error', message: err.message })
})

const httpServer = createServer(app)
setupWebSocket(httpServer)

httpServer.listen(Number(config.port), () => {
  console.log(`[api] listening on :${config.port}`)
})

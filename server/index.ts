import { loadLocalEnv } from './lib/env'
import express from 'express'
import cors from 'cors'
import { errorHandler, notFoundHandler } from './lib/http'
import authRouter from './routes/auth'
import adminRouter from './routes/admin'
import categoriesRouter from './routes/categories'
import servicesRouter from './routes/services'
import timeSlotsRouter from './routes/timeSlots'
import appointmentsRouter from './routes/appointments'

loadLocalEnv()

const app = express()

app.use(cors())
app.use(express.json())

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'up' } })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/services', servicesRouter)
app.use('/api/time-slots', timeSlotsRouter)
app.use('/api/appointments', appointmentsRouter)

app.use(notFoundHandler)
app.use(errorHandler)

// 本地开发：node -r ts-node/register api/index.ts
// Vercel 环境（VERCEL=1）下不启动监听，仅导出 app
if (process.env.VERCEL !== '1' && require.main === module) {
  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`)
  })
}

export default app

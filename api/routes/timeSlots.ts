import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Response } from 'express'
import { getPool } from '../lib/db'
import { ApiError, assertRequired, ok } from '../lib/http'
import { requireAdmin, requireAuth } from '../lib/auth'

const router = Router()

const SLOT_COLUMNS = `
  id AS "_id",
  to_char(date, 'YYYY-MM-DD') AS "date",
  start_time AS "startTime",
  end_time AS "endTime",
  max_count AS "maxCount",
  booked_count AS "bookedCount",
  is_available AS "isAvailable"
`

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * GET /api/time-slots
 * - ?mode=availableDates&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *   返回: AvailableDate[] { date, availableCount }
 * - ?date=YYYY-MM-DD
 *   返回: TimeSlot[]
 */
router.get('/', async (req, res, next) => {
  try {
    const { mode, date, startDate, endDate } = req.query as Record<string, string>

    if (mode === 'availableDates') {
      assertRequired(startDate, '缺少 startDate')
      assertRequired(endDate, '缺少 endDate')
      const { rows } = await getPool().query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS "availableCount"
         FROM time_slots
         WHERE date >= $1 AND date <= $2
           AND is_available = TRUE
           AND booked_count < max_count
         GROUP BY date
         ORDER BY date`,
        [startDate, endDate]
      )
      ok(res, rows)
      return
    }

    if (date) {
      const { rows } = await getPool().query(
        `SELECT ${SLOT_COLUMNS} FROM time_slots WHERE date = $1 ORDER BY start_time`,
        [date]
      )
      ok(res, rows)
      return
    }

    ok(res, [])
  } catch (err) {
    next(err)
  }
})

interface WeeklyConfig {
  dayOfWeek: number
  isActive: boolean
  startTime: string
  endTime: string
  maxCount: number
}

/**
 * POST /api/admin/time-slots
 * - action=create: { date, startTime, endTime, maxCount }
 * - action=updateWeekly: { configs: WeeklyConfig[] }
 *   返回 updateWeekly: { generatedCount, updatedCount, closedCount }
 */
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  const body = (req.body || {}) as Record<string, any>

  if (body.action === 'updateWeekly') {
    await handleUpdateWeekly(body.configs, res, next)
    return
  }

  // action=create（手工添加时段）
  try {
    assertRequired(body.date, '请选择日期')
    assertRequired(body.startTime, '请填写开始时间')
    assertRequired(body.endTime, '请填写结束时间')

    const id = randomUUID()
    const { rows } = await getPool().query(
      `INSERT INTO time_slots (id, date, start_time, end_time, max_count, source)
       VALUES ($1, $2, $3, $4, $5, 'manual')
       ON CONFLICT (date, start_time, end_time)
       DO UPDATE SET max_count = EXCLUDED.max_count, is_available = TRUE
       RETURNING ${SLOT_COLUMNS}`,
      [
        id,
        body.date,
        String(body.startTime),
        String(body.endTime),
        Number(body.maxCount ?? 1)
      ]
    )
    ok(res, rows[0])
  } catch (err) {
    next(err)
  }
})

async function handleUpdateWeekly(
  configs: unknown,
  res: Response,
  next: NextFunction
) {
  const client = await getPool().connect()
  try {
    const list = (Array.isArray(configs) ? configs : []) as WeeklyConfig[]
    if (list.length === 0) throw new ApiError(400, '缺少周配置')

    await client.query('BEGIN')

    // 1. 持久化每周配置
    for (const config of list) {
      await client.query(
        `INSERT INTO weekly_configs (day_of_week, is_active, start_time, end_time, max_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (day_of_week)
         DO UPDATE SET is_active = EXCLUDED.is_active,
                       start_time = EXCLUDED.start_time,
                       end_time = EXCLUDED.end_time,
                       max_count = EXCLUDED.max_count`,
        [
          Number(config.dayOfWeek),
          Boolean(config.isActive),
          config.startTime || '09:00',
          config.endTime || '18:00',
          Number(config.maxCount) || 1
        ]
      )
    }

    // 2. 未来 14 天（明天起），按模板生成/更新周模板时段
    const dates: string[] = []
    for (let i = 1; i <= 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      dates.push(formatDateKey(d))
    }
    const activeMap = list.filter((c) => c.isActive)
    let generatedCount = 0
    let updatedCount = 0
    let closedCount = 0

    for (const date of dates) {
      const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
      const config = activeMap.find((c) => c.dayOfWeek === dayOfWeek)

      if (config) {
        const { rows } = await client.query(
          `INSERT INTO time_slots (id, date, start_time, end_time, max_count, is_available, source)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'weekly')
           ON CONFLICT (date, start_time, end_time)
           DO UPDATE SET max_count = EXCLUDED.max_count, is_available = TRUE
           RETURNING (xmax = 0) AS inserted`,
          [randomUUID(), date, config.startTime, config.endTime, Number(config.maxCount) || 1]
        )
        if (rows[0]?.inserted) generatedCount += 1
        else updatedCount += 1
      } else {
        // 该日期不在活跃模板中：关闭由周模板生成且当前开放的时段
        const result = await client.query(
          `UPDATE time_slots SET is_available = FALSE
           WHERE date = $1 AND source = 'weekly' AND is_available = TRUE
           RETURNING id`,
          [date]
        )
        closedCount += result.rowCount ?? 0
      }
    }

    await client.query('COMMIT')
    ok(res, { generatedCount, updatedCount, closedCount })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
}

/**
 * PUT /api/admin/time-slots/:id
 * body: { isAvailable?, maxCount? }
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, any>
    const assignments: string[] = []
    const values: unknown[] = []
    let index = 1
    if ('isAvailable' in body) {
      assignments.push(`is_available = $${index++}`)
      values.push(Boolean(body.isAvailable))
    }
    if ('maxCount' in body) {
      assignments.push(`max_count = $${index++}`)
      values.push(Number(body.maxCount))
    }
    if (assignments.length === 0) throw new ApiError(400, '没有可更新的字段')

    values.push(req.params.id)
    const { rows } = await getPool().query(
      `UPDATE time_slots SET ${assignments.join(', ')} WHERE id = $${index} RETURNING ${SLOT_COLUMNS}`,
      values
    )
    if (!rows[0]) throw new ApiError(404, '时段不存在')
    ok(res, rows[0])
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/admin/time-slots/:id
 * 已有预约的时段不允许删除
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await getPool().query(
      'SELECT booked_count AS "bookedCount" FROM time_slots WHERE id = $1',
      [req.params.id]
    )
    if (!rows[0]) throw new ApiError(404, '时段不存在')
    if (rows[0].bookedCount > 0) throw new ApiError(400, '该时段已有预约，无法删除')

    await getPool().query('DELETE FROM time_slots WHERE id = $1', [req.params.id])
    ok(res, { deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router

import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { getPool } from '../lib/db'
import { ApiError, assertRequired, ok } from '../lib/http'
import { requireAuth } from '../lib/auth'

const router = Router()

const APPOINTMENT_COLUMNS = `
  a.id AS "_id",
  a.user_id AS "userId",
  a.service_id AS "serviceId",
  a.service_name AS "serviceName",
  a.service_price AS "servicePrice",
  to_char(a.date, 'YYYY-MM-DD') AS "date",
  a.time_slot AS "timeSlot",
  a.status,
  a.customer_name AS "customerName",
  a.phone,
  a.car_model AS "carModel",
  a.remark,
  to_char(a.create_time, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createTime"
`

const VALID_STATUS = ['pending', 'confirmed', 'completed', 'cancelled'] as const
type AppointmentStatus = (typeof VALID_STATUS)[number]

function isStatus(value: unknown): value is AppointmentStatus {
  return VALID_STATUS.includes(value as AppointmentStatus)
}

/** 状态机：用户仅能取消自己的预约；管理员可确认/完成/取消 */
function getTransitions(isAdmin: boolean): Record<AppointmentStatus, AppointmentStatus[]> {
  return isAdmin
    ? { pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }
    : { pending: ['cancelled'], confirmed: ['cancelled'], completed: [], cancelled: [] }
}

/**
 * GET /api/appointments?status=
 * 用户：本人预约；管理员：全部预约
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined
    const user = req.user!
    const pool = getPool()

    if (user.isAdmin) {
      const { rows } = status
        ? await pool.query(
            `SELECT ${APPOINTMENT_COLUMNS} FROM appointments a
             WHERE a.status = $1 ORDER BY a.date DESC, a.create_time DESC`,
            [status]
          )
        : await pool.query(
            `SELECT ${APPOINTMENT_COLUMNS} FROM appointments a
             ORDER BY a.date DESC, a.create_time DESC`
          )
      ok(res, rows)
      return
    }

    const { rows } = status
      ? await pool.query(
          `SELECT ${APPOINTMENT_COLUMNS} FROM appointments a
           WHERE a.user_id = $1 AND a.status = $2 ORDER BY a.date DESC, a.create_time DESC`,
          [user.id, status]
        )
      : await pool.query(
          `SELECT ${APPOINTMENT_COLUMNS} FROM appointments a
           WHERE a.user_id = $1 ORDER BY a.date DESC, a.create_time DESC`,
          [user.id]
        )
    ok(res, rows)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/appointments
 * body: { serviceId?, serviceName?, servicePrice?, date, timeSlot, customerName, phone, carModel, remark? }
 * 事务内校验时段 + 占用名额（防超卖）
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, any>
    assertRequired(body.date, '请选择预约日期')
    assertRequired(body.timeSlot, '请选择预约时段')
    assertRequired(body.customerName, '请填写姓名')
    assertRequired(body.phone, '请填写手机号')
    assertRequired(body.carModel, '请填写车型')

    const [startTime, endTime] = String(body.timeSlot).split('-')
    if (!startTime || !endTime) throw new ApiError(400, '时段格式不正确')

    const user = req.user!
    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 校验时段并占额（原子操作，避免超卖）
      const slotRes = await client.query(
        `SELECT id, is_available, booked_count, max_count
         FROM time_slots WHERE date = $1 AND start_time = $2 AND end_time = $3`,
        [body.date, startTime, endTime]
      )
      const slot = slotRes.rows[0]
      if (!slot) throw new ApiError(400, '该时段不存在')
      if (!slot.is_available) throw new ApiError(400, '该时段已关闭')
      if (slot.booked_count >= slot.max_count) throw new ApiError(400, '该时段已约满')

      const occupy = await client.query(
        `UPDATE time_slots SET booked_count = booked_count + 1
         WHERE id = $1 AND booked_count < max_count RETURNING id`,
        [slot.id]
      )
      if (!occupy.rows[0]) throw new ApiError(400, '该时段已约满')

      const id = randomUUID()
      await client.query(
        `INSERT INTO appointments
          (id, user_id, service_id, service_name, service_price, date, time_slot, status, customer_name, phone, car_model, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11)`,
        [
          id,
          user.id,
          body.serviceId || null,
          String(body.serviceName || ''),
          String(body.servicePrice ?? '0'),
          body.date,
          String(body.timeSlot),
          String(body.customerName).trim(),
          String(body.phone).trim(),
          String(body.carModel).trim(),
          String(body.remark || '')
        ]
      )

      await client.query('COMMIT')
      ok(res, {
        _id: id,
        status: 'pending',
        serviceName: String(body.serviceName || ''),
        date: body.date,
        timeSlot: String(body.timeSlot)
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/appointments/:id
 * 本人或管理员可见；管理员视角附带 isAdminView + userInfo
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!
    const { rows } = await getPool().query(
      `SELECT ${APPOINTMENT_COLUMNS}, u.nickname, u.avatar
       FROM appointments a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = $1`,
      [req.params.id]
    )
    if (!rows[0]) throw new ApiError(404, '预约不存在')

    const row = rows[0]
    const isOwner = row.userId === user.id
    if (!user.isAdmin && !isOwner) throw new ApiError(403, '无权查看该预约')

    const data: Record<string, unknown> = { ...row }
    delete data.nickname
    delete data.avatar
    data.userInfo = { nickname: row.nickname, avatar: row.avatar }
    if (user.isAdmin) data.isAdminView = true

    ok(res, data)
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/appointments/:id
 * body: { status }
 * 取消预约时释放时段名额；状态迁移受状态机约束
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { status } = (req.body || {}) as { status?: string }
    if (!isStatus(status)) throw new ApiError(400, '无效的预约状态')

    const user = req.user!
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT a.* FROM appointments a WHERE a.id = $1`,
      [req.params.id]
    )
    if (!rows[0]) throw new ApiError(404, '预约不存在')

    const appointment = rows[0]
    const isOwner = appointment.user_id === user.id
    if (!user.isAdmin && !isOwner) throw new ApiError(403, '无权操作该预约')

    const transitions = getTransitions(user.isAdmin)
    if (!transitions[appointment.status as AppointmentStatus].includes(status)) {
      throw new ApiError(400, '当前状态不允许该操作')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id])

      // 取消预约释放名额（仅从未取消状态变更时减一）
      if (status === 'cancelled' && appointment.status !== 'cancelled') {
        const [startTime, endTime] = String(appointment.time_slot).split('-')
        await client.query(
          `UPDATE time_slots SET booked_count = GREATEST(booked_count - 1, 0)
           WHERE date = $1 AND start_time = $2 AND end_time = $3`,
          [appointment.date, startTime, endTime]
        )
      }

      await client.query('COMMIT')
      ok(res, { _id: req.params.id, status })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    next(err)
  }
})

export default router

const crypto = require('crypto')
const { requireAuth } = require('../lib/auth')
const { first, insert, list, updateById } = require('../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../lib/response')

function parseTimeSlot(timeSlot) {
  const [startTime, endTime] = String(timeSlot || '').split('-')
  return { startTime, endTime }
}

function slotKey(date, startTime, endTime) {
  return `${date}_${startTime}_${endTime}`
}

async function getCurrentUser(auth) {
  return first('users', { _id: `eq.${auth.userId}` })
}

async function listAppointments(req, res) {
  const auth = requireAuth(req)
  const user = await getCurrentUser(auth)
  const query = { order: 'createTime.desc' }
  if (req.query.status) query.status = `eq.${req.query.status}`
  if (!user?.isAdmin || req.query.isAdmin === 'false') {
    query._openid = `eq.${auth.openid}`
  }
  const data = await list('appointments', query)
  return ok(res, data)
}

async function createAppointment(req, res) {
  const auth = requireAuth(req)
  const user = await getCurrentUser(auth)
  if (!user) return fail(res, '请先登录', 401)

  const body = await readJson(req)
  const { serviceId, serviceName, servicePrice, date, timeSlot, customerName, phone, carModel, remark } = body
  if (!serviceId || !date || !timeSlot || !customerName || !phone || !carModel) {
    return fail(res, '请填写完整预约信息', 400)
  }
  if (!/^1\d{10}$/.test(String(phone))) {
    return fail(res, '手机号格式不正确', 400)
  }

  const service = await first('services', { _id: `eq.${serviceId}` })
  if (!service || !service.isActive) return fail(res, '服务不存在或已下架', 400)

  const { startTime, endTime } = parseTimeSlot(timeSlot)
  if (!startTime || !endTime) return fail(res, '预约时段无效', 400)

  const slot = await first('time_slots', { slotKey: `eq.${slotKey(date, startTime, endTime)}` })
    || await first('time_slots', { date: `eq.${date}`, startTime: `eq.${startTime}`, endTime: `eq.${endTime}` })
  if (!slot || !slot.isAvailable) return fail(res, '该时段不可预约', 400)
  if ((slot.bookedCount || 0) >= slot.maxCount) return fail(res, '该时段已约满，请选择其他时间', 400)

  await updateById('time_slots', slot._id, {
    bookedCount: (slot.bookedCount || 0) + 1,
    updateTime: new Date().toISOString()
  })

  const appointment = await insert('appointments', {
    _id: crypto.randomUUID(),
    _openid: auth.openid,
    userId: auth.openid,
    serviceId,
    serviceName: service.name || serviceName,
    servicePrice: service.price || servicePrice,
    date,
    timeSlot,
    status: 'pending',
    customerName,
    phone,
    carModel,
    remark: remark || '',
    createTime: new Date().toISOString()
  })

  return ok(res, {
    _id: appointment._id,
    status: 'pending',
    serviceName: appointment.serviceName,
    date,
    timeSlot
  })
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') return listAppointments(req, res)
    if (req.method === 'POST') return createAppointment(req, res)
    return methodNotAllowed(res)
  } catch (err) {
    console.error('[api/appointments] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized/.test(err.message) ? 401 : 500)
  }
}

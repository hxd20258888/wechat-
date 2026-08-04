const cloud = require('wx-server-sdk')
const { canTransition, getStatusTimestampField } = require('./statusRules')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']

function parseTimeSlot(timeSlot) {
  const [startTime, endTime] = String(timeSlot || '').split('-')
  return { startTime, endTime }
}

function getSlotKey(date, startTime, endTime) {
  return `${date}_${startTime}_${endTime}`
}

async function findSlotByAppointment(appointment) {
  const { startTime, endTime } = parseTimeSlot(appointment.timeSlot)
  if (!startTime || !endTime) return null

  const slotKey = getSlotKey(appointment.date, startTime, endTime)
  let slotRes = await db.collection('time_slots').where({ slotKey }).limit(1).get()
  if (!slotRes.data[0]) {
    slotRes = await db.collection('time_slots').where({
      date: appointment.date,
      startTime,
      endTime
    }).limit(1).get()
  }
  return slotRes.data[0] || null
}

function buildStatusUpdate(status, openid, isAdmin) {
  const data = {
    status,
    updateTime: db.serverDate(),
    operatorOpenid: openid
  }

  const timestampField = getStatusTimestampField(status)
  if (timestampField) {
    data[timestampField] = db.serverDate()
  }
  if (status === 'cancelled') {
    data.cancelBy = isAdmin ? 'admin' : 'user'
  }

  return data
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { appointmentId, status } = event

    if (!openid) {
      return { code: -1, message: '用户身份无效', data: null }
    }
    if (!appointmentId || !VALID_STATUSES.includes(status)) {
      return { code: -1, message: '预约状态无效', data: null }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const isAdmin = Boolean(userRes.data[0]?.isAdmin)
    const appointmentRes = await db.collection('appointments').doc(appointmentId).get()
    const appointment = appointmentRes.data
    if (!appointment) {
      return { code: -1, message: '预约不存在', data: null }
    }

    const isOwner = appointment._openid === openid
    if (!canTransition({ currentStatus: appointment.status, nextStatus: status, isAdmin, isOwner })) {
      return { code: -2, message: '无权限更新该预约', data: null }
    }

    const shouldRelease = appointment.status !== 'cancelled' && status === 'cancelled'
    const slot = shouldRelease ? await findSlotByAppointment(appointment) : null
    if (shouldRelease && !slot) {
      return { code: -1, message: '预约时段不存在', data: null }
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
      const currentAppointmentRes = await transaction.collection('appointments').doc(appointmentId).get()
      const currentAppointment = currentAppointmentRes.data
      if (!currentAppointment) {
        return { code: -1, message: '预约不存在', data: null }
      }

      const currentIsOwner = currentAppointment._openid === openid
      if (!canTransition({ currentStatus: currentAppointment.status, nextStatus: status, isAdmin, isOwner: currentIsOwner })) {
        return { code: -2, message: '无权限更新该预约', data: null }
      }

      const currentShouldRelease = currentAppointment.status !== 'cancelled' && status === 'cancelled'
      if (currentShouldRelease) {
        if (!slot) {
          return { code: -1, message: '预约时段不存在', data: null }
        }

        const currentSlotRes = await transaction.collection('time_slots').doc(slot._id).get()
        const currentSlot = currentSlotRes.data
        if (!currentSlot) {
          return { code: -1, message: '预约时段不存在', data: null }
        }

        await transaction.collection('time_slots').doc(slot._id).update({
          data: {
            bookedCount: (currentSlot.bookedCount || 0) > 0 ? db.command.inc(-1) : 0,
            updateTime: db.serverDate()
          }
        })
      }

      await transaction.collection('appointments').doc(appointmentId).update({
        data: buildStatusUpdate(status, openid, isAdmin)
      })

      return { code: 0, message: 'success', data: { _id: appointmentId, status } }
    })

    return transactionResult.result || transactionResult
  } catch (err) {
    console.error('[updateAppointment] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

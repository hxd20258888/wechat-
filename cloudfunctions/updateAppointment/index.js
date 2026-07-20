const cloud = require('wx-server-sdk')
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

exports.main = async (event) => {
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

    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const isAdmin = !!userRes.data[0]?.isAdmin
    const appointmentRes = await db.collection('appointments').doc(appointmentId).get()
    const appointment = appointmentRes.data
    if (!appointment) {
      return { code: -1, message: '预约不存在', data: null }
    }

    const isOwner = appointment._openid === openid
    if (!isAdmin) {
      if (!isOwner || status !== 'cancelled' || appointment.status !== 'pending') {
        return { code: -2, message: '无权限更新该预约', data: null }
      }
    }

    const previousStatus = appointment.status
    const shouldRelease = previousStatus !== 'cancelled' && status === 'cancelled'
    const shouldRebook = previousStatus === 'cancelled' && status !== 'cancelled'

    let slotId = ''
    if (shouldRelease || shouldRebook) {
      const { startTime, endTime } = parseTimeSlot(appointment.timeSlot)
      const slotKey = getSlotKey(appointment.date, startTime, endTime)
      let slotRes = await db.collection('time_slots').where({ slotKey }).limit(1).get()
      if (!slotRes.data[0]) {
        slotRes = await db.collection('time_slots').where({
          date: appointment.date,
          startTime,
          endTime
        }).limit(1).get()
      }
      const slot = slotRes.data[0]
      if (!slot) {
        return { code: -1, message: '预约时段不存在', data: null }
      }
      slotId = slot._id
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
      const currentAppointmentRes = await transaction.collection('appointments').doc(appointmentId).get()
      const currentAppointment = currentAppointmentRes.data
      if (!currentAppointment) {
        return { code: -1, message: '预约不存在', data: null }
      }

      if (!isAdmin) {
        const currentIsOwner = currentAppointment._openid === openid
        if (!currentIsOwner || status !== 'cancelled' || currentAppointment.status !== 'pending') {
          return { code: -2, message: '无权限更新该预约', data: null }
        }
      }

      const currentShouldRelease = currentAppointment.status !== 'cancelled' && status === 'cancelled'
      const currentShouldRebook = currentAppointment.status === 'cancelled' && status !== 'cancelled'

      if (currentShouldRelease || currentShouldRebook) {
        if (!slotId) {
          return { code: -1, message: '预约时段不存在', data: null }
        }

        const currentSlotRes = await transaction.collection('time_slots').doc(slotId).get()
        const currentSlot = currentSlotRes.data
        if (!currentSlot) {
          return { code: -1, message: '预约时段不存在', data: null }
        }

        if (currentShouldRebook && (currentSlot.bookedCount || 0) >= currentSlot.maxCount) {
          return { code: -1, message: '该时段已约满，请选择其他时间', data: null }
        }

        if (currentShouldRelease) {
          if ((currentSlot.bookedCount || 0) > 0) {
            await transaction.collection('time_slots').doc(slotId).update({
              data: { bookedCount: db.command.inc(-1), updateTime: db.serverDate() }
            })
          } else {
            await transaction.collection('time_slots').doc(slotId).update({
              data: { bookedCount: 0, updateTime: db.serverDate() }
            })
          }
        } else {
          await transaction.collection('time_slots').doc(slotId).update({
            data: { bookedCount: db.command.inc(1), updateTime: db.serverDate() }
          })
        }
      }

      await transaction.collection('appointments').doc(appointmentId).update({
        data: { status, updateTime: db.serverDate() }
      })

      return { code: 0, message: 'success', data: { _id: appointmentId, status } }
    })

    return transactionResult.result
  } catch (err) {
    console.error('[updateAppointment] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

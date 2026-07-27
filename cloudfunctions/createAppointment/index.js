const cloud = require('wx-server-sdk')
const { normalizeTransactionResult } = require('./defaults')
const { AUTH_REQUIRED_RESPONSE, isAuthorizedUser, buildUserSnapshot } = require('./guards')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function getSlotKey(date, startTime, endTime) {
  return date + '_' + startTime + '_' + endTime
}

exports.main = async (event = {}, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { serviceId, serviceName, servicePrice, date, timeSlot, customerName, phone, carModel, remark } = event

    if (!openid) {
      return { code: -1, message: '用户身份无效', data: null }
    }
    if (!serviceId || !date || !timeSlot || !customerName || !phone || !carModel) {
      return { code: -1, message: '请填写完整预约信息', data: null }
    }
    if (!/^1\d{10}$/.test(String(phone))) {
      return { code: -1, message: '手机号格式不正确', data: null }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const user = userRes.data[0]
    if (!isAuthorizedUser(user)) {
      return AUTH_REQUIRED_RESPONSE
    }

    const serviceRes = await db.collection('services').doc(serviceId).get()
    const service = serviceRes.data
    if (!service || !service.isActive) {
      return { code: -1, message: '服务不存在或已下架', data: null }
    }

    const [startTime, endTime] = String(timeSlot).split('-')
    if (!startTime || !endTime) {
      return { code: -1, message: '预约时段无效', data: null }
    }

    const slotKey = getSlotKey(date, startTime, endTime)
    let slotRes = await db.collection('time_slots').where({ slotKey }).limit(1).get()
    if (!slotRes.data[0]) {
      slotRes = await db.collection('time_slots').where({ date, startTime, endTime }).limit(1).get()
    }
    const slot = slotRes.data[0]
    if (!slot) {
      return { code: -1, message: '该时段不可预约', data: null }
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
      const currentServiceRes = await transaction.collection('services').doc(serviceId).get()
      const currentService = currentServiceRes.data
      if (!currentService || !currentService.isActive) {
        return { code: -1, message: '服务不存在或已下架', data: null }
      }

      const currentSlotRes = await transaction.collection('time_slots').doc(slot._id).get()
      const currentSlot = currentSlotRes.data
      if (!currentSlot || !currentSlot.isAvailable) {
        return { code: -1, message: '该时段不可预约', data: null }
      }
      if ((currentSlot.bookedCount || 0) >= currentSlot.maxCount) {
        return { code: -1, message: '该时段已约满，请选择其他时间', data: null }
      }

      await transaction.collection('time_slots').doc(slot._id).update({
        data: {
          bookedCount: db.command.inc(1),
          updateTime: db.serverDate()
        }
      })

      const addRes = await transaction.collection('appointments').add({
        data: {
          _openid: openid,
          userId: openid,
          serviceId,
          serviceName,
          servicePrice,
          date,
          timeSlot,
          status: 'pending',
          customerName,
          phone,
          carModel,
          remark: remark || '',
          createTime: db.serverDate()
        }
      })

      return {
        code: 0,
        message: 'success',
        data: {
          _id: addRes._id,
          status: 'pending',
          serviceName: currentService.name || serviceName,
          date,
          timeSlot
        }
      }
    })

    return normalizeTransactionResult(transactionResult)
  } catch (err) {
    console.error('[createAppointment] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { serviceId, serviceName, servicePrice, date, timeSlot, customerName, phone, carModel, remark } = event

    // 创建预约
    const addRes = await db.collection('appointments').add({
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

    return { code: 0, message: 'success', data: { _id: addRes._id } }
  } catch (err) {
    console.error('[createAppointment] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

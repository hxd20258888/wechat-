const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { appointmentId, status } = event

    await db.collection('appointments').doc(appointmentId).update({
      data: { status, updateTime: db.serverDate() }
    })

    return { code: 0, message: 'success', data: { _id: appointmentId, status } }
  } catch (err) {
    console.error('[updateAppointment] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

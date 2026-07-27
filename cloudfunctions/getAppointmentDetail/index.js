const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const appointmentId = String(event.appointmentId || '').trim()

    if (!openid) {
      return { code: -1, message: '用户身份无效', data: null }
    }
    if (!appointmentId) {
      return { code: -1, message: '预约参数无效', data: null }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const isAdmin = Boolean(userRes.data[0]?.isAdmin)
    const appointmentRes = await db.collection('appointments').doc(appointmentId).get()
    const appointment = appointmentRes.data

    if (!appointment) {
      return { code: -1, message: '预约不存在', data: null }
    }
    if (!isAdmin && appointment._openid !== openid) {
      return { code: -2, message: '无权限查看该预约', data: null }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        ...appointment,
        isAdminView: isAdmin
      }
    }
  } catch (err) {
    console.error('[getAppointmentDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

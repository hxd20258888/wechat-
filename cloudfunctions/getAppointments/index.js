const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { status, isAdmin } = event

    // 检查是否管理员
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const isUserAdmin = userRes.data[0]?.isAdmin || false

    let query
    if (isUserAdmin && isAdmin !== false) {
      // 管理员查看所有预约
      query = db.collection('appointments')
    } else {
      // 普通用户只看自己的
      query = db.collection('appointments').where({ _openid: openid })
    }

    if (status) {
      query = query.where({ status })
    }

    const res = await query.orderBy('createTime', 'desc').get()
    return { code: 0, message: 'success', data: res.data }
  } catch (err) {
    console.error('[getAppointments] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

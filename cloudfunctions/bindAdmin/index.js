const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const userRes = await db.collection('users').where({ _openid: openid }).get()
    if (userRes.data.length > 0) {
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: { isAdmin: true }
      })
    }

    return { code: 0, message: 'success', data: { success: true } }
  } catch (err) {
    console.error('[bindAdmin] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

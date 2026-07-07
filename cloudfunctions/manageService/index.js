const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { action, serviceId, ...data } = event

    // 检查管理员权限
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    if (!userRes.data[0]?.isAdmin) {
      return { code: -2, message: '无管理员权限', data: null }
    }

    if (action === 'create') {
      const addRes = await db.collection('services').add({
        data: { ...data, isActive: true, createTime: db.serverDate() }
      })
      return { code: 0, message: 'success', data: { _id: addRes._id } }
    } else if (action === 'update') {
      await db.collection('services').doc(serviceId).update({ data })
      return { code: 0, message: 'success', data: { _id: serviceId } }
    } else if (action === 'delete') {
      await db.collection('services').doc(serviceId).update({ data: { isActive: false } })
      return { code: 0, message: 'success', data: null }
    }

    return { code: -1, message: '未知操作', data: null }
  } catch (err) {
    console.error('[manageService] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

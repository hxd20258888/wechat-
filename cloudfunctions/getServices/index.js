const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { category } = event
    let query = db.collection('services').where({ isActive: true })
    if (category) {
      query = db.collection('services').where({ isActive: true, categoryId: category })
    }
    const res = await query.orderBy('sortOrder', 'asc').get()
    return { code: 0, message: 'success', data: res.data }
  } catch (err) {
    console.error('[getServices] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

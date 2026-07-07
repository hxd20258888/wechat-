const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  try {
    const res = await db
      .collection('categories')
      .where({ isActive: true })
      .orderBy('sortOrder', 'asc')
      .get()

    return { code: 0, message: 'success', data: res.data }
  } catch (err) {
    console.error('[getCategories] error:', err)
    return { code: -1, message: err.message || '分类服务异常', data: null }
  }
}

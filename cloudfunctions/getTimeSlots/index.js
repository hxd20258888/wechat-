const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { date } = event
    let query = db.collection('time_slots').where({ isAvailable: true })
    if (date) {
      query = db.collection('time_slots').where({ date, isAvailable: true })
    }
    const res = await query.orderBy('startTime', 'asc').get()
    return { code: 0, message: 'success', data: res.data }
  } catch (err) {
    console.error('[getTimeSlots] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

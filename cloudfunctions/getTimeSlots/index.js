const cloud = require('wx-server-sdk')
const { filterAvailableSlots, groupAvailableDates, isValidDateRange } = require('./availability')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event = {}) => {
  try {
    const { date, mode, startDate, endDate } = event

    if (mode === 'availableDates') {
      if (!startDate || !endDate || !isValidDateRange(startDate, endDate)) {
        return { code: -1, message: '日期范围无效', data: null }
      }

      const res = await db.collection('time_slots')
        .where({
          date: _.gte(startDate).and(_.lte(endDate)),
          isAvailable: true
        })
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .get()

      return { code: 0, message: 'success', data: groupAvailableDates(res.data) }
    }

    let query = db.collection('time_slots').where({ isAvailable: true })
    if (date) {
      query = db.collection('time_slots').where({ date, isAvailable: true })
    }
    const res = await query.orderBy('startTime', 'asc').get()
    return { code: 0, message: 'success', data: filterAvailableSlots(res.data) }
  } catch (err) {
    console.error('[getTimeSlots] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

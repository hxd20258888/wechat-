const { list } = require('../lib/db')
const { fail, methodNotAllowed, ok } = require('../lib/response')

function filterAvailableSlots(slots) {
  return slots.filter((slot) => (slot.bookedCount || 0) < slot.maxCount)
}

function groupAvailableDates(slots) {
  const counts = new Map()
  filterAvailableSlots(slots).forEach((slot) => {
    counts.set(slot.date, (counts.get(slot.date) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([date, availableCount]) => ({ date, availableCount }))
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res)
  try {
    const { date, mode, startDate, endDate } = req.query
    const query = {
      isAvailable: 'eq.true',
      order: 'date.asc,startTime.asc'
    }

    if (mode === 'availableDates') {
      if (!startDate || !endDate) return fail(res, '日期范围无效', 400)
      query.date = `gte.${startDate}`
      query.and = `(date.lte.${endDate})`
      const slots = await list('time_slots', query)
      return ok(res, groupAvailableDates(slots))
    }

    if (date) query.date = `eq.${date}`
    const slots = await list('time_slots', query)
    return ok(res, filterAvailableSlots(slots))
  } catch (err) {
    console.error('[api/time-slots] error:', err)
    return fail(res, err.message || '服务异常', 500)
  }
}

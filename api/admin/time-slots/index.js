const crypto = require('crypto')
const { requireAdmin } = require('../../lib/admin')
const { first, insert, updateById } = require('../../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../../lib/response')

function getSlotKey(slot) {
  return `${slot.date}_${slot.startTime}_${slot.endTime}`
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function getFutureDates(days = 14) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return date
  })
}

async function createWeeklySlots(configs = []) {
  let generatedCount = 0
  let updatedCount = 0
  const activeConfigs = configs.filter((config) => config.isActive)
  for (const date of getFutureDates()) {
    const config = activeConfigs.find((item) => item.dayOfWeek === date.getDay())
    if (!config) continue
    const dateText = formatDate(date)
    const key = `${dateText}_${config.startTime}_${config.endTime}`
    const existing = await first('time_slots', { slotKey: `eq.${key}` })
    const payload = {
      date: dateText,
      startTime: config.startTime,
      endTime: config.endTime,
      maxCount: config.maxCount || 1,
      isAvailable: true,
      slotKey: key,
      updateTime: new Date().toISOString()
    }
    if (existing) {
      await updateById('time_slots', existing._id, payload)
      updatedCount += 1
    } else {
      await insert('time_slots', {
        _id: crypto.randomUUID(),
        ...payload,
        bookedCount: 0,
        createTime: new Date().toISOString()
      })
      generatedCount += 1
    }
  }
  return { generatedCount, updatedCount, closedCount: 0 }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const body = await readJson(req)
    if (body.action === 'updateWeekly') {
      return ok(res, await createWeeklySlots(body.configs || []))
    }

    const slot = await insert('time_slots', {
      _id: crypto.randomUUID(),
      ...body,
      slotKey: body.slotKey || getSlotKey(body),
      bookedCount: body.bookedCount || 0,
      isAvailable: body.isAvailable !== false,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    })
    return ok(res, slot)
  } catch (err) {
    console.error('[api/admin/time-slots] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized|Admin required/.test(err.message) ? 401 : 500)
  }
}

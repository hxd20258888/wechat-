const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextDates(count) {
  const dates = []
  const now = new Date()
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now)
    date.setDate(now.getDate() + i)
    dates.push({
      date: formatDateKey(date),
      dayOfWeek: date.getDay()
    })
  }
  return dates
}

function getSlotKey(date, startTime, endTime) {
  return date + '_' + startTime + '_' + endTime
}

function getSlotIdentity(date, startTime, endTime) {
  const slotKey = getSlotKey(date, startTime, endTime)
  return { slotKey, timeNum: slotKey }
}

function normalizeWeeklyConfigs(configs) {
  if (!Array.isArray(configs)) return []
  return configs
    .filter(config => Number.isInteger(config.dayOfWeek))
    .map(config => ({
      dayOfWeek: config.dayOfWeek,
      isActive: !!config.isActive,
      startTime: String(config.startTime || '').trim(),
      endTime: String(config.endTime || '').trim(),
      maxCount: Number(config.maxCount || 1)
    }))
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { action, slotId, ...data } = event

    // 妫€鏌ョ鐞嗗憳鏉冮檺
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    if (!userRes.data[0]?.isAdmin) {
      return { code: -2, message: '鏃犵鐞嗗憳鏉冮檺', data: null }
    }

    if (action === 'updateWeekly') {
      const configs = normalizeWeeklyConfigs(data.configs)
      const dates = getNextDates(14)
      let generatedCount = 0
      let updatedCount = 0
      let closedCount = 0

      for (const config of configs) {
        const matchingDates = dates.filter(item => item.dayOfWeek === config.dayOfWeek)
        for (const dateItem of matchingDates) {
          const slotIdentity = getSlotIdentity(dateItem.date, config.startTime, config.endTime)
          const slotKey = slotIdentity.slotKey
          const existingRes = await db.collection('time_slots').where({ slotKey }).get()
          const existing = existingRes.data[0]

          if (config.isActive && config.startTime && config.endTime) {
            if (existing) {
              await db.collection('time_slots').doc(existing._id).update({
                data: {
                  maxCount: config.maxCount,
                  isAvailable: true,
                  ...slotIdentity,
                  source: 'weekly',
                  weeklyDayOfWeek: config.dayOfWeek,
                  updateTime: db.serverDate()
                }
              })
              updatedCount += 1
              for (const duplicate of existingRes.data.slice(1)) {
                await db.collection('time_slots').doc(duplicate._id).update({
                  data: { isAvailable: false, updateTime: db.serverDate(), duplicateOf: existing._id }
                })
                closedCount += 1
              }
            } else {
              await db.collection('time_slots').add({
                data: {
                  date: dateItem.date,
                  startTime: config.startTime,
                  endTime: config.endTime,
                  ...slotIdentity,
                  maxCount: config.maxCount,
                  bookedCount: 0,
                  isAvailable: true,
                  source: 'weekly',
                  weeklyDayOfWeek: config.dayOfWeek,
                  createTime: db.serverDate()
                }
              })
              generatedCount += 1
            }
          }
        }

        if (config.isActive && config.startTime && config.endTime) {
          for (const dateItem of matchingDates) {
            const obsoleteRes = await db.collection('time_slots').where({
              date: dateItem.date,
              source: 'weekly',
              weeklyDayOfWeek: config.dayOfWeek,
              isAvailable: true
            }).get()
            const activeSlotKey = getSlotKey(dateItem.date, config.startTime, config.endTime)
            for (const slot of obsoleteRes.data) {
              if ((slot.slotKey || getSlotKey(slot.date, slot.startTime, slot.endTime)) !== activeSlotKey) {
                await db.collection('time_slots').doc(slot._id).update({
                  data: { isAvailable: false, updateTime: db.serverDate() }
                })
                closedCount += 1
              }
            }
          }
        }

        if (!config.isActive) {
          for (const dateItem of matchingDates) {
            const slotsRes = await db.collection('time_slots').where({
              date: dateItem.date,
              source: 'weekly',
              weeklyDayOfWeek: config.dayOfWeek
            }).get()
            for (const slot of slotsRes.data) {
              if (slot.isAvailable) {
                await db.collection('time_slots').doc(slot._id).update({
                  data: { isAvailable: false, updateTime: db.serverDate() }
                })
                closedCount += 1
              }
            }
          }
        }
      }

      return { code: 0, message: 'success', data: { generatedCount, updatedCount, closedCount } }
    }

    if (action === 'create') {
      const addRes = await db.collection('time_slots').add({
        data: {
          ...data,
          ...getSlotIdentity(data.date, data.startTime, data.endTime),
          bookedCount: 0,
          isAvailable: true,
          createTime: db.serverDate()
        }
      })
      return { code: 0, message: 'success', data: { _id: addRes._id } }
    } else if (action === 'update') {
      const updateData = { ...data }
      if (updateData.date || updateData.startTime || updateData.endTime) {
        const existingRes = await db.collection('time_slots').doc(slotId).get()
        const existing = existingRes.data || {}
        const nextDate = updateData.date || existing.date
        const nextStart = updateData.startTime || existing.startTime
        const nextEnd = updateData.endTime || existing.endTime
        if (nextDate && nextStart && nextEnd) {
          Object.assign(updateData, getSlotIdentity(nextDate, nextStart, nextEnd))
        }
      }
      await db.collection('time_slots').doc(slotId).update({ data: updateData })
      return { code: 0, message: 'success', data: { _id: slotId } }
    }

    return { code: -1, message: '鏈煡鎿嶄綔', data: null }
  } catch (err) {
    console.error('[manageTimeSlot] error:', err)
    return { code: -1, message: err.message || '鏈嶅姟寮傚父', data: null }
  }
}



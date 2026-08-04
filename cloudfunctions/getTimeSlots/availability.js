function isSlotAvailable(slot) {
  return Boolean(
    slot &&
    slot.isAvailable === true &&
    Number(slot.maxCount || 0) > 0 &&
    Number(slot.bookedCount || 0) < Number(slot.maxCount || 0)
  )
}

function filterAvailableSlots(slots) {
  return (Array.isArray(slots) ? slots : []).filter(isSlotAvailable)
}

function groupAvailableDates(slots) {
  const counts = new Map()
  filterAvailableSlots(slots).forEach((slot) => {
    if (!slot.date) return
    counts.set(slot.date, (counts.get(slot.date) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, availableCount]) => ({ date, availableCount }))
}

function isValidDateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  if (end < start) return false
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return diffDays <= 30
}

module.exports = {
  filterAvailableSlots,
  groupAvailableDates,
  isValidDateRange
}

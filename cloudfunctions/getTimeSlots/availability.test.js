const test = require('node:test')
const assert = require('node:assert/strict')
const { filterAvailableSlots, groupAvailableDates, isValidDateRange } = require('./availability')

test('filters only open not-full slots', () => {
  const slots = [
    { date: '2026-07-25', isAvailable: true, bookedCount: 0, maxCount: 1 },
    { date: '2026-07-25', isAvailable: true, bookedCount: 1, maxCount: 1 },
    { date: '2026-07-26', isAvailable: false, bookedCount: 0, maxCount: 1 }
  ]
  assert.deepEqual(filterAvailableSlots(slots), [slots[0]])
})

test('groups available slots by date', () => {
  const slots = [
    { date: '2026-07-25', isAvailable: true, bookedCount: 0, maxCount: 2 },
    { date: '2026-07-25', isAvailable: true, bookedCount: 1, maxCount: 2 },
    { date: '2026-07-26', isAvailable: true, bookedCount: 0, maxCount: 1 }
  ]
  assert.deepEqual(groupAvailableDates(slots), [
    { date: '2026-07-25', availableCount: 2 },
    { date: '2026-07-26', availableCount: 1 }
  ])
})

test('limits available date ranges to 31 days', () => {
  assert.equal(isValidDateRange('2026-07-25', '2026-08-24'), true)
  assert.equal(isValidDateRange('2026-07-25', '2026-08-25'), false)
})

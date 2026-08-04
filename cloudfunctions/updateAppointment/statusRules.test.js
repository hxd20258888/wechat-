const test = require('node:test')
const assert = require('node:assert/strict')
const { canTransition, getStatusTimestampField } = require('./statusRules')

test('owner can cancel pending and confirmed appointments', () => {
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), true)
  assert.equal(canTransition({ currentStatus: 'confirmed', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), true)
})

test('owner cannot cancel completed or other users appointments', () => {
  assert.equal(canTransition({ currentStatus: 'completed', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), false)
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'cancelled', isAdmin: false, isOwner: false }), false)
})

test('admin can only use whitelisted state transitions', () => {
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'confirmed', isAdmin: true, isOwner: false }), true)
  assert.equal(canTransition({ currentStatus: 'confirmed', nextStatus: 'completed', isAdmin: true, isOwner: false }), true)
  assert.equal(canTransition({ currentStatus: 'cancelled', nextStatus: 'confirmed', isAdmin: true, isOwner: false }), false)
  assert.equal(canTransition({ currentStatus: 'completed', nextStatus: 'cancelled', isAdmin: true, isOwner: false }), false)
})

test('repeated cancelled update is idempotent for owner and admin', () => {
  assert.equal(canTransition({ currentStatus: 'cancelled', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), true)
  assert.equal(canTransition({ currentStatus: 'cancelled', nextStatus: 'cancelled', isAdmin: true, isOwner: false }), true)
})

test('returns timestamp field for terminal status updates', () => {
  assert.equal(getStatusTimestampField('confirmed'), 'confirmedTime')
  assert.equal(getStatusTimestampField('completed'), 'completedTime')
  assert.equal(getStatusTimestampField('cancelled'), 'cancelTime')
  assert.equal(getStatusTimestampField('pending'), '')
})

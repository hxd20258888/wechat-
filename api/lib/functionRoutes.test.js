const test = require('node:test')
const assert = require('node:assert/strict')

const { resolveFunctionRoute } = require('./functionRoutes')

test('maps read-only cloud functions to GET endpoints with query params', () => {
  assert.deepEqual(resolveFunctionRoute('getServices', { category: 'audio' }), {
    method: 'GET',
    path: '/api/services',
    query: { category: 'audio' },
    body: undefined
  })

  assert.deepEqual(resolveFunctionRoute('getTimeSlots', { date: '2026-08-04' }), {
    method: 'GET',
    path: '/api/time-slots',
    query: { date: '2026-08-04' },
    body: undefined
  })
})

test('maps mutating cloud functions to write endpoints with request bodies', () => {
  assert.deepEqual(resolveFunctionRoute('createAppointment', { serviceId: 'svc_1' }), {
    method: 'POST',
    path: '/api/appointments',
    query: undefined,
    body: { serviceId: 'svc_1' }
  })

  assert.deepEqual(resolveFunctionRoute('updateAppointment', { appointmentId: 'apt_1', status: 'confirmed' }), {
    method: 'PUT',
    path: '/api/appointments/apt_1',
    query: undefined,
    body: { status: 'confirmed' }
  })
})

test('rejects unknown cloud function names', () => {
  assert.throws(() => resolveFunctionRoute('missingFunction'), /Unsupported function/)
})

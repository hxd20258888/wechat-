const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeTransactionResult } = require('./defaults')

test('uses transaction callback return directly when SDK returns it directly', () => {
  const response = { code: 0, message: 'success', data: { _id: 'apt1' } }
  assert.deepEqual(normalizeTransactionResult(response), response)
})

test('uses nested result when SDK wraps transaction return', () => {
  const response = { code: 0, message: 'success', data: { _id: 'apt1' } }
  assert.deepEqual(normalizeTransactionResult({ result: response }), response)
})

test('returns a clear error when transaction result is empty', () => {
  assert.deepEqual(normalizeTransactionResult(null), {
    code: -1,
    message: '预约提交失败，请重试',
    data: null
  })
})

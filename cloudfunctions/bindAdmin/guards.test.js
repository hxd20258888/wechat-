const test = require('node:test')
const assert = require('node:assert/strict')
const { canBindAdmin, ADMIN_AUTH_REQUIRED_RESPONSE } = require('./guards')

test('requires an existing authorized user before admin binding', () => {
  assert.equal(canBindAdmin(null), false)
  assert.equal(canBindAdmin({ nickname: '', avatar: '' }), false)
  assert.equal(canBindAdmin({ nickname: '微信用户', avatar: 'default' }), false)
  assert.equal(canBindAdmin({ nickname: '小李', avatar: 'cloud://avatar.png' }), true)
})

test('returns clear admin authorization message', () => {
  assert.deepEqual(ADMIN_AUTH_REQUIRED_RESPONSE, {
    code: -2,
    message: '请先完成微信授权后再绑定管理员',
    data: null
  })
})

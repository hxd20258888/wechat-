const test = require('node:test')
const assert = require('node:assert/strict')
const { isAuthorizedUser, buildUserSnapshot, AUTH_REQUIRED_RESPONSE } = require('./guards')

test('rejects missing user for appointment creation', () => {
  assert.equal(isAuthorizedUser(null), false)
  assert.deepEqual(AUTH_REQUIRED_RESPONSE, {
    code: -2,
    message: '请先完成微信授权后再预约',
    data: null
  })
})

test('rejects default or empty profile user for appointment creation', () => {
  assert.equal(isAuthorizedUser({ nickname: '', avatar: '' }), false)
  assert.equal(isAuthorizedUser({ nickname: '微信用户', avatar: 'default' }), false)
})

test('builds appointment user snapshot from authorized profile', () => {
  const user = { nickname: '小李', avatar: 'cloud://avatar.png' }
  assert.equal(isAuthorizedUser(user), true)
  assert.deepEqual(buildUserSnapshot(user), {
    nickname: '小李',
    avatar: 'cloud://avatar.png'
  })
})

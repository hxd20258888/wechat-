const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test-secret-with-at-least-32-chars'

const {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken
} = require('./auth')

test('creates verifiable access tokens with user identity claims', () => {
  const token = createAccessToken({ userId: 'user_1', openid: 'openid_1', isAdmin: true })
  const payload = verifyAccessToken(token)

  assert.equal(payload.userId, 'user_1')
  assert.equal(payload.openid, 'openid_1')
  assert.equal(payload.isAdmin, true)
  assert.equal(payload.type, 'access')
})

test('creates opaque refresh tokens and stable hashes', () => {
  const token = createRefreshToken()

  assert.match(token, /^[a-f0-9]{64}$/)
  assert.equal(hashToken(token), hashToken(token))
  assert.notEqual(hashToken(token), token)
})

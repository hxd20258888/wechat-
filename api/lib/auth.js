const crypto = require('crypto')

const ACCESS_EXPIRES_SECONDS = 2 * 60 * 60

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 24) {
    throw new Error('JWT_SECRET must be configured')
  }
  return secret
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function fromBase64url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(value)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createAccessToken({ userId, openid, isAdmin = false }) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    type: 'access',
    userId,
    openid,
    isAdmin,
    iat: now,
    exp: now + ACCESS_EXPIRES_SECONDS
  }))
  const unsigned = `${header}.${payload}`
  return `${unsigned}.${sign(unsigned)}`
}

function verifyAccessToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('Invalid token')

  const [header, payload, signature] = parts
  const unsigned = `${header}.${payload}`
  if (signature !== sign(unsigned)) throw new Error('Invalid token signature')

  const decoded = JSON.parse(fromBase64url(payload))
  if (decoded.type !== 'access') throw new Error('Invalid token type')
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return decoded
}

function createRefreshToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : ''
}

function requireAuth(req) {
  const token = getBearerToken(req)
  if (!token) throw new Error('Unauthorized')
  return verifyAccessToken(token)
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  getBearerToken,
  hashToken,
  requireAuth,
  verifyAccessToken
}

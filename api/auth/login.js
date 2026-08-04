const crypto = require('crypto')
const { createAccessToken, createRefreshToken, hashToken } = require('../lib/auth')
const { first, insert, updateById } = require('../lib/db')
const { buildLoginDecision } = require('../lib/profile')
const { fail, methodNotAllowed, ok, readJson } = require('../lib/response')
const { code2Session } = require('../lib/wx')

function encryptSessionKey(sessionKey) {
  if (!sessionKey) return ''
  const secret = process.env.SESSION_KEY_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('SESSION_KEY_SECRET or JWT_SECRET must be configured')
  const key = crypto.createHash('sha256').update(secret).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(sessionKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

async function saveIdentity(user, wxSession) {
  const existing = await first('user_identities', {
    platform: 'eq.wechat',
    platform_user_id: `eq.${wxSession.openid}`
  })
  const body = {
    user_id: user._id,
    platform: 'wechat',
    platform_user_id: wxSession.openid,
    unionid: wxSession.unionid,
    session_key_encrypted: encryptSessionKey(wxSession.sessionKey),
    updateTime: new Date().toISOString()
  }
  if (existing) {
    await updateById('user_identities', existing._id, body)
  } else {
    await insert('user_identities', { _id: crypto.randomUUID(), ...body, createTime: new Date().toISOString() })
  }
}

async function createSession(user, refreshToken, req) {
  await insert('user_sessions', {
    _id: crypto.randomUUID(),
    user_id: user._id,
    refresh_token_hash: hashToken(refreshToken),
    platform: 'wechat',
    user_agent: req.headers['user-agent'] || '',
    ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString()
  })
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    const body = await readJson(req)
    const wxSession = await code2Session(body.code)
    const mode = body.mode || 'check'
    const currentUser = await first('users', { _openid: `eq.${wxSession.openid}` })
    const decision = buildLoginDecision(mode, currentUser, body)
    let user = currentUser

    if (mode === 'check') {
      if (user) await saveIdentity(user, wxSession)
    } else if (mode === 'create' && decision.shouldCreate) {
      user = await insert('users', {
        _id: crypto.randomUUID(),
        _openid: wxSession.openid,
        ...decision.profile,
        phone: '',
        isAdmin: false,
        createTime: new Date().toISOString()
      })
      await saveIdentity(user, wxSession)
    } else if ((mode === 'create' || mode === 'updateProfile') && user) {
      user = await updateById('users', user._id, {
        ...decision.profile,
        updateTime: new Date().toISOString()
      })
      await saveIdentity(user, wxSession)
    }

    if (!user) {
      return ok(res, { ...decision.response, accessToken: '', refreshToken: '' })
    }

    const accessToken = createAccessToken({ userId: user._id, openid: wxSession.openid, isAdmin: Boolean(user.isAdmin) })
    const refreshToken = createRefreshToken()
    await createSession(user, refreshToken, req)

    return ok(res, {
      isNewUser: false,
      user,
      accessToken,
      refreshToken,
      expiresIn: 7200
    })
  } catch (err) {
    console.error('[api/auth/login] error:', err)
    return fail(res, err.message || '登录失败', 500)
  }
}

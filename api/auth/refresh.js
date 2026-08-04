const { createAccessToken, createRefreshToken, hashToken } = require('../lib/auth')
const { first, insert, updateById } = require('../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../lib/response')
const crypto = require('crypto')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    const { refreshToken } = await readJson(req)
    if (!refreshToken) return fail(res, 'refreshToken required', 400)

    const now = new Date().toISOString()
    const session = await first('user_sessions', {
      refresh_token_hash: `eq.${hashToken(refreshToken)}`,
      revoked_at: 'is.null',
      expires_at: `gt.${now}`
    })
    if (!session) return fail(res, 'Refresh token invalid or expired', 401, 40100)

    const user = await first('users', { _id: `eq.${session.user_id}` })
    if (!user || user.status === 0) return fail(res, 'User disabled', 401, 40101)

    await updateById('user_sessions', session._id, {
      revoked_at: now,
      updateTime: now
    })

    const nextRefreshToken = createRefreshToken()
    await insert('user_sessions', {
      _id: crypto.randomUUID(),
      user_id: user._id,
      refresh_token_hash: hashToken(nextRefreshToken),
      platform: session.platform || 'wechat',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createTime: now,
      updateTime: now
    })

    const accessToken = createAccessToken({ userId: user._id, openid: user._openid, isAdmin: Boolean(user.isAdmin) })
    return ok(res, { accessToken, refreshToken: nextRefreshToken, expiresIn: 7200 })
  } catch (err) {
    console.error('[api/auth/refresh] error:', err)
    return fail(res, err.message || '刷新登录失败', 500)
  }
}

const { requireAuth } = require('../lib/auth')
const { first, insert, updateById } = require('../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../lib/response')
const crypto = require('crypto')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const auth = requireAuth(req)
    const { inviteCode } = await readJson(req)
    if (!inviteCode) return fail(res, '请输入邀请码', 400)

    const user = await first('users', { _id: `eq.${auth.userId}` })
    if (!user) return fail(res, '请先完善资料', 401)
    if (user.isAdmin) return ok(res, { isAdmin: true })

    const invite = await first('admin_invites', {
      code: `eq.${inviteCode}`,
      isActive: 'eq.true'
    })
    if (!invite) return fail(res, '邀请码无效', 400)
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return fail(res, '邀请码已过期', 400)
    }
    if (invite.maxUses && (invite.usedCount || 0) >= invite.maxUses) {
      return fail(res, '邀请码已达到使用次数', 400)
    }

    await updateById('admin_invites', invite._id, {
      usedCount: (invite.usedCount || 0) + 1,
      updateTime: new Date().toISOString()
    })
    await updateById('users', user._id, {
      isAdmin: true,
      updateTime: new Date().toISOString()
    })
    await insert('admin_invite_logs', {
      _id: crypto.randomUUID(),
      _openid: auth.openid,
      inviteId: invite._id,
      result: 'success',
      usedAt: new Date().toISOString()
    })

    return ok(res, { isAdmin: true })
  } catch (err) {
    console.error('[api/admin/bind] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized/.test(err.message) ? 401 : 500)
  }
}

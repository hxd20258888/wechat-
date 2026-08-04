const cloud = require('wx-server-sdk')
const { ADMIN_AUTH_REQUIRED_RESPONSE, canBindAdmin } = require('./guards')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

async function logInviteAttempt(openid, inviteId, result) {
  try {
    await db.collection('admin_invite_logs').add({
      data: { _openid: openid, inviteId, result, usedAt: db.serverDate() }
    })
  } catch (err) {
    console.error('[bindAdmin] audit log error:', err)
  }
}

exports.main = async (event = {}) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const inviteCode = String(event.inviteCode || '').trim()

    if (!openid) {
      return { code: -1, message: '用户身份无效', data: null }
    }
    if (!inviteCode) {
      return { code: -1, message: '请输入邀请码', data: null }
    }

    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get()
    const existingUser = userRes.data[0]
    if (!canBindAdmin(existingUser)) {
      await logInviteAttempt(openid, '', 'auth_required')
      return ADMIN_AUTH_REQUIRED_RESPONSE
    }
    if (existingUser.isAdmin) {
      return { code: 0, message: 'success', data: { isAdmin: true } }
    }

    const inviteRes = await db.collection('admin_invites').where({
      code: inviteCode,
      isActive: true
    }).limit(1).get()
    const invite = inviteRes.data[0]

    if (!invite) {
      await logInviteAttempt(openid, '', 'invalid_code')
      return { code: -1, message: '邀请码无效', data: null }
    }

    const transactionResult = await db.runTransaction(async (transaction) => {
      const currentInviteRes = await transaction.collection('admin_invites').doc(invite._id).get()
      const currentInvite = currentInviteRes.data

      if (!currentInvite || currentInvite.code !== inviteCode || !currentInvite.isActive) {
        return { result: 'invalid_code' }
      }
      if (isExpired(currentInvite.expiresAt)) {
        return { result: 'expired' }
      }
      if (currentInvite.maxUses && (currentInvite.usedCount || 0) >= currentInvite.maxUses) {
        return { result: 'max_uses_reached' }
      }

      const currentUserRes = await transaction.collection('users').doc(existingUser._id).get()
      const currentUser = currentUserRes.data
      if (!canBindAdmin(currentUser)) {
        return { result: 'auth_required' }
      }
      if (currentUser.isAdmin) {
        return { result: 'already_admin' }
      }

      await transaction.collection('admin_invites').doc(currentInvite._id).update({
        data: {
          usedCount: db.command.inc(1),
          updatedAt: db.serverDate()
        }
      })
      await transaction.collection('users').doc(currentUser._id).update({
        data: { isAdmin: true, updateTime: db.serverDate() }
      })
      await transaction.collection('admin_invite_logs').add({
        data: { _openid: openid, inviteId: currentInvite._id, result: 'success', usedAt: db.serverDate() }
      })

      return { result: 'success' }
    })

    const bindResult = transactionResult.result || transactionResult
    if (bindResult.result === 'already_admin' || bindResult.result === 'success') {
      return { code: 0, message: 'success', data: { isAdmin: true } }
    }
    if (bindResult.result === 'auth_required') {
      await logInviteAttempt(openid, invite._id, 'auth_required')
      return ADMIN_AUTH_REQUIRED_RESPONSE
    }

    await logInviteAttempt(openid, invite._id, bindResult.result)
    if (bindResult.result === 'expired') {
      return { code: -1, message: '邀请码已过期', data: null }
    }
    if (bindResult.result === 'max_uses_reached') {
      return { code: -1, message: '邀请码已达到使用次数', data: null }
    }
    return { code: -1, message: '邀请码无效', data: null }
  } catch (err) {
    console.error('[bindAdmin] error:', err)
    if (err && /duplicate|E11000|唯一|unique/i.test(String(err.message || err.errMsg || ''))) {
      return { code: -1, message: '管理员绑定冲突，请稍后重试', data: null }
    }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

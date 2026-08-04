const { requireAuth } = require('../lib/auth')
const { first, updateById } = require('../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../lib/response')

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']

function canTransition({ currentStatus, nextStatus, isAdmin, isOwner }) {
  if (!VALID_STATUSES.includes(nextStatus)) return false
  if (isAdmin) return true
  if (!isOwner) return false
  return currentStatus === 'pending' && nextStatus === 'cancelled'
}

async function getAppointment(req) {
  const id = req.query.id
  if (!id) throw new Error('预约参数无效')
  const appointment = await first('appointments', { _id: `eq.${id}` })
  if (!appointment) throw new Error('预约不存在')
  return appointment
}

module.exports = async function handler(req, res) {
  try {
    const auth = requireAuth(req)
    const user = await first('users', { _id: `eq.${auth.userId}` })
    const isAdmin = Boolean(user?.isAdmin)
    const appointment = await getAppointment(req)
    const isOwner = appointment._openid === auth.openid

    if (req.method === 'GET') {
      if (!isAdmin && !isOwner) return fail(res, '无权限查看该预约', 403, -2)
      return ok(res, { ...appointment, isAdminView: isAdmin })
    }

    if (req.method === 'PUT') {
      const { status } = await readJson(req)
      if (!canTransition({ currentStatus: appointment.status, nextStatus: status, isAdmin, isOwner })) {
        return fail(res, '无权限更新该预约', 403, -2)
      }
      const updateData = {
        status,
        updateTime: new Date().toISOString(),
        operatorOpenid: auth.openid
      }
      if (status === 'cancelled') updateData.cancelBy = isAdmin ? 'admin' : 'user'
      await updateById('appointments', appointment._id, updateData)
      return ok(res, { _id: appointment._id, status })
    }

    return methodNotAllowed(res)
  } catch (err) {
    console.error('[api/appointments/:id] error:', err)
    const status = /Unauthorized/.test(err.message) ? 401 : 500
    return fail(res, err.message || '服务异常', status)
  }
}

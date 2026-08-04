const { requireAuth } = require('../lib/auth')
const { first } = require('../lib/db')
const { fail, methodNotAllowed, ok } = require('../lib/response')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res)
  try {
    const auth = requireAuth(req)
    const user = await first('users', { _id: `eq.${auth.userId}` })
    return ok(res, { isAdmin: Boolean(user?.isAdmin) })
  } catch (err) {
    console.error('[api/admin/check] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized/.test(err.message) ? 401 : 500)
  }
}

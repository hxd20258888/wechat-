const { requireAuth } = require('./auth')
const { first } = require('./db')

async function requireAdmin(req) {
  const auth = requireAuth(req)
  const user = await first('users', { _id: `eq.${auth.userId}` })
  if (!user?.isAdmin) throw new Error('Admin required')
  return { auth, user }
}

module.exports = { requireAdmin }

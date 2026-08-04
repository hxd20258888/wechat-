const { list } = require('../lib/db')
const { fail, methodNotAllowed, ok } = require('../lib/response')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res)
  try {
    const query = {
      isActive: 'eq.true',
      order: 'sortOrder.asc'
    }
    if (req.query.category) query.categoryId = `eq.${req.query.category}`
    const data = await list('services', query)
    return ok(res, data)
  } catch (err) {
    console.error('[api/services] error:', err)
    return fail(res, err.message || '服务异常', 500)
  }
}

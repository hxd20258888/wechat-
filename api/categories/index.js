const { list } = require('../lib/db')
const { fail, methodNotAllowed, ok } = require('../lib/response')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res)
  try {
    const data = await list('categories', {
      isActive: 'eq.true',
      order: 'sortOrder.asc'
    })
    return ok(res, data)
  } catch (err) {
    console.error('[api/categories] error:', err)
    return fail(res, err.message || '分类服务异常', 500)
  }
}

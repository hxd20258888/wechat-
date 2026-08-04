const { requireAdmin } = require('../../lib/admin')
const { softDeleteById, updateById } = require('../../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../../lib/response')

module.exports = async function handler(req, res) {
  try {
    await requireAdmin(req)
    const id = req.query.id
    if (!id) return fail(res, '服务参数无效', 400)

    if (req.method === 'PUT') {
      const body = await readJson(req)
      const service = await updateById('services', id, { ...body, updateTime: new Date().toISOString() })
      return ok(res, service)
    }
    if (req.method === 'DELETE') {
      await softDeleteById('services', id)
      return ok(res, { _id: id })
    }
    return methodNotAllowed(res)
  } catch (err) {
    console.error('[api/admin/services/:id] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized|Admin required/.test(err.message) ? 401 : 500)
  }
}

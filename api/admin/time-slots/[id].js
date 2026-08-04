const { requireAdmin } = require('../../lib/admin')
const { updateById } = require('../../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../../lib/response')

module.exports = async function handler(req, res) {
  try {
    await requireAdmin(req)
    const id = req.query.id
    if (!id) return fail(res, '时间段参数无效', 400)

    if (req.method === 'PUT') {
      const body = await readJson(req)
      const slot = await updateById('time_slots', id, { ...body, updateTime: new Date().toISOString() })
      return ok(res, slot)
    }
    if (req.method === 'DELETE') {
      await updateById('time_slots', id, { isAvailable: false, updateTime: new Date().toISOString() })
      return ok(res, { _id: id })
    }
    return methodNotAllowed(res)
  } catch (err) {
    console.error('[api/admin/time-slots/:id] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized|Admin required/.test(err.message) ? 401 : 500)
  }
}

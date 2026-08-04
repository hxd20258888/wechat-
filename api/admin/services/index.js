const crypto = require('crypto')
const { requireAdmin } = require('../../lib/admin')
const { insert } = require('../../lib/db')
const { fail, methodNotAllowed, ok, readJson } = require('../../lib/response')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const body = await readJson(req)
    const service = await insert('services', {
      _id: crypto.randomUUID(),
      ...body,
      isActive: body.isActive !== false,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    })
    return ok(res, service)
  } catch (err) {
    console.error('[api/admin/services] error:', err)
    return fail(res, err.message || '服务异常', /Unauthorized|Admin required/.test(err.message) ? 401 : 500)
  }
}

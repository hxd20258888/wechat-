function ok(res, data = null, message = 'success') {
  return res.status(200).json({ code: 0, message, data })
}

function fail(res, message = '请求失败', status = 400, code = -1, data = null) {
  return res.status(status).json({ code, message, data })
}

function methodNotAllowed(res) {
  return fail(res, 'Method Not Allowed', 405)
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

module.exports = { fail, methodNotAllowed, ok, readJson }

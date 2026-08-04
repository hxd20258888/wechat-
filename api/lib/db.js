function getConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured')
  }
  return { url: url.replace(/\/$/, ''), key }
}

function encodeFilter(value) {
  return encodeURIComponent(String(value))
}

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function request(table, options = {}) {
  const { url, key } = getConfig()
  const method = options.method || 'GET'
  const path = options.path || table
  const query = buildQuery(options.query)
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=representation'
  }

  const res = await fetch(`${url}/rest/v1/${path}${query}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Supabase request failed: ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

async function list(table, query = {}) {
  return request(table, { query })
}

async function first(table, query = {}) {
  const data = await request(table, { query: { ...query, limit: 1 } })
  return data[0] || null
}

async function insert(table, body) {
  const rows = await request(table, { method: 'POST', body })
  return Array.isArray(rows) ? rows[0] : rows
}

async function updateById(table, id, body) {
  const rows = await request(table, {
    method: 'PATCH',
    query: { _id: `eq.${id}` },
    body
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function softDeleteById(table, id) {
  return updateById(table, id, { isActive: false, updateTime: new Date().toISOString() })
}

module.exports = {
  encodeFilter,
  first,
  insert,
  list,
  request,
  softDeleteById,
  updateById
}

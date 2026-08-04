import Taro from '@tarojs/taro'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RouteConfig {
  method: HttpMethod
  path: string
  query?: Record<string, any>
  body?: Record<string, any>
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

function getBaseUrl() {
  return (process.env.TARO_APP_API_BASE_URL || '').replace(/\/$/, '')
}

function buildQuery(query?: Record<string, any>) {
  if (!query) return ''
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return search ? `?${search}` : ''
}

function resolveRoute(name: string, data: Record<string, any> = {}): RouteConfig {
  const readRoutes: Record<string, RouteConfig> = {
    checkAdmin: { method: 'GET', path: '/api/admin/check', query: data },
    getAppointments: { method: 'GET', path: '/api/appointments', query: data },
    getCategories: { method: 'GET', path: '/api/categories', query: data },
    getServices: { method: 'GET', path: '/api/services', query: data },
    getTimeSlots: { method: 'GET', path: '/api/time-slots', query: data }
  }
  if (readRoutes[name]) return readRoutes[name]

  if (name === 'login') return { method: 'POST', path: '/api/auth/login', body: data }
  if (name === 'bindAdmin') return { method: 'POST', path: '/api/admin/bind', body: data }
  if (name === 'createAppointment') return { method: 'POST', path: '/api/appointments', body: data }
  if (name === 'getAppointmentDetail') {
    return { method: 'GET', path: `/api/appointments/${encodeURIComponent(data.appointmentId || '')}` }
  }
  if (name === 'updateAppointment') {
    const { appointmentId, ...body } = data
    return { method: 'PUT', path: `/api/appointments/${encodeURIComponent(appointmentId || '')}`, body }
  }
  if (name === 'manageService') {
    const { action, serviceId, data: serviceData, ...rest } = data
    if (action === 'delete') return { method: 'DELETE', path: `/api/admin/services/${encodeURIComponent(serviceId || '')}` }
    if (action === 'update') return { method: 'PUT', path: `/api/admin/services/${encodeURIComponent(serviceId || '')}`, body: serviceData || rest }
    return { method: 'POST', path: '/api/admin/services', body: serviceData || rest }
  }
  if (name === 'manageTimeSlot') {
    const { action, slotId, data: slotData, ...rest } = data
    if (action === 'delete') return { method: 'DELETE', path: `/api/admin/time-slots/${encodeURIComponent(slotId || '')}` }
    if (action === 'update') return { method: 'PUT', path: `/api/admin/time-slots/${encodeURIComponent(slotId || '')}`, body: slotData || rest }
    return { method: 'POST', path: '/api/admin/time-slots', body: slotData || rest }
  }

  throw new Error(`Unsupported function: ${name}`)
}

function saveTokens(data: any) {
  if (data?.accessToken) Taro.setStorageSync(ACCESS_TOKEN_KEY, data.accessToken)
  if (data?.refreshToken) Taro.setStorageSync(REFRESH_TOKEN_KEY, data.refreshToken)
}

async function refreshAccessToken(baseUrl: string) {
  const refreshToken = Taro.getStorageSync(REFRESH_TOKEN_KEY)
  if (!refreshToken) throw new Error('登录已过期，请重新登录')

  const res = await Taro.request({
    url: `${baseUrl}/api/auth/refresh`,
    method: 'POST',
    data: { refreshToken }
  })
  const body = res.data as any
  if (res.statusCode !== 200 || body.code !== 0) {
    throw new Error(body.message || '登录已过期，请重新登录')
  }
  saveTokens(body.data)
  return body.data.accessToken
}

async function ensureLoginCode(name: string, data: Record<string, any>) {
  if (name !== 'login' || data.code) return data
  const loginRes = await Taro.login()
  return { ...data, code: loginRes.code }
}

async function requestRoute<T>(route: RouteConfig, retry = true): Promise<T> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('TARO_APP_API_BASE_URL 未配置')

  const accessToken = Taro.getStorageSync(ACCESS_TOKEN_KEY)
  const res = await Taro.request({
    url: `${baseUrl}${route.path}${buildQuery(route.query)}`,
    method: route.method,
    data: route.body,
    header: {
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
      'Content-Type': 'application/json'
    }
  })

  if (res.statusCode === 401 && retry) {
    await refreshAccessToken(baseUrl)
    return requestRoute<T>(route, false)
  }

  const body = res.data as { code: number; message: string; data: T } | undefined
  if (!body || typeof body.code !== 'number') throw new Error('接口返回异常，请稍后重试')
  if (body.code !== 0) throw new Error(body.message || '请求失败')

  saveTokens(body.data)
  return body.data
}

export async function callHttpFunction<T = any>(name: string, data?: Record<string, any>): Promise<T> {
  const finalData = await ensureLoginCode(name, data || {})
  const result = await requestRoute<any>(resolveRoute(name, finalData))
  if (name === 'login' && result && 'user' in result) {
    const { accessToken, refreshToken, expiresIn, ...legacyResult } = result
    void accessToken
    void refreshToken
    void expiresIn
    return legacyResult as T
  }
  return result as T
}

export function hasApiBaseUrl() {
  return Boolean(getBaseUrl())
}

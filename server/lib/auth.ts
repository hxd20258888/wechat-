import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { getPool } from './db'
import { ApiError } from './http'

export interface AuthUser {
  id: string
  openid: string
  isAdmin: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const ACCESS_TTL = 7 * 24 * 3600 // access token 有效期（秒）
const REFRESH_TTL = 30 * 24 * 3600 // refresh token 有效期（秒）

interface TokenPayload {
  uid: string
  type: 'access' | 'refresh'
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new ApiError(500, '服务端未配置 JWT_SECRET')
  return secret
}

export function signTokens(userId: string) {
  const secret = getJwtSecret()
  const accessToken = jwt.sign({ uid: userId, type: 'access' } satisfies TokenPayload, secret, {
    expiresIn: ACCESS_TTL
  })
  const refreshToken = jwt.sign({ uid: userId, type: 'refresh' } satisfies TokenPayload, secret, {
    expiresIn: REFRESH_TTL
  })
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL }
}

export function verifyToken(token: string, expectType: 'access' | 'refresh'): string {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as TokenPayload
    if (payload.type !== expectType || !payload.uid) {
      throw new Error('token type mismatch')
    }
    return payload.uid
  } catch {
    throw new ApiError(401, '登录已过期，请重新登录')
  }
}

async function loadUser(id: string): Promise<AuthUser | null> {
  const { rows } = await getPool().query(
    'SELECT id, openid, is_admin AS "isAdmin" FROM users WHERE id = $1',
    [id]
  )
  const row = rows[0]
  if (!row) return null
  return { id: row.id, openid: row.openid, isAdmin: row.isAdmin }
}

/** 登录校验：解析 Bearer token 并挂载 req.user（每次查库获取最新管理员状态） */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new ApiError(401, '未登录')

    const uid = verifyToken(token, 'access')
    const user = await loadUser(uid)
    if (!user) throw new ApiError(401, '用户不存在')

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/** 管理员校验：必须与 requireAuth 串联使用 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    next(new ApiError(403, '无管理员权限'))
    return
  }
  next()
}

/**
 * 通过微信 code 换取 openid。
 * 未配置 WX_APPID/WX_SECRET 或换取失败时进入开发模式：
 * openid = dev-<code>（H5 / 本地联调场景，同一 code 映射同一用户）。
 */
export async function resolveOpenid(code?: string): Promise<string> {
  if (code) {
    const appid = process.env.WX_APPID
    const secret = process.env.WX_SECRET
    if (appid && secret) {
      try {
        const url =
          `https://api.weixin.qq.com/sns/jscode2session` +
          `?appid=${encodeURIComponent(appid)}` +
          `&secret=${encodeURIComponent(secret)}` +
          `&js_code=${encodeURIComponent(code)}` +
          `&grant_type=authorization_code`
        const resp = await fetch(url)
        const data = (await resp.json()) as { openid?: string; errcode?: number; errmsg?: string }
        if (data.openid) return data.openid
        console.warn('[auth] jscode2session 失败:', data.errcode, data.errmsg)
      } catch (err) {
        console.warn('[auth] jscode2session 请求异常:', err)
      }
    }
  }
  return `dev-${code || 'h5-anon'}`
}

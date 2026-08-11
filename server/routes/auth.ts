import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { getPool } from '../lib/db'
import { ApiError, assertRequired, ok } from '../lib/http'
import { resolveOpenid, signTokens, verifyToken } from '../lib/auth'

const router = Router()

// 用户查询字段（与前端 UserInfo 结构一致）
const USER_COLUMNS = `
  id AS "_id",
  openid AS "_openid",
  nickname,
  avatar,
  phone,
  is_admin AS "isAdmin",
  to_char(create_time, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createTime"
`

async function getUserByOpenid(openid: string) {
  const { rows } = await getPool().query(
    `SELECT ${USER_COLUMNS} FROM users WHERE openid = $1`,
    [openid]
  )
  return rows[0] || null
}

/**
 * POST /api/auth/login
 * body: { mode: 'check' | 'create' | 'updateProfile', code?, nickname?, avatar?, phone? }
 * 返回: { isNewUser, user, accessToken, refreshToken, expiresIn }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { mode = 'check', code, nickname, avatar, phone } = (req.body || {}) as {
      mode?: 'check' | 'create' | 'updateProfile'
      code?: string
      nickname?: string
      phone?: string
      avatar?: string
    }

    const openid = await resolveOpenid(code)
    const pool = getPool()
    let user: unknown
    let isNewUser = false

    if (mode === 'updateProfile') {
      assertRequired(nickname, '昵称不能为空')
      const { rows } = await pool.query(
        `UPDATE users
         SET nickname = $1, avatar = $2, phone = $3
         WHERE openid = $4
         RETURNING ${USER_COLUMNS}`,
        [nickname.trim(), avatar || 'default', phone || '', openid]
      )
      if (!rows[0]) throw new ApiError(401, '用户不存在，请先注册')
      user = rows[0]
    } else {
      // mode: check / create
      user = await getUserByOpenid(openid)

      if (!user) {
        if (mode === 'check') {
          ok(res, { isNewUser: true, user: null })
          return
        }
        const id = randomUUID()
        await pool.query(
          'INSERT INTO users (id, openid, nickname, avatar) VALUES ($1, $2, $3, $4)',
          [id, openid, (nickname || '微信用户').trim(), avatar || 'default']
        )
        isNewUser = true
        user = await getUserByOpenid(openid)
      }
    }

    const tokens = signTokens((user as { _id: string })._id)
    ok(res, { isNewUser, user, ...tokens })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/auth/refresh
 * body: { refreshToken }
 * 返回: { accessToken, refreshToken, expiresIn }
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = (req.body || {}) as { refreshToken?: string }
    assertRequired(refreshToken, '缺少 refreshToken')

    const uid = verifyToken(refreshToken, 'refresh')
    const { rows } = await getPool().query('SELECT id FROM users WHERE id = $1', [uid])
    if (!rows[0]) throw new ApiError(401, '用户不存在')

    const tokens = signTokens(uid)
    ok(res, tokens)
  } catch (err) {
    next(err)
  }
})

export default router

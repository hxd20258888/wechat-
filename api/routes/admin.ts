import { Router } from 'express'
import { getPool } from '../lib/db'
import { ApiError, assertRequired, ok } from '../lib/http'
import { requireAdmin, requireAuth } from '../lib/auth'

const router = Router()

/**
 * GET /api/admin/check
 * 返回: { isAdmin: boolean }
 */
router.get('/check', requireAuth, async (req, res, next) => {
  try {
    ok(res, { isAdmin: req.user!.isAdmin })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/bind
 * body: { inviteCode }
 * 邀请码匹配后将该用户标记为管理员
 */
router.post('/bind', requireAuth, async (req, res, next) => {
  try {
    const { inviteCode } = (req.body || {}) as { inviteCode?: string }
    assertRequired(inviteCode, '请输入邀请码')

    const expected = process.env.ADMIN_INVITE_CODE
    if (!expected) throw new ApiError(500, '服务端未配置 ADMIN_INVITE_CODE')
    if (inviteCode.trim() !== expected) throw new ApiError(400, '邀请码不正确')

    await getPool().query('UPDATE users SET is_admin = TRUE WHERE id = $1', [req.user!.id])
    ok(res, { isAdmin: true })
  } catch (err) {
    next(err)
  }
})

// 预留：管理员可用的内部路由均通过 requireAuth + requireAdmin 组合保护
router.get('/ping', requireAuth, requireAdmin, (req, res) => {
  ok(res, { admin: true })
})

export default router

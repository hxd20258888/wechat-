import { Router } from 'express'
import { getPool } from '../lib/db'
import { ok } from '../lib/http'

const router = Router()

/**
 * GET /api/categories
 * 返回: ServiceCategory[]（与前端结构一致）
 */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id AS "_id", key, label, icon,
              sort_order AS "sortOrder", is_active AS "isActive"
       FROM categories
       WHERE is_active = TRUE
       ORDER BY sort_order`
    )
    ok(res, rows)
  } catch (err) {
    next(err)
  }
})

export default router

import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { getPool } from '../lib/db'
import { ApiError, assertRequired, ok } from '../lib/http'
import { requireAdmin, requireAuth } from '../lib/auth'

const router = Router()

// 服务字段（与前端 ServiceItem 结构一致）
const SERVICE_COLUMNS = `
  id AS "_id",
  name,
  category_id AS "categoryId",
  category,
  category_name AS "categoryName",
  price_min AS "priceMin",
  price AS "price",
  price_max AS "priceMax",
  duration,
  description,
  image,
  is_active AS "isActive",
  sort_order AS "sortOrder"
`

const UPDATABLE_FIELDS: Record<string, string> = {
  name: 'name',
  categoryId: 'category_id',
  category: 'category',
  categoryName: 'category_name',
  priceMin: 'price_min',
  price: 'price',
  priceMax: 'price_max',
  duration: 'duration',
  description: 'description',
  image: 'image',
  isActive: 'is_active',
  sortOrder: 'sort_order'
}

/**
 * GET /api/services?category=
 * 返回: ServiceItem[]
 */
router.get('/', async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined
    const base = `SELECT ${SERVICE_COLUMNS} FROM services`
    const rows = category
      ? (await getPool().query(
          `${base} WHERE (category_id = $1 OR category = $1) ORDER BY sort_order, create_time`,
          [category]
        )).rows
      : (await getPool().query(`${base} ORDER BY sort_order, create_time`)).rows
    ok(res, rows)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/services
 * body: { name, categoryId?, category?, categoryName?, priceMin?, price?, priceMax?, duration?, description? }
 */
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, any>
    assertRequired(body.name, '服务名称不能为空')

    const id = randomUUID()
    const { rows } = await getPool().query(
      `INSERT INTO services
        (id, name, category_id, category, category_name, price_min, price, price_max, duration, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${SERVICE_COLUMNS}`,
      [
        id,
        String(body.name).trim(),
        String(body.categoryId ?? 'tuning'),
        String(body.category ?? 'tuning'),
        String(body.categoryName ?? '调音'),
        Number(body.priceMin ?? body.price ?? 0),
        body.price != null ? Number(body.price) : null,
        body.priceMax != null ? Number(body.priceMax) : null,
        Number(body.duration ?? 60),
        String(body.description ?? '')
      ]
    )
    ok(res, rows[0])
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/admin/services/:id
 * body: 白名单内任意可更新字段
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params
    const body = (req.body || {}) as Record<string, any>

    const assignments: string[] = []
    const values: unknown[] = []
    let index = 1
    for (const [key, column] of Object.entries(UPDATABLE_FIELDS)) {
      if (key in body) {
        assignments.push(`${column} = $${index++}`)
        values.push(body[key])
      }
    }
    if (assignments.length === 0) throw new ApiError(400, '没有可更新的字段')

    values.push(id)
    const { rows } = await getPool().query(
      `UPDATE services SET ${assignments.join(', ')} WHERE id = $${index} RETURNING ${SERVICE_COLUMNS}`,
      values
    )
    if (!rows[0]) throw new ApiError(404, '服务不存在')
    ok(res, rows[0])
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/admin/services/:id
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await getPool().query('DELETE FROM services WHERE id = $1 RETURNING id', [
      req.params.id
    ])
    if (!rows[0]) throw new ApiError(404, '服务不存在')
    ok(res, { deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router

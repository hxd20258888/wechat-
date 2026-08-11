import { Pool } from 'pg'
import { ApiError } from './http'

let pool: Pool | null = null

/**
 * 全局连接池（Vercel 函数实例内复用）。
 * ssl 配置兼容 Neon / Vercel Postgres。
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new ApiError(500, '服务端未配置 DATABASE_URL')
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    })
  }
  return pool
}

import type { NextFunction, Request, Response } from 'express'

/** 业务错误：携带 HTTP 状态码，由 errorHandler 统一转换为前端响应格式 */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** 成功响应：{ code: 0, message: 'ok', data } */
export function ok(res: Response, data: unknown = null) {
  res.json({ code: 0, message: 'ok', data })
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ code: 404, message: 'Not Found', data: null })
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof ApiError ? err.status : 500
  const message = err instanceof Error ? err.message : '服务器错误'
  if (status >= 500) {
    console.error('[API]', err)
  }
  res.status(status).json({ code: 1, message, data: null })
}

/** 简单表单校验：必填字段 */
export function assertRequired(value: unknown, message: string): asserts value is string {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ApiError(400, message)
  }
}

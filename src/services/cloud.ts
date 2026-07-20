import Taro from '@tarojs/taro'

const isWeapp = process.env.TARO_ENV === 'weapp'

export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  if (!isWeapp) {
    throw new Error(`[Cloud] ${name} 鍙兘鍦ㄥ井淇″皬绋嬪簭绔皟鐢╜)
  }
  const res = await Taro.cloud.callFunction({ name, data })
  const result = res.result as { code: number; message: string; data: T } | null | undefined
  if (!result || typeof result.code !== 'number') {
    console.error([Cloud]  returned invalid result:, res.result)
    throw new Error('云函数返回异常，请稍后重试')
  }
  if (result.code !== 0) {
    console.error(`[Cloud] ${name} failed:`, result.message)
    throw new Error(result.message || '璇锋眰澶辫触')
  }
  return result.data
}

export function getDatabase() {
  if (!isWeapp) {
    return null
  }
  return Taro.cloud.database()
}


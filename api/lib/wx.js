async function code2Session(code) {
  if (!code) throw new Error('code is required')
  if (!process.env.WX_APPID || !process.env.WX_SECRET) {
    throw new Error('WX_APPID and WX_SECRET must be configured')
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', process.env.WX_APPID)
  url.searchParams.set('secret', process.env.WX_SECRET)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const res = await fetch(url)
  const data = await res.json()
  if (data.errcode) {
    throw new Error(data.errmsg || 'code2Session failed')
  }
  return {
    openid: data.openid,
    unionid: data.unionid || null,
    sessionKey: data.session_key
  }
}

module.exports = { code2Session }

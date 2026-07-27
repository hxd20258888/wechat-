const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_AVATAR = 'default'

const ADMIN_AUTH_REQUIRED_RESPONSE = {
  code: -2,
  message: '请先完成微信授权后再绑定管理员',
  data: null
}

function canBindAdmin(user) {
  const nickname = String((user && user.nickname) || '').trim()
  const avatar = String((user && user.avatar) || '').trim()
  return Boolean(
    user &&
    nickname &&
    avatar &&
    nickname !== DEFAULT_NICKNAME &&
    avatar !== DEFAULT_AVATAR
  )
}

module.exports = {
  ADMIN_AUTH_REQUIRED_RESPONSE,
  canBindAdmin
}

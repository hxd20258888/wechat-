const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_AVATAR = 'default'

const AUTH_REQUIRED_RESPONSE = {
  code: -2,
  message: '请先完成微信授权后再预约',
  data: null
}

function isAuthorizedUser(user) {
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

function buildUserSnapshot(user) {
  return {
    nickname: String((user && user.nickname) || '').trim(),
    avatar: String((user && user.avatar) || '').trim()
  }
}

module.exports = {
  AUTH_REQUIRED_RESPONSE,
  isAuthorizedUser,
  buildUserSnapshot
}

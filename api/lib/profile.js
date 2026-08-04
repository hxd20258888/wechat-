const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_AVATAR = 'default'
const PROFILE_REQUIRED_MESSAGE = '请完善微信头像和昵称'

function normalizeLoginProfile(event = {}) {
  const nickname = String(event.nickname || '').trim() || DEFAULT_NICKNAME
  const avatar = String(event.avatar || '').trim() || DEFAULT_AVATAR
  return { nickname, avatar }
}

function hasAuthorizedProfile(event = {}) {
  return Boolean(String(event.nickname || '').trim() && String(event.avatar || '').trim())
}

function requireAuthorizedProfile(event = {}) {
  if (!hasAuthorizedProfile(event)) throw new Error(PROFILE_REQUIRED_MESSAGE)
  return normalizeLoginProfile(event)
}

function buildUserProfile(currentUser, event = {}) {
  const normalized = normalizeLoginProfile(event)
  if (!currentUser) return normalized
  return {
    nickname: event.nickname ? normalized.nickname : (currentUser.nickname || normalized.nickname),
    avatar: event.avatar ? normalized.avatar : (currentUser.avatar || normalized.avatar)
  }
}

function buildLoginDecision(mode = 'check', currentUser, event = {}) {
  if (mode === 'check') {
    return { shouldCreate: false, response: { isNewUser: !currentUser, user: currentUser || null } }
  }
  if (mode === 'create') {
    if (currentUser) return { shouldCreate: false, profile: buildUserProfile(currentUser, event) }
    return { shouldCreate: true, profile: requireAuthorizedProfile(event) }
  }
  if (mode === 'updateProfile') {
    return { shouldCreate: false, profile: requireAuthorizedProfile(event) }
  }
  throw new Error('Unsupported login mode')
}

module.exports = {
  DEFAULT_AVATAR,
  DEFAULT_NICKNAME,
  PROFILE_REQUIRED_MESSAGE,
  buildLoginDecision,
  normalizeLoginProfile
}

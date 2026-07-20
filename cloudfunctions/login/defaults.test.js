const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildLoginResponse,
  buildUserProfile,
  normalizeLoginProfile,
  DEFAULT_AVATAR,
  DEFAULT_NICKNAME
} = require('./defaults')

test('uses default profile when login event has no avatar or nickname', () => {
  assert.deepEqual(normalizeLoginProfile({}), {
    nickname: DEFAULT_NICKNAME,
    avatar: DEFAULT_AVATAR
  })
})

test('trims nickname and keeps provided avatar', () => {
  assert.deepEqual(normalizeLoginProfile({
    nickname: '  小李  ',
    avatar: 'cloud://avatar.png'
  }), {
    nickname: '小李',
    avatar: 'cloud://avatar.png'
  })
})

test('keeps stored profile when existing user logs in without new profile authorization', () => {
  assert.deepEqual(buildUserProfile({
    nickname: '老用户',
    avatar: 'cloud://stored-avatar.png'
  }, {}), {
    nickname: '老用户',
    avatar: 'cloud://stored-avatar.png'
  })
})

test('uses newly authorized profile when user submits profile updates', () => {
  assert.deepEqual(buildUserProfile({
    nickname: '老用户',
    avatar: 'cloud://stored-avatar.png'
  }, {
    nickname: '新昵称',
    avatar: 'cloud://new-avatar.png'
  }), {
    nickname: '新昵称',
    avatar: 'cloud://new-avatar.png'
  })
})

test('check mode returns existing user without requiring profile authorization', () => {
  const existingUser = { _id: 'u1', nickname: '老用户', avatar: 'cloud://stored-avatar.png' }

  assert.deepEqual(buildLoginResponse('check', existingUser), {
    shouldCreate: false,
    response: { isNewUser: false, user: existingUser }
  })
})

test('check mode marks missing user as new without creating a default profile', () => {
  assert.deepEqual(buildLoginResponse('check', null), {
    shouldCreate: false,
    response: { isNewUser: true, user: null }
  })
})

test('create mode rejects new user creation without authorized avatar and nickname', () => {
  assert.throws(() => buildLoginResponse('create', null, {}), /请完善微信头像和昵称/)
})

test('create mode accepts authorized avatar and nickname for new users', () => {
  assert.deepEqual(buildLoginResponse('create', null, {
    nickname: '新用户',
    avatar: 'cloud://avatar.png'
  }), {
    shouldCreate: true,
    profile: {
      nickname: '新用户',
      avatar: 'cloud://avatar.png'
    }
  })
})

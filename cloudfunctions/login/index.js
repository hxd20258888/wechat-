const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { nickname, avatar } = event

    // 查找或创建用户
    const userRes = await db.collection('users').where({ _openid: openid }).get()
    let user
    if (userRes.data.length > 0) {
      // 更新用户信息
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: { nickname, avatar, updateTime: db.serverDate() }
      })
      user = { ...userRes.data[0], nickname, avatar }
    } else {
      // 创建新用户
      const addRes = await db.collection('users').add({
        data: {
          _openid: openid,
          nickname,
          avatar,
          phone: '',
          isAdmin: false,
          createTime: db.serverDate()
        }
      })
      user = {
        _id: addRes._id,
        _openid: openid,
        nickname,
        avatar,
        phone: '',
        isAdmin: false
      }
    }

    return { code: 0, message: 'success', data: user }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}

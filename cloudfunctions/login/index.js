const cloud = require('wx-server-sdk')
const { buildLoginResponse } = require('./defaults')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event = {}, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const mode = event.mode || 'check'

    const userRes = await db.collection('users').where({ _openid: openid }).get()
    const currentUser = userRes.data[0] || null
    const decision = buildLoginResponse(mode, currentUser, event)

    if (mode === 'check') {
      return { code: 0, message: 'success', data: decision.response }
    }

    if (mode === 'create' && decision.shouldCreate) {
      const addRes = await db.collection('users').add({
        data: {
          _openid: openid,
          ...decision.profile,
          phone: '',
          isAdmin: false,
          createTime: db.serverDate()
        }
      })
      const user = {
        _id: addRes._id,
        _openid: openid,
        ...decision.profile,
        phone: '',
        isAdmin: false
      }

      return { code: 0, message: 'success', data: { isNewUser: false, user } }
    }

    if ((mode === 'create' || mode === 'updateProfile') && currentUser) {
      await db.collection('users').doc(currentUser._id).update({
        data: {
          ...decision.profile,
          updateTime: db.serverDate()
        }
      })
      const user = { ...currentUser, ...decision.profile }

      return { code: 0, message: 'success', data: { isNewUser: false, user } }
    }

    throw new Error('Unsupported login mode')
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || 'Service error', data: null }
  }
}

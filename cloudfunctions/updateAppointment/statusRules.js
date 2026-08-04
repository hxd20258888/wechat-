const ADMIN_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['cancelled']
}

function canTransition({ currentStatus, nextStatus, isAdmin, isOwner }) {
  if (currentStatus === nextStatus) {
    return currentStatus === 'cancelled'
  }

  if (isAdmin) {
    return Boolean(ADMIN_TRANSITIONS[currentStatus]?.includes(nextStatus))
  }

  return Boolean(
    isOwner &&
    nextStatus === 'cancelled' &&
    (currentStatus === 'pending' || currentStatus === 'confirmed')
  )
}

function getStatusTimestampField(nextStatus) {
  if (nextStatus === 'confirmed') return 'confirmedTime'
  if (nextStatus === 'completed') return 'completedTime'
  if (nextStatus === 'cancelled') return 'cancelTime'
  return ''
}

module.exports = {
  canTransition,
  getStatusTimestampField
}

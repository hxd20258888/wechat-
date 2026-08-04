const READ_ROUTES = {
  checkAdmin: { method: 'GET', path: '/api/admin/check' },
  getAppointments: { method: 'GET', path: '/api/appointments' },
  getCategories: { method: 'GET', path: '/api/categories' },
  getServices: { method: 'GET', path: '/api/services' },
  getTimeSlots: { method: 'GET', path: '/api/time-slots' }
}

function resolveFunctionRoute(name, data = {}) {
  if (READ_ROUTES[name]) {
    return {
      ...READ_ROUTES[name],
      query: data,
      body: undefined
    }
  }

  if (name === 'login') {
    return { method: 'POST', path: '/api/auth/login', query: undefined, body: data }
  }

  if (name === 'bindAdmin') {
    return { method: 'POST', path: '/api/admin/bind', query: undefined, body: data }
  }

  if (name === 'createAppointment') {
    return { method: 'POST', path: '/api/appointments', query: undefined, body: data }
  }

  if (name === 'getAppointmentDetail') {
    const { appointmentId } = data
    return { method: 'GET', path: `/api/appointments/${encodeURIComponent(appointmentId || '')}`, query: undefined, body: undefined }
  }

  if (name === 'updateAppointment') {
    const { appointmentId, ...body } = data
    return { method: 'PUT', path: `/api/appointments/${encodeURIComponent(appointmentId || '')}`, query: undefined, body }
  }

  if (name === 'manageService') {
    const { action, serviceId, data: serviceData, ...rest } = data
    if (action === 'delete') {
      return { method: 'DELETE', path: `/api/admin/services/${encodeURIComponent(serviceId || '')}`, query: undefined, body: undefined }
    }
    if (action === 'update') {
      return { method: 'PUT', path: `/api/admin/services/${encodeURIComponent(serviceId || '')}`, query: undefined, body: serviceData || rest }
    }
    return { method: 'POST', path: '/api/admin/services', query: undefined, body: serviceData || rest }
  }

  if (name === 'manageTimeSlot') {
    const { action, slotId, data: slotData, ...rest } = data
    if (action === 'delete') {
      return { method: 'DELETE', path: `/api/admin/time-slots/${encodeURIComponent(slotId || '')}`, query: undefined, body: undefined }
    }
    if (action === 'update') {
      return { method: 'PUT', path: `/api/admin/time-slots/${encodeURIComponent(slotId || '')}`, query: undefined, body: slotData || rest }
    }
    return { method: 'POST', path: '/api/admin/time-slots', query: undefined, body: slotData || rest }
  }

  throw new Error(`Unsupported function: ${name}`)
}

module.exports = { resolveFunctionRoute }

# Booking Core Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved booking core improvements: in-flow WeChat authorization, authorized appointment creation, service/time availability states, success result, appointment detail, cancellation/status rules, and stricter admin binding.

**Architecture:** Keep the existing Taro React pages and WeChat cloud functions. Put pure validation/status/date logic into small helper modules with Node tests, then wire the helpers into cloud functions and pages. Frontend changes stay scoped to booking, mine, admin appointments, and a new appointment detail page.

**Tech Stack:** Taro 4.1.9, React 18, TypeScript, SCSS Modules, WeChat Cloud Functions, Node `node:test`.

## Global Constraints

- Appointment submission requires an authorized user record in `users`.
- Authorization prompt appears when the user taps `下一步` to enter the info step, not when opening the booking page.
- Authorization success enters the info step; it does not auto-submit the appointment.
- Users can cancel their own `pending` and `confirmed` appointments without a time limit.
- Completed appointments cannot be cancelled.
- Booking dates show only admin-maintained, open, not-full time slots.
- No batch time-slot generation in this round.
- No vehicle profile, tuning requirement, service package, recheck appointment, or internal admin remark features in this round.

---

### Task 1: Backend Appointment Creation Authorization

**Files:**
- Create: `cloudfunctions/createAppointment/guards.js`
- Modify: `cloudfunctions/createAppointment/index.js`
- Test: `cloudfunctions/createAppointment/guards.test.js`

**Interfaces:**
- Produces: `isAuthorizedUser(user): boolean`
- Produces: `buildUserSnapshot(user): { nickname: string, avatar: string }`
- Produces: `AUTH_REQUIRED_RESPONSE`

- [ ] **Step 1: Write failing tests**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { isAuthorizedUser, buildUserSnapshot, AUTH_REQUIRED_RESPONSE } = require('./guards')

test('rejects missing user for appointment creation', () => {
  assert.equal(isAuthorizedUser(null), false)
  assert.deepEqual(AUTH_REQUIRED_RESPONSE, {
    code: -2,
    message: '请先完成微信授权后再预约',
    data: null
  })
})

test('rejects default or empty profile user for appointment creation', () => {
  assert.equal(isAuthorizedUser({ nickname: '', avatar: '' }), false)
  assert.equal(isAuthorizedUser({ nickname: '微信用户', avatar: 'default' }), false)
})

test('builds appointment user snapshot from authorized profile', () => {
  const user = { nickname: '小李', avatar: 'cloud://avatar.png' }
  assert.equal(isAuthorizedUser(user), true)
  assert.deepEqual(buildUserSnapshot(user), {
    nickname: '小李',
    avatar: 'cloud://avatar.png'
  })
})
```

- [ ] **Step 2: Verify red**

Run: `node cloudfunctions/createAppointment/guards.test.js`

Expected: FAIL because `guards.js` does not exist.

- [ ] **Step 3: Implement helper and integrate cloud function**

Create `cloudfunctions/createAppointment/guards.js`:

```js
const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_AVATAR = 'default'

const AUTH_REQUIRED_RESPONSE = {
  code: -2,
  message: '请先完成微信授权后再预约',
  data: null
}

function isAuthorizedUser(user) {
  return Boolean(
    user &&
    String(user.nickname || '').trim() &&
    String(user.avatar || '').trim() &&
    user.nickname !== DEFAULT_NICKNAME &&
    user.avatar !== DEFAULT_AVATAR
  )
}

function buildUserSnapshot(user) {
  return {
    nickname: String(user.nickname || '').trim(),
    avatar: String(user.avatar || '').trim()
  }
}

module.exports = {
  AUTH_REQUIRED_RESPONSE,
  isAuthorizedUser,
  buildUserSnapshot
}
```

Modify `cloudfunctions/createAppointment/index.js`:

- Require the helper.
- After openid validation, query `users` by `_openid`.
- Return `AUTH_REQUIRED_RESPONSE` when no authorized user exists.
- Include `userSnapshot: buildUserSnapshot(user)` in new appointment data.
- Return success data containing `_id`, `status`, `serviceName`, `date`, `timeSlot`.

- [ ] **Step 4: Verify green**

Run: `node cloudfunctions/createAppointment/guards.test.js`

Expected: PASS.

Run existing test: `node cloudfunctions/createAppointment/defaults.test.js`

Expected: PASS.

---

### Task 2: Backend Appointment Status Rules

**Files:**
- Create: `cloudfunctions/updateAppointment/statusRules.js`
- Modify: `cloudfunctions/updateAppointment/index.js`
- Test: `cloudfunctions/updateAppointment/statusRules.test.js`

**Interfaces:**
- Produces: `canTransition({ currentStatus, nextStatus, isAdmin, isOwner }): boolean`
- Produces: `getStatusTimestampField(nextStatus): string | ''`

- [ ] **Step 1: Write failing tests**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { canTransition, getStatusTimestampField } = require('./statusRules')

test('owner can cancel pending and confirmed appointments', () => {
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), true)
  assert.equal(canTransition({ currentStatus: 'confirmed', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), true)
})

test('owner cannot cancel completed or other users appointments', () => {
  assert.equal(canTransition({ currentStatus: 'completed', nextStatus: 'cancelled', isAdmin: false, isOwner: true }), false)
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'cancelled', isAdmin: false, isOwner: false }), false)
})

test('admin can only use whitelisted state transitions', () => {
  assert.equal(canTransition({ currentStatus: 'pending', nextStatus: 'confirmed', isAdmin: true, isOwner: false }), true)
  assert.equal(canTransition({ currentStatus: 'confirmed', nextStatus: 'completed', isAdmin: true, isOwner: false }), true)
  assert.equal(canTransition({ currentStatus: 'cancelled', nextStatus: 'confirmed', isAdmin: true, isOwner: false }), false)
  assert.equal(canTransition({ currentStatus: 'completed', nextStatus: 'cancelled', isAdmin: true, isOwner: false }), false)
})

test('returns timestamp field for terminal status updates', () => {
  assert.equal(getStatusTimestampField('confirmed'), 'confirmedTime')
  assert.equal(getStatusTimestampField('completed'), 'completedTime')
  assert.equal(getStatusTimestampField('cancelled'), 'cancelTime')
  assert.equal(getStatusTimestampField('pending'), '')
})
```

- [ ] **Step 2: Verify red**

Run: `node cloudfunctions/updateAppointment/statusRules.test.js`

Expected: FAIL because `statusRules.js` does not exist.

- [ ] **Step 3: Implement helper and integrate cloud function**

Create `cloudfunctions/updateAppointment/statusRules.js` with explicit transition rules.

Modify `cloudfunctions/updateAppointment/index.js`:

- Use `canTransition` in both pre-transaction and transaction checks.
- Allow regular users to cancel own `pending` and `confirmed`.
- Reject `completed -> cancelled`.
- Make repeated `cancelled -> cancelled` idempotent and do not release capacity twice.
- Write `cancelBy`, `cancelTime`, `confirmedTime`, `completedTime`, `operatorOpenid` as appropriate.

- [ ] **Step 4: Verify green**

Run: `node cloudfunctions/updateAppointment/statusRules.test.js`

Expected: PASS.

---

### Task 3: Backend Available Dates

**Files:**
- Create: `cloudfunctions/getTimeSlots/availability.js`
- Modify: `cloudfunctions/getTimeSlots/index.js`
- Test: `cloudfunctions/getTimeSlots/availability.test.js`

**Interfaces:**
- Produces: `filterAvailableSlots(slots): TimeSlot[]`
- Produces: `groupAvailableDates(slots): { date: string, availableCount: number }[]`
- Produces: `isValidDateRange(startDate, endDate): boolean`

- [ ] **Step 1: Write failing tests**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { filterAvailableSlots, groupAvailableDates, isValidDateRange } = require('./availability')

test('filters only open not-full slots', () => {
  const slots = [
    { date: '2026-07-25', isAvailable: true, bookedCount: 0, maxCount: 1 },
    { date: '2026-07-25', isAvailable: true, bookedCount: 1, maxCount: 1 },
    { date: '2026-07-26', isAvailable: false, bookedCount: 0, maxCount: 1 }
  ]
  assert.deepEqual(filterAvailableSlots(slots), [slots[0]])
})

test('groups available slots by date', () => {
  const slots = [
    { date: '2026-07-25', isAvailable: true, bookedCount: 0, maxCount: 2 },
    { date: '2026-07-25', isAvailable: true, bookedCount: 1, maxCount: 2 },
    { date: '2026-07-26', isAvailable: true, bookedCount: 0, maxCount: 1 }
  ]
  assert.deepEqual(groupAvailableDates(slots), [
    { date: '2026-07-25', availableCount: 2 },
    { date: '2026-07-26', availableCount: 1 }
  ])
})

test('limits available date ranges to 31 days', () => {
  assert.equal(isValidDateRange('2026-07-25', '2026-08-24'), true)
  assert.equal(isValidDateRange('2026-07-25', '2026-08-25'), false)
})
```

- [ ] **Step 2: Verify red**

Run: `node cloudfunctions/getTimeSlots/availability.test.js`

Expected: FAIL because `availability.js` does not exist.

- [ ] **Step 3: Implement helper and integrate cloud function**

Create helper with filtering and grouping.

Modify `cloudfunctions/getTimeSlots/index.js`:

- If `event.mode === 'availableDates'`, query `time_slots` by date range and `isAvailable: true`, group only not-full dates.
- If `date` is provided, return only not-full, open slots sorted by start time.
- Keep response format `{ code, message, data }`.

- [ ] **Step 4: Verify green**

Run: `node cloudfunctions/getTimeSlots/availability.test.js`

Expected: PASS.

---

### Task 4: Admin Binding Requires Authorized Existing User

**Files:**
- Create: `cloudfunctions/bindAdmin/guards.js`
- Modify: `cloudfunctions/bindAdmin/index.js`
- Test: `cloudfunctions/bindAdmin/guards.test.js`

**Interfaces:**
- Produces: `canBindAdmin(user): boolean`
- Produces: `ADMIN_AUTH_REQUIRED_RESPONSE`

- [ ] **Step 1: Write failing tests**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { canBindAdmin, ADMIN_AUTH_REQUIRED_RESPONSE } = require('./guards')

test('requires an existing authorized user before admin binding', () => {
  assert.equal(canBindAdmin(null), false)
  assert.equal(canBindAdmin({ nickname: '', avatar: '' }), false)
  assert.equal(canBindAdmin({ nickname: '微信用户', avatar: 'default' }), false)
  assert.equal(canBindAdmin({ nickname: '小李', avatar: 'cloud://avatar.png' }), true)
})

test('returns clear admin authorization message', () => {
  assert.deepEqual(ADMIN_AUTH_REQUIRED_RESPONSE, {
    code: -2,
    message: '请先完成微信授权后再绑定管理员',
    data: null
  })
})
```

- [ ] **Step 2: Verify red**

Run: `node cloudfunctions/bindAdmin/guards.test.js`

Expected: FAIL because `guards.js` does not exist.

- [ ] **Step 3: Implement helper and integrate cloud function**

Modify `bindAdmin`:

- After querying `users`, return `ADMIN_AUTH_REQUIRED_RESPONSE` if user is missing or default.
- Remove the branch that creates an empty admin user.
- Existing admin still returns success without consuming invite.

- [ ] **Step 4: Verify green**

Run: `node cloudfunctions/bindAdmin/guards.test.js`

Expected: PASS.

---

### Task 5: Booking Page Flow and Empty States

**Files:**
- Modify: `src/pages/booking/index.tsx`
- Modify: `src/pages/booking/index.module.scss`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `getTimeSlots({ mode: 'availableDates', startDate, endDate })`
- Consumes: `getTimeSlots({ date })`
- Consumes: `login({ mode: 'check' | 'create' | 'updateProfile' })`

- [ ] **Step 1: Add UI state and auth sheet**

Modify booking page to:

- Load services with loading/error states.
- Load available date summaries instead of fixed visible dates.
- On step 1 `下一步`, if user is not authorized, show the authorization sheet.
- The auth sheet uses `Button openType="chooseAvatar"` and `Input type="nickname"`.
- Authorization success enters step 2; it does not submit.

- [ ] **Step 2: Add success result state**

After `createAppointment` succeeds:

- Store returned appointment result.
- Hide step form.
- Show `预约已提交`, `等待技师确认`, appointment id, service/date/time/contact info.
- Buttons: `查看我的预约`, `继续预约`, `返回首页`.

- [ ] **Step 3: Add empty states**

- Services empty: show `暂无可预约服务，请稍后再试或联系门店` and `返回上一层`.
- No available dates: show `暂无可预约时间，请稍后再试或联系门店`.
- Slot load failure: show retry.

- [ ] **Step 4: Build check**

Run: `node node_modules/@tarojs/cli/bin/taro build --type weapp`

Expected: PASS or sandbox `EPERM` on Taro plugin runtime, then rerun with approved escalation.

---

### Task 6: Appointment Detail Page and List Navigation

**Files:**
- Create: `cloudfunctions/getAppointmentDetail/index.js`
- Create: `cloudfunctions/getAppointmentDetail/package.json`
- Create: `src/pages/appointmentDetail/index.tsx`
- Create: `src/pages/appointmentDetail/index.module.scss`
- Create: `src/pages/appointmentDetail/index.config.ts`
- Modify: `src/app.config.ts`
- Modify: `src/pages/mine/index.tsx`
- Modify: `src/pages/adminAppointments/index.tsx`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `getAppointmentDetail({ appointmentId })`

- [ ] **Step 1: Add detail cloud function**

The function:

- Gets openid.
- Checks if current user is admin.
- Fetches appointment by id.
- Allows owner or admin.
- Returns appointment plus `isAdminView`.
- Does not return P2 fields.

- [ ] **Step 2: Add detail page**

The page:

- Loads by route param `id`.
- Shows status, service, date/time, customer, phone, car model, remark.
- User buttons: cancel for `pending` and `confirmed`.
- Admin buttons: confirm/cancel for `pending`, complete/cancel for `confirmed`.

- [ ] **Step 3: Wire list navigation**

- Mine appointment card navigates to detail.
- Admin appointment card navigates to detail.
- Mine list cancel button supports both `pending` and `confirmed` if kept in list.

- [ ] **Step 4: Build check**

Run: `node node_modules/@tarojs/cli/bin/taro build --type weapp`

Expected: PASS or sandbox `EPERM` on Taro plugin runtime, then rerun with approved escalation.

---

### Task 7: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused Node tests**

Run:

```bash
node cloudfunctions/createAppointment/guards.test.js
node cloudfunctions/createAppointment/defaults.test.js
node cloudfunctions/updateAppointment/statusRules.test.js
node cloudfunctions/getTimeSlots/availability.test.js
node cloudfunctions/bindAdmin/guards.test.js
```

Expected: all pass.

- [ ] **Step 2: Check cloud function syntax**

Run: `node --check` for changed cloud function `index.js` files.

Expected: all pass.

- [ ] **Step 3: Build mini program**

Run: `node node_modules/@tarojs/cli/bin/taro build --type weapp`

Expected: PASS. If sandbox blocks Taro plugin writes to `node_modules`, rerun with escalation.

- [ ] **Step 4: Review diff against design**

Confirm:

- No P2 removed features were implemented.
- No batch generation was added.
- No vehicle profile files were added.
- Booking auth occurs before entering info step.
- Appointment creation requires authorized user.

# App Bug List

## P0

### 1. Admin pages render before permission is verified
- **Impact:** A non-admin user can navigate to admin pages and see admin UI. Cloud functions still block protected writes, but the UI exposure is confusing and risky.
- **Evidence:** `src/pages/admin/index.tsx` renders the admin dashboard without calling `checkAdmin` first.
- **Plan:** Add route-level admin checks to `admin`, `adminServices`, `adminTimeSlots`, and `adminAppointments`. Redirect non-admin users to the Mine tab with a no-permission toast.

### 2. User-facing text appears garbled
- **Impact:** Tab labels, buttons, toasts, status labels, and cloud-function messages may display unreadable text.
- **Evidence:** Multiple files contain mojibake-like strings, for example `src/pages/mine/index.tsx`, `src/pages/booking/index.tsx`, and `src/app.config.ts`.
- **Plan:** Normalize source files to UTF-8 and replace all broken UI copy with verified Chinese text. Cover page titles, tabBar labels, toasts, modals, status labels, and cloud-function error messages.

## P1

### 3. Login display may use stale cached profile instead of current WeChat profile
- **Impact:** After logging in with WeChat, the Mine page can show an old nickname/avatar or a fallback avatar instead of the profile the user just authorized.
- **Evidence:** `src/pages/mine/index.tsx` reads `userInfo` from storage on page load and displays it before a fresh authorization flow updates the data.
- **Plan:** On explicit login, always call `Taro.getUserProfile`, use the returned `nickName` and `avatarUrl` for immediate display and storage, and only use cache as a temporary page-load fallback.

### 4. Phone number validation only happens after submit reaches the cloud function
- **Impact:** Users can submit invalid phone numbers and only receive a generic booking failure message.
- **Evidence:** `src/pages/booking/index.tsx` only checks that `phone.trim()` is non-empty, while `cloudfunctions/createAppointment/index.js` validates with `^1\d{10}$`.
- **Plan:** Validate phone format on the client before submitting, and show the cloud function's specific error message when the backend rejects input.

### 5. Service management accepts invalid numeric values
- **Impact:** Admins can create services with invalid price or duration values, which can break booking display and pricing.
- **Evidence:** `cloudfunctions/manageService/index.js` writes arbitrary `data` for create/update after checking only admin permission.
- **Plan:** Validate name, category, price, and duration on both client and cloud function. Reject price <= 0 and duration <= 0.

### 6. Time-slot management accepts invalid or duplicate slots
- **Impact:** Admins can create confusing or unusable time slots such as `18:00-09:00`, max count 0, or duplicate slots for the same date/time.
- **Evidence:** `cloudfunctions/manageTimeSlot/index.js` normalizes values but does not validate time order, max count, or duplicate `slotKey` on manual create.
- **Plan:** Validate `HH:mm`, require start time < end time, require `maxCount >= 1`, and reject duplicate active `slotKey`.

### 7. Local login state is treated as authoritative
- **Impact:** A user can appear logged in from local storage even if cloud user data or admin status has changed.
- **Evidence:** `src/pages/mine/index.tsx` sets logged-in state from `Taro.getStorageSync('userInfo')`.
- **Plan:** Treat cache as display-only. Refresh login/admin state from cloud when entering Mine and after login.

## P2

### 8. Booking failure message is too generic
- **Impact:** Users cannot tell whether failure is caused by full slots, invalid phone, service removal, or cloud errors.
- **Evidence:** `src/pages/booking/index.tsx` always shows a generic booking failure toast in `catch`.
- **Plan:** Show `err.message` when available, with a generic fallback.

### 9. Admin today count can be wrong around midnight
- **Impact:** Dashboard statistics may be off by one day in China time.
- **Evidence:** `src/pages/admin/index.tsx` uses `new Date().toISOString().split('T')[0]`, which is UTC-based.
- **Plan:** Use a local `YYYY-MM-DD` formatter for date comparisons.

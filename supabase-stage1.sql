CREATE TABLE IF NOT EXISTS users (
  "_id" TEXT PRIMARY KEY,
  "_openid" TEXT UNIQUE NOT NULL,
  "nickname" TEXT DEFAULT '微信用户',
  "avatar" TEXT DEFAULT 'default',
  "phone" TEXT DEFAULT '',
  "isAdmin" BOOLEAN DEFAULT FALSE,
  "status" SMALLINT DEFAULT 1,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_identities (
  "_id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES users("_id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL,
  "platform_user_id" TEXT NOT NULL,
  "unionid" TEXT,
  "session_key_encrypted" TEXT,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ,
  UNIQUE("platform", "platform_user_id")
);

CREATE TABLE IF NOT EXISTS user_sessions (
  "_id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES users("_id") ON DELETE CASCADE,
  "refresh_token_hash" TEXT NOT NULL,
  "platform" TEXT DEFAULT 'wechat',
  "user_agent" TEXT,
  "ip_address" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
  "_id" TEXT PRIMARY KEY,
  "key" TEXT,
  "label" TEXT NOT NULL,
  "icon" TEXT DEFAULT '',
  "sortOrder" INT DEFAULT 0,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS services (
  "_id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "categoryId" TEXT,
  "category" TEXT,
  "categoryName" TEXT,
  "priceMin" NUMERIC,
  "price" NUMERIC,
  "priceMax" NUMERIC,
  "duration" INT,
  "description" TEXT DEFAULT '',
  "image" TEXT DEFAULT '',
  "isActive" BOOLEAN DEFAULT TRUE,
  "sortOrder" INT DEFAULT 0,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS time_slots (
  "_id" TEXT PRIMARY KEY,
  "slotKey" TEXT UNIQUE,
  "date" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "maxCount" INT DEFAULT 1,
  "bookedCount" INT DEFAULT 0,
  "isAvailable" BOOLEAN DEFAULT TRUE,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS appointments (
  "_id" TEXT PRIMARY KEY,
  "_openid" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "servicePrice" TEXT,
  "date" TEXT NOT NULL,
  "timeSlot" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending',
  "customerName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "carModel" TEXT NOT NULL,
  "remark" TEXT DEFAULT '',
  "cancelBy" TEXT,
  "operatorOpenid" TEXT,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_invites (
  "_id" TEXT PRIMARY KEY,
  "code" TEXT UNIQUE NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  "maxUses" INT,
  "usedCount" INT DEFAULT 0,
  "expiresAt" TIMESTAMPTZ,
  "createTime" TIMESTAMPTZ DEFAULT NOW(),
  "updateTime" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_invite_logs (
  "_id" TEXT PRIMARY KEY,
  "_openid" TEXT,
  "inviteId" TEXT,
  "result" TEXT,
  "usedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_openid ON users("_openid");
CREATE INDEX IF NOT EXISTS idx_appointments_openid ON appointments("_openid");
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments("status");
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots("date");
CREATE INDEX IF NOT EXISTS idx_user_sessions_hash ON user_sessions("refresh_token_hash");

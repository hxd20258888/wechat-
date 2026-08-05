-- =============================================================
-- 调音预约小程序 - PostgreSQL 表结构（Neon / Vercel Postgres / Supabase）
-- 说明：列名使用 snake_case，接口返回时通过 SQL 别名转成前端
--       期望的 camelCase 字段（如 is_admin -> "isAdmin"）
-- 注意：以下 DROP 用于保证 db:init 可重复执行（会清空数据），
--       生产环境请勿随意运行本脚本。
-- =============================================================

-- 清理旧结构（历史遗留的 camelCase 旧表，与当前结构不兼容）
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS weekly_configs CASCADE;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  openid      TEXT NOT NULL UNIQUE,
  nickname    TEXT NOT NULL DEFAULT '微信用户',
  avatar      TEXT NOT NULL DEFAULT 'default',
  phone       TEXT NOT NULL DEFAULT '',
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 服务分类
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- 服务项目
CREATE TABLE IF NOT EXISTS services (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category_id   TEXT NOT NULL DEFAULT 'tuning',
  category      TEXT NOT NULL DEFAULT 'tuning',
  category_name TEXT NOT NULL DEFAULT '调音',
  price_min     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price         NUMERIC(10,2),
  price_max     NUMERIC(10,2),
  duration      INTEGER NOT NULL DEFAULT 60,
  description   TEXT NOT NULL DEFAULT '',
  image         TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  create_time   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 每周固定营业配置（0=周日 ~ 6=周六）
CREATE TABLE IF NOT EXISTS weekly_configs (
  day_of_week INTEGER PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  start_time  TEXT NOT NULL DEFAULT '09:00',
  end_time    TEXT NOT NULL DEFAULT '18:00',
  max_count   INTEGER NOT NULL DEFAULT 1
);

-- 可预约时段（source: weekly=周模板生成, manual=手工添加）
CREATE TABLE IF NOT EXISTS time_slots (
  id           TEXT PRIMARY KEY,
  date         DATE NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  max_count    INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  source       TEXT NOT NULL DEFAULT 'manual',
  UNIQUE (date, start_time, end_time)
);
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots (date);

-- 预约记录（status: pending/confirmed/completed/cancelled）
CREATE TABLE IF NOT EXISTS appointments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id),
  service_id    TEXT,
  service_name  TEXT NOT NULL,
  service_price TEXT NOT NULL DEFAULT '0',
  date          DATE NOT NULL,
  time_slot     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  car_model     TEXT NOT NULL,
  remark        TEXT NOT NULL DEFAULT '',
  create_time   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (date);

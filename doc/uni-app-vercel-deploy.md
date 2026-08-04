# Taro + Vercel + Supabase 免费优先商用预留方案

> 当前项目状态：Taro React + TypeScript + 微信小程序 + 微信云函数  
> 核心目标：保留现有 Taro 前端，逐步把后端从微信云开发迁移为通用 HTTP API  
> 实施策略：免费优先、分阶段上线、商用预留，不一次性上重架构  
> 推荐主线：Taro 前端不重写，后端先用 Vercel Functions + Supabase PostgreSQL，登录从阶段 1 就采用双 Token 基础形态

---

## 一、核心判断

当前项目已经是 Taro 项目，不是纯微信原生小程序，也不是 uni-app 项目。Taro 本身就是跨端框架，支持微信小程序、H5、支付宝小程序、字节跳动小程序、QQ 小程序、React Native 等端。

所以前端不建议从 Taro 重写成 uni-app。真正影响多端适配的是后端目前依赖微信云开发：

- `wx.cloud.callFunction` 只适合微信生态；
- 微信云数据库、云函数、`openid` 权限模型与微信绑定较深；
- H5、抖音、支付宝等端不能自然复用微信云函数；
- 后续商用时，数据、登录、权限、文件存储都需要更通用的后端能力。

因此新的技术路线是：

```text
前端：Taro React 继续保留
请求层：统一封装 Taro.request
后端：微信云函数 -> 通用 HTTP API
数据库：微信云数据库 -> Supabase PostgreSQL
登录：微信登录先行，数据结构预留多端 identity
扩展：按阶段加入 Upstash、COS、多端登录
```

一句话：**前端不重写，先把后端从微信云开发依赖里解耦出来。**

---

## 二、为什么不一次性上满

完整商用架构可以是：

```text
Vercel + Supabase + Upstash + COS + JWT 双 Token + 完整多端登录
```

这套架构方向是对的，但对个人项目早期偏重。一次性引入太多组件，会带来额外复杂度：

- 多个云平台账号和环境变量；
- 登录态、刷新 Token、Redis 会话吊销；
- 文件上传、CDN、对象存储权限；
- 多端登录差异；
- 数据迁移和接口重写同时发生；
- 小程序合法域名、备案、部署、监控都要一起处理。

更稳的方式是：**按商用方向设计，按个人项目节奏实现。**

---

## 三、分阶段实施路线

### 阶段 1：Taro + Vercel + Supabase

目标：用最少组件替换微信云函数和云数据库，先跑通核心业务。

```text
Taro React 前端
  ↓ Taro.request
Vercel Functions
  ↓
Supabase PostgreSQL
```

本阶段保留：

- Taro React 前端；
- 微信小程序主端；
- 现有页面和业务交互；
- 微信登录；
- 免费优先部署。

本阶段新增：

- `server/api` 通用 HTTP API；
- Supabase PostgreSQL 数据库；
- Access Token + Refresh Token 登录态；
- Supabase `user_sessions` 会话表；
- 微信 `session_key` 服务端加密存储；
- 统一请求封装；
- 云函数到 REST API 的映射。

本阶段暂缓：

- Upstash Redis；
- 腾讯云 COS；
- 抖音/支付宝/H5 完整登录；
- 复杂后台管理系统。

适合状态：个人项目、MVP、微信端优先、希望后面有商用退路。

### 阶段 2：加入 COS 文件存储

当服务图片、案例图、头像、上传文件变多时，再加入对象存储。

推荐：

```text
腾讯云 COS + 自有 CDN/默认域名
```

加入后支持：

- 服务项目图片；
- 调音案例图；
- 用户上传图片；
- 管理端图片维护。

如果早期图片数量少，可以继续使用项目静态资源或 Supabase Storage，暂时不用 COS。

### 阶段 3：加入 Upstash Redis

当用户量上升、登录态要求更严格、需要更高性能的会话、踢人或限流时，再引入 Redis。

用途：

- Refresh Token 状态迁移；
- 登录态黑名单；
- 接口限流；
- 短信验证码缓存；
- 微信 `session_key` 临时存储。

阶段 1 已经使用 Access + Refresh 双 Token，只是 Refresh Token 状态先存在 Supabase。真正商用时再升级为：

```text
Access Token 2h + Refresh Token 7d/30d + Redis 会话状态
```

### 阶段 4：完整多端登录

等微信端稳定后，再接入其他端。

```text
微信小程序：wx.login -> 后端 code2Session
抖音小程序：tt.login -> 后端换 openid
支付宝小程序：my.getAuthCode -> 后端换 user_id
H5：手机号验证码 / 微信网页授权 / 邮箱登录
```

这一阶段不建议提前实现，但数据库从阶段 1 就要预留。

---

## 四、推荐架构图

```text
┌──────────────────────────────────────────────┐
│              Taro React 前端                  │
│  微信小程序优先，后续可编译 H5/抖音/支付宝       │
└───────────────────────┬──────────────────────┘
                        │
                        │ HTTPS / Taro.request
                        ▼
┌──────────────────────────────────────────────┐
│              Vercel Functions                │
│  /api/auth /api/services /api/appointments    │
│  /api/time-slots /api/admin                   │
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────┐
│              Supabase PostgreSQL              │
│  users / user_identities / services           │
│  categories / time_slots / appointments       │
└──────────────────────────────────────────────┘

阶段 2：图片和文件接入腾讯云 COS
阶段 3：会话、限流、验证码接入 Upstash Redis
阶段 4：接入抖音、支付宝、H5 等多端登录
```

---

## 五、技术选型

| 模块 | 阶段 1 选择 | 后续升级 | 说明 |
|---|---|---|---|
| 前端 | Taro React + TypeScript | 继续 Taro 多端 | 不迁 uni-app，避免重写 |
| 请求 | `Taro.request` | 加统一拦截、自动刷新 | 替代 `wx.cloud.callFunction` |
| 后端 | Vercel Functions | 可迁腾讯云轻量 / NestJS | 通用 HTTP API |
| 数据库 | Supabase PostgreSQL Free | Supabase Pro / 自建 PG | 比微信云数据库更通用 |
| 登录 | 微信登录 + Access 2h + Refresh 7d | Redis 会话和多端登录 | 阶段 1 就保留会话控制 |
| 会话 | Supabase `user_sessions` | Upstash Redis | 先用数据库表，后续无缝迁 Redis |
| 文件 | 暂不引入或静态资源 | 腾讯云 COS | 图片一多就提前接 COS |
| 域名 | 开发用 Vercel 域名 | 正式用备案自有域名 | 体验版/正式版上线前必须准备 |

---

## 六、现有云函数迁移映射

当前项目云函数可以按下面方式迁移为 REST API。

| 现有云函数 | 新接口 | 方法 | 说明 |
|---|---|---|---|
| `login` | `/api/auth/login` | POST | 微信登录，换取自定义 Token |
| `checkAdmin` | `/api/admin/check` | GET | 检查当前用户是否管理员 |
| `bindAdmin` | `/api/admin/bind` | POST | 绑定管理员身份 |
| `getCategories` | `/api/categories` | GET | 获取服务分类 |
| `getServices` | `/api/services` | GET | 获取服务列表 |
| `manageService` | `/api/admin/services` | POST/PUT/DELETE | 管理服务项目 |
| `getTimeSlots` | `/api/time-slots` | GET | 获取可预约时间段 |
| `manageTimeSlot` | `/api/admin/time-slots` | POST/PUT/DELETE | 管理时间段 |
| `createAppointment` | `/api/appointments` | POST | 创建预约 |
| `getAppointments` | `/api/appointments` | GET | 获取预约列表 |
| `getAppointmentDetail` | `/api/appointments/:id` | GET | 获取预约详情 |
| `updateAppointment` | `/api/appointments/:id` | PUT | 更新预约状态 |

阶段 1 的关键任务不是一次性重构页面，而是把所有云函数调用替换为 HTTP API 调用。

---

## 七、推荐目录结构

```text
project-root/
├── src/                              # 现有 Taro 前端，继续保留
│   ├── pages/
│   ├── services/
│   │   ├── api.ts                    # 新增：HTTP API 封装
│   │   └── cloud.ts                  # 旧云函数封装，迁移后逐步删除
│   ├── hooks/
│   ├── constants/
│   └── app.config.ts
│
├── server/                           # 新增：Vercel 后端
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.ts
│   │   ├── categories/
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   └── index.ts
│   │   ├── time-slots/
│   │   │   └── index.ts
│   │   ├── appointments/
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   └── admin/
│   │       ├── check.ts
│   │       ├── bind.ts
│   │       ├── services.ts
│   │       └── time-slots.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── wx.ts
│   │   ├── response.ts
│   │   └── errors.ts
│   └── package.json
│
├── scripts/
│   └── migrate-from-wx-cloud.ts       # 云开发数据迁移脚本
│
├── docs/
├── vercel.json
├── .env.example
└── package.json
```

说明：

- 前端继续使用当前 `src` 目录；
- 不新增 `client/`，避免把现有 Taro 项目误拆成 uni-app 结构；
- `cloudfunctions/` 在迁移完成前保留，确认新接口稳定后再删除；
- 后端独立放在 `server/`，方便未来迁到其他 Node 服务。

---

## 八、数据库设计

### users

保存业务用户主体。

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  nickname VARCHAR(100) DEFAULT '微信用户',
  avatar TEXT DEFAULT '',
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'user',
  status SMALLINT DEFAULT 1,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### user_identities

保存不同平台身份，提前预留多端能力。

```sql
CREATE TABLE user_identities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL,
  platform_user_id VARCHAR(128) NOT NULL,
  unionid VARCHAR(128),
  session_key_encrypted TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, platform_user_id)
);

CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
```

### user_sessions

阶段 1 不引入 Redis，但仍要保留 Refresh Token 的服务端状态。`refresh_token_hash` 只保存哈希，不保存明文 Token。

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  platform VARCHAR(30) NOT NULL DEFAULT 'wechat',
  user_agent TEXT,
  ip_address VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
```

### categories

```sql
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### services

```sql
CREATE TABLE services (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  duration_minutes INT,
  image_url TEXT,
  status SMALLINT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### time_slots

```sql
CREATE TABLE time_slots (
  id BIGSERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT DEFAULT 1,
  status SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### appointments

```sql
CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  service_id BIGINT REFERENCES services(id),
  time_slot_id BIGINT REFERENCES time_slots(id),
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  car_model VARCHAR(100),
  remark TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_status ON appointments(status);
```

---

## 九、登录方案

### 阶段 1：Access + Refresh 双 Token

微信小程序端：

```text
Taro.login()
  -> 拿到 code
  -> POST /api/auth/login
  -> 后端请求微信 code2Session
  -> 查找或创建 users + user_identities
  -> 加密保存 session_key 到 user_identities
  -> 创建 user_sessions 记录
  -> 返回 accessToken + refreshToken + userInfo
```

阶段 1 建议直接使用：

```text
Access Token：2 小时，JWT，无需查库
Refresh Token：7 天，明文只返回前端，服务端保存哈希到 Supabase user_sessions
```

这样阶段 1 就具备基础会话控制：

- 管理员解绑或封号后，可以撤销对应 `user_sessions`；
- Refresh Token 丢失或泄露时，可以按会话撤销；
- 登录接口后续迁到 Redis 时，不需要重写前端协议；
- 手机号授权依赖的 `session_key` 有服务端存储位置。

微信 `session_key` 不允许下发到前端。只要阶段 1 需要支持 `getPhoneNumber`、手机号绑定或加密数据解密，就必须在服务端加密保存 `session_key`。可以先放在 `user_identities.session_key_encrypted`，并通过 `updated_at` 判断是否过期；后续再迁到 Upstash Redis 并设置 TTL。

### 阶段 3：升级 Redis 会话

商用或用户量上升后，把 `user_sessions` 的高频会话状态迁到 Upstash Redis：

```text
Access Token：2 小时，仍使用 JWT
Refresh Token：7-30 天
Refresh Token 状态：Upstash Redis
Supabase user_sessions：可保留为审计记录
```

这样可以支持：

- 主动退出；
- 多设备会话管理；
- 踢人；
- Token 失效控制；
- 风控限流。

---

## 十、前端改造原则

当前前端不用重写，只改请求层。

原调用方式：

```text
wx.cloud.callFunction / Taro.cloud.callFunction
```

迁移后：

```text
Taro.request
```

建议封装：

```text
src/services/api.ts
```

封装职责：

- 统一 `baseUrl`；
- 自动带 `Authorization`；
- 统一处理错误；
- 统一处理登录失效；
- 屏蔽微信端、H5 端请求差异。

各页面只调用业务 API，不直接关心后端平台。

---

## 十一、环境变量

阶段 1 需要：

```env
# 微信小程序
WX_APPID=wx_your_appid
WX_SECRET=your_wx_secret

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth
JWT_SECRET=your_random_secret
JWT_EXPIRES_IN=7d

# App
NODE_ENV=production
```

阶段 2 增加：

```env
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket
COS_REGION=ap-guangzhou
COS_PUBLIC_BASE_URL=https://example.com
```

阶段 3 增加：

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
JWT_ACCESS_EXPIRES=2h
JWT_REFRESH_EXPIRES=7d
```

---

## 十二、部署步骤

### 阶段 1 部署

1. 创建 Supabase 项目；
2. 在 Supabase SQL Editor 中创建数据表；
3. 新增 `server/api` 后端接口；
4. 在 Vercel 中导入 GitHub 仓库；
5. 配置环境变量；
6. 部署 Vercel；
7. 开发期用 Vercel 默认域名联调；
8. 体验版/正式版上线前准备备案自有域名，例如 `api.xxx.com`；
9. 将自有域名绑定到 Vercel，并在小程序后台添加 request 合法域名；
10. 前端请求层切换到新 API；
11. 按云函数逐个迁移和验证。

### 推荐迁移顺序

```text
1. login
2. getCategories
3. getServices
4. getTimeSlots
5. createAppointment
6. getAppointments
7. getAppointmentDetail
8. updateAppointment
9. checkAdmin
10. bindAdmin
11. manageService
12. manageTimeSlot
```

先迁用户侧查询和预约，再迁管理员能力。这样风险较低。

---

## 十三、费用预估

### 阶段 1：个人项目免费优先

| 服务 | 套餐 | 费用 | 说明 |
|---|---|---|---|
| Vercel | Hobby | ¥0 | 适合个人项目和早期验证 |
| Supabase | Free | ¥0 | 500MB 数据库，低活跃项目需保活 |
| 域名 | 开发期可暂不买 | ¥0 | 体验版/正式版上线前必须准备备案自有域名 |
| 合计 | | ¥0 | 个人项目可先零成本运行 |

注意：Vercel 默认 `*.vercel.app` 域名只适合开发联调。微信小程序体验版/正式版需要 HTTPS、已备案、可配置到小程序后台的自有 request 合法域名。阶段 1 如果要上体验版或正式版，就要提前准备 `api.xxx.com`，不能等阶段 4。

Supabase Free 适合 MVP，但低活跃项目可能因长期无请求被暂停。预约类项目如果几天才有人打开，应配置定时 ping 保活，或在正式商用时直接升级 Supabase Pro。

### 阶段 2：加入 COS

| 服务 | 费用 | 说明 |
|---|---|---|
| 腾讯云 COS | 约 ¥3-10/月 | 取决于图片数量和访问量 |
| 域名 | 约 ¥50-70/年 | 正式小程序建议准备 |

如果服务图、案例图、头像等图片开始由后台上传，不建议继续放 Supabase Storage。Supabase 免费存储额度有限，图片增长比预约数据快，阶段 2 应提前接 COS，而不是等存储超额后再迁。

### 阶段 3：加入 Redis 和商用能力

| 服务 | 费用 | 说明 |
|---|---|---|
| Upstash Redis | 免费起 / 按量 | 用于会话、限流、验证码 |
| Supabase Pro | 需要时升级 | 数据量、稳定性、备份要求上来后再升 |
| Vercel Pro | 需要时升级 | 团队协作、商用限制、资源增长时再考虑 |

---

## 十四、注意事项

### 1. 免费不等于永久生产免费

免费额度适合个人项目、MVP 和早期验证。后续如果用户量、访问量、数据量增长，应按实际使用量升级。

阶段 1 使用 Vercel Hobby 可以，但它不是长期生产承诺。函数有超时、冷启动和平台限流风险；微信 `code2Session` 通常很快，但冷启动叠加 Supabase 请求时可能出现 1-2 秒延迟。建议把阈值写清楚：日活超过 500、预约高峰明显、或进入正式商用后，应评估 Vercel Pro 或迁到腾讯云轻量服务器。

### 2. 体验版和正式版必须使用自有域名

开发者工具可以勾选“不校验合法域名”来调试 Vercel 默认域名。体验版和正式版不能依赖这个开关，必须使用小程序后台允许配置的 HTTPS 备案自有域名，例如 `api.xxx.com`，再 CNAME 到 Vercel。

### 3. 不要提前实现完整多端登录

数据库结构先预留 `user_identities`，但阶段 1 只实现微信登录。等微信端稳定后，再接抖音、支付宝、H5。

### 4. Redis 可以暂缓，但 Refresh Token 不能暂缓

阶段 1 不引入 Upstash，但需要用 Supabase `user_sessions` 保存 Refresh Token 哈希。这样能支持基础会话控制，也避免阶段 3 再重写登录接口。等需要更高性能的会话、限流、验证码时，再把会话状态迁到 Upstash。

### 5. session_key 阶段 1 就要服务端保存

只要支持微信手机号授权或加密数据解密，后端就必须保存 `session_key`。不能存在前端，也不能等阶段 3 Redis 才处理。阶段 1 可以先加密保存在 `user_identities.session_key_encrypted`，并通过 `updated_at` 判断是否需要重新登录刷新。

### 6. 保留迁移退路

后端接口保持 REST 风格，业务逻辑放在 `server/lib` 中。这样未来可以从 Vercel 迁到腾讯云轻量、阿里云、NestJS 或 Express，不需要重写前端。

---

## 十五、最终建议

本项目推荐路线：

```text
阶段 1：Taro + Vercel + Supabase
阶段 2：加入 COS
阶段 3：加入 Upstash，升级 Redis 会话
阶段 4：多端登录
```

现阶段最重要的不是“换前端框架”，而是：

```text
把微信云函数调用迁移成通用 HTTP API
把微信云数据库迁移成通用关系型数据库
把用户身份从单一 openid 扩展为 platform identity
```

这样既能保持个人项目的低成本，也给后续商用留出足够空间。

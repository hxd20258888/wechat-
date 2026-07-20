# 小程序 Bug 清单

更新时间：2026-07-20

这份清单只保留本轮复核后仍然存在、需要继续处理的问题。已经通过检查或已经修复的问题，不再放在“待修复问题”里，避免后续排查时重复处理。

## 本轮复核方式

- 运行 TypeScript 静态检查：`tsc --noEmit`
- 批量检查云函数 JS 语法：`node --check cloudfunctions/**/index.js`
- 运行已有测试：
  - `cloudfunctions/createAppointment/defaults.test.js`
  - `src/pages/mine/profile.test.ts`
- 人工走查关键流程代码：公共云函数调用、管理员预约列表、应用配置、时段管理、预约提交。

## 待修复问题

### P0 - 前端公共云函数封装文件语法损坏，项目无法通过 TypeScript 编译

- 位置：`src/services/cloud.ts`
- 当前状态：未修复。
- 复核证据：本轮执行 `tsc --noEmit` 仍失败。
- 报错摘要：
  - `src/services/cloud.ts(19,28): error TS1005: ',' expected.`
  - `src/services/cloud.ts(32,1): error TS1160: Unterminated template literal.`
- 中文说明：这个文件是所有页面调用云函数的公共入口。现在文件里有字符串没有正常结束，还有一行 `console.error` 不是合法 TypeScript。只要这里没修好，小程序前端就无法稳定编译，预约、登录、管理员管理等依赖云函数的页面都会受影响。
- 建议处理：恢复为合法 UTF-8 TypeScript，并保留“云函数返回空值时给出清晰错误”的保护逻辑。

建议修复形态参考：

```ts
import Taro from '@tarojs/taro'

const isWeapp = process.env.TARO_ENV === 'weapp'

export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  if (!isWeapp) {
    throw new Error(`[Cloud] ${name} 只能在微信小程序端调用`)
  }

  const res = await Taro.cloud.callFunction({ name, data })
  const result = res.result as { code: number; message: string; data: T } | null | undefined

  if (!result || typeof result.code !== 'number') {
    console.error(`[Cloud] ${name} returned invalid result:`, res.result)
    throw new Error('云函数返回异常，请稍后重试')
  }

  if (result.code !== 0) {
    console.error(`[Cloud] ${name} failed:`, result.message)
    throw new Error(result.message || '请求失败')
  }

  return result.data
}

export function getDatabase() {
  if (!isWeapp) {
    return null
  }
  return Taro.cloud.database()
}
```

### P0 - 管理员预约列表云函数的管理员查询分支被注释吞掉

- 位置：`cloudfunctions/getAppointments/index.js:17`
- 当前状态：未修复。
- 复核证据：本轮读取文件时，第 17 行仍然是注释和代码混在同一行：`// ... query = db.collection('appointments')`。
- 中文说明：管理员查看预约列表时，代码应该查询全部预约。但现在真正的查询语句被乱码注释吞掉了，导致管理员分支没有给 `query` 赋值。后面再执行 `query.orderBy(...)` 时就可能报错，管理员预约管理页会加载失败。
- 建议处理：把管理员分支恢复成明确的两行，注释和代码分开写。

建议修复形态参考：

```js
if (isUserAdmin && isAdmin !== false) {
  // 管理员查看所有预约
  query = db.collection('appointments')
} else {
  // 普通用户只查看自己的预约
  query = db.collection('appointments').where({ _openid: openid })
}
```

### P1 - 小程序标题和底部 Tab 文案仍是乱码

- 位置：`src/app.config.ts`
- 当前状态：未修复。
- 复核证据：本轮读取文件时仍看到 `navigationBarTitleText: '杞﹂煶宸ュ潑'`，Tab 文案仍是 `棣栭〉`、`棰勭害`、`鎴戠殑`。
- 中文说明：这不会一定阻断编译，但会直接影响用户看到的小程序标题和底部导航。用户打开后会看到乱码，体验很差，也容易误以为小程序坏了。
- 建议处理：恢复正确中文文案。

建议修复形态参考：

```ts
navigationBarTitleText: '车音工坊'
```

Tab 文案建议恢复为：

- 首页
- 预约
- 我的

### P1 - `manageTimeSlot` 云函数错误提示仍有乱码

- 位置：`cloudfunctions/manageTimeSlot/index.js`
- 当前状态：部分逻辑已可通过语法检查，但错误文案未修复。
- 复核证据：本轮扫描仍存在：
  - `鏃犵鐞嗗憳鏉冮檺`
  - `鏈煡鎿嶄綔`
  - `鏈嶅姟寮傚父`
- 中文说明：这个问题不一定影响时段保存逻辑执行，但一旦报错，管理员看到的提示不可读，排查云函数日志也很费劲。
- 建议处理：统一恢复为：
  - `无管理员权限`
  - `未知操作`
  - `服务异常`

## 本轮已复核通过，不再列为待修 Bug

### 预约提交事务返回值归一化

- 位置：`cloudfunctions/createAppointment/defaults.js`、`cloudfunctions/createAppointment/index.js`
- 复核结果：`cloudfunctions/createAppointment/defaults.test.js` 3 个测试通过。
- 说明：事务直接返回结果和 SDK 包一层 `result` 的情况都已覆盖，空返回也会转成明确错误。

### 我的页面头像 cloud 文件 ID 回显处理

- 位置：`src/pages/mine/profile.ts`
- 复核结果：`src/pages/mine/profile.test.ts` 2 个测试通过。
- 说明：`cloud://` 头像会转换成临时可显示地址，普通 HTTP 图片地址保持不变。

### 云函数 JS 语法批量检查

- 范围：`cloudfunctions/**/index.js`
- 复核结果：本轮批量执行 `node --check` 未发现 JS 语法错误。
- 说明：这只能证明语法层面没有问题，不代表云端权限、数据库索引、真实数据流程都已经通过。

## 当前测试受阻说明

Taro 完整构建和微信开发者工具端到端测试暂时不建议继续跑，因为 `src/services/cloud.ts` 仍然存在 P0 编译错误。应先修复 `cloud.ts`，再执行完整构建和真机/开发者工具流程测试。

## 修复后建议复测流程

1. 执行 `tsc --noEmit`，确认 TypeScript 静态检查通过。
2. 执行 `npm run build:weapp` 或微信开发者工具编译，确认小程序能正常生成。
3. 上传并部署改动过的云函数，尤其是 `getAppointments`、`manageTimeSlot`、`createAppointment`。
4. 普通用户流程：登录、完善头像昵称、退出再登录、预约服务。
5. 管理员流程：保存每周时段、查看预约列表、更新预约状态、管理服务。
6. 检查页面标题、底部 Tab、Toast、错误提示是否都显示正常中文。

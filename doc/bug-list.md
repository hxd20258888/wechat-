# 小程序 Bug 清单

更新时间：2026-07-21

这份清单记录本轮复核后仍然存在、需要继续处理的问题。当前复核结论：未发现阻断小程序构建或现有自动化测试的运行级 Bug；剩余问题主要是静态类型检查基线和少量提示文案清理。

## 本轮复核方式

- 运行 TypeScript 静态检查：`tsc --noEmit`
- 批量检查云函数 JS 语法：`node --check cloudfunctions/**/index.js`
- 运行已有测试：
  - `cloudfunctions/createAppointment/defaults.test.js`
  - `src/pages/mine/profile.test.ts`
- 执行微信小程序构建：`taro build --type weapp`
- 人工走查关键文件：
  - `src/services/cloud.ts`
  - `cloudfunctions/getAppointments/index.js`
  - `cloudfunctions/manageTimeSlot/index.js`
  - `src/app.config.ts`

## 待处理问题

### P2 - TypeScript 静态检查基线仍不干净

- 位置：`tsconfig.json` 覆盖的前端源码与 Taro 依赖类型。
- 当前状态：未修复，但不阻断当前小程序构建。
- 复核证据：`tsc --noEmit` 仍失败。当前输出中包含：
  - Taro 依赖类型问题：`CommonEventFunction` 缺失、`react-native` / `vue` / `@vue/runtime-core` 类型缺失、部分 Taro `.d.ts` 泛型约束错误。
  - 项目源码未使用变量：多个页面 `React` 默认导入未使用，`src/pages/home/index.tsx` 的 `loading` 未使用。
  - `src/pages/mine/index.tsx` 仍有两个具体类型错误：`Taro.showModal` 参数里 `editable` 不存在，返回值上 `content` 不存在。
- 影响：完整静态类型检查仍不能作为可靠门禁；不过本轮 `taro build --type weapp` 已通过，说明这些类型问题当前没有阻断小程序构建。
- 建议方案：后续作为类型基线清理处理。优先确认 `src/pages/mine/index.tsx` 的输入弹窗实现是否需要兼容当前 Taro 类型，再清理未使用导入/状态，最后统一处理 Taro 第三方声明类型问题。

### P3 - `manageTimeSlot` 非管理员错误提示语义可优化

- 位置：`cloudfunctions/manageTimeSlot/index.js:57`
- 当前状态：不影响运行，仅文案语义不够准确。
- 复核证据：当前非管理员分支返回：`return { code: -2, message: '检查管理员权限', data: null }`。
- 影响：权限校验逻辑可以运行，云函数 JS 语法检查通过；但用户/管理员看到 `检查管理员权限` 不如 `无管理员权限` 清晰。
- 建议方案：后续只调整文案，不改业务逻辑：`检查管理员权限` -> `无管理员权限`。

## 本轮复核通过

### 小程序标题和底部 Tab 文案

- 位置：`src/app.config.ts`
- 复核结果：已确认。
- 证据：小程序标题当前为 `小亮云办公`，这是已确认的产品文案；Tab 文案当前为 `首页`、`预约`、`我的`。

### 前端公共云函数封装文件语法损坏

- 位置：`src/services/cloud.ts`
- 复核结果：已修复。
- 证据：文件已恢复为合法 TypeScript，包含正确中文错误提示：`只能在微信小程序端调用`、`云函数返回异常，请稍后重试`、`请求失败`；`taro build --type weapp` 已通过。

### 管理员预约列表云函数查询分支

- 位置：`cloudfunctions/getAppointments/index.js`
- 复核结果：已修复。
- 证据：管理员分支当前为两行明确代码：
  - `// 管理员查看所有预约`
  - `query = db.collection('appointments')`
- 说明：这修复了管理员分支 `query` 未赋值的运行时风险。

### `manageTimeSlot` 云函数主要错误文案

- 位置：`cloudfunctions/manageTimeSlot/index.js`
- 复核结果：主要文案已恢复。
- 证据：当前文件包含 `检查管理员权限`、`未知操作`、`服务异常` 等可读中文文案；`node --check` 通过。
- 说明：仅剩非管理员返回文案语义可优化，已降级到 P3。

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

### 微信小程序构建

- 命令：`taro build --type weapp`
- 复核结果：提权运行后 Webpack 编译成功，耗时约 18.69 秒。
- 说明：普通沙箱运行仍会先遇到 `@tarojs/plugin-html` 写入 `node_modules` 的 `EPERM`，这是本地权限限制；提权后可完成真实构建验证。

## 建议下一步

1. 如需把 `tsc --noEmit` 作为门禁，再单独清理 TypeScript 类型基线。
2. 有空时把 `manageTimeSlot` 非管理员错误提示改为 `无管理员权限`，提升提示准确性。
3. 部署改动过的云函数后，继续做普通用户和管理员主流程手工验证。

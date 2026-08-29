# 阶段三：React 18/19 依赖分裂调研（#14-16）

> 数据来源：
> - 各包 package.json（直接依赖声明）
> - docs/evidence/deps-duplicates-2026-08-13.txt（bun pm ls --all 聚合）
> 调研日期：2026-08-13 | 只读，未修改任何 package.json

---

## 一、React 版本分布

| 包 | React | React-DOM | @types/react | 备注 |
|-----|-------|-----------|-------------|------|
| apps/desktop | ^19.1.0 | ^19.1.0 | ^19.1.8 | 主应用 |
| apps/creator-dashboard | ^19.1.0 | ^19.1.0 | ^19.1.8 | 创作者面板 |
| apps/plugin-market | ^18.3.0 | ^18.3.0 | ^18.3.0 | 插件市场（Next.js 15） |
| docs/developer | ^18.3.1 | ^18.3.1 | ^18.3.12 | 文档站点 |

**实际安装版本**（bun pm ls 聚合）：
- react: 18.3.1, 19.2.7（两个版本共存于 node_modules）
- react-dom: 18.3.1, 19.2.7
- scheduler: 0.23.2, 0.27.0（React 内部调度器，两个版本）

---

## 二、plugin-market 为什么单独锁 React 18

plugin-market 使用 Next.js 15.5.21。Next.js 15 官方支持 React 19（从 15.0.0 起），但 plugin-market 的 package.json 显式声明了 react: ^18.3.0。

可能原因（按可能性排序）：
1. 历史遗留：plugin-market 创建时 React 19 尚未稳定，后续未更新声明
2. 依赖兼容性：plugin-market 依赖 @open-factory/plugin-market（workspace:*），该包可能有用到 React 18 特有的 API 或类型
3. Next.js 配置惯性：部分 Next.js 15 项目仍使用 React 18 以规避 React 19 的 breaking changes

判定：plugin-market 升级到 React 19 的可行性高。Next.js 15 完全兼容 React 19，且 @open-factory/plugin-market 是纯 TypeScript 类型包，不依赖 React 运行时。

---

## 三、56 个重复版本分析

### 需要统一的关键依赖

| 包名 | 当前版本 | 问题 |
|------|---------|------|
| react | 18.3.1, 19.2.7 | 两个大版本共存，增加 bundle 体积 |
| react-dom | 18.3.1, 19.2.7 | 同上 |
| @types/react | 18.3.31, 19.2.17 | 类型定义不一致 |
| @types/react-dom | 18.3.7, 19.2.3 | 同上 |
| scheduler | 0.23.2, 0.27.0 | React 内部包，随 react 版本决定 |
| tailwindcss | 3.4.19, 4.3.2 | plugin-market 用 v3，desktop 用 v4 |
| vite | 6.4.3, 7.3.5 | 两个 Vite 版本 |

### 无害的传递依赖重复（无需处理）

以下重复是不同包的传递依赖各自锁定不同主版本导致，属于正常现象：
- @types/node（22/20/26）— 不同包的目标 Node 版本不同
- commander（12/15/4）— CLI 工具依赖，互不影响
- eslint-visitor-keys、glob、minimatch、semver 等工具链依赖
- ajv（8/6）— JSON Schema 校验，不同包不同版本正常
- debug、ms、cookie 等服务端依赖 — 仅非前端包使用

---

## 四、统一方案建议

### 方案 A：统一到 React 19（推荐）

步骤：
1. 将 plugin-market 的 react/react-dom 从 ^18.3.0 升级到 ^19.1.0
2. 将 docs/developer 的 react 升级到 ^19.1.0
3. 同步更新 @types/react 和 @types/react-dom
4. 运行 plugin-market 的 typecheck + build + 测试

风险：
- plugin-market 中如有使用 React 18 废弃 API，需逐个修复
- 低风险：plugin-market 代码量小（17 个测试），Next.js 15 已充分测试 React 19 兼容性

工作量：0.5-1 天

### 方案 B：保持现状，仅消除重复安装

步骤：在根 package.json 添加 overrides/resolutions 强制统一 react 版本
风险：可能与 peerDependencies 冲突，未解决根本问题
工作量：0.5 天

建议：推荐方案 A。统一后可消除 5 个 React 相关重复依赖。
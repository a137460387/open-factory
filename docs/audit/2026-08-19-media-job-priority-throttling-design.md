# 后台媒体任务「优先级调度 + 显式限流」——调研与设计方案

日期：2026-08-19
状态：调研 + 设计方案（本轮不产生生产代码改动）
关联：roadmap「Next (v4.26+)」未勾选项「Priority scheduling and explicit throttling controls for background media jobs」

---

## 1. 现状调研

### 1.1 三层调度架构

| 层 | 文件 | 职责 | 关键事实 |
|---|---|---|---|
| 并发控制 | `apps/desktop/src/media/media-concurrency.ts`（78 行） | `MediaSemaphore` FIFO 信号量 + 两个共享池 | limit **硬编码**；FIFO **不感知优先级** |
| 状态/队列 | `apps/desktop/src/media/media-job-store.ts`（328 行） | job 队列 + 优先级 + 选任务 | 已有 high/low 2 级优先级 + `compareMediaJobPriority` + `moveJobBefore` |
| 运行 | `apps/desktop/src/media/media-job-runner.ts`（109 行） | 并发执行循环 | 一次填满 limit 槽位，`Promise.race` 补位 |

### 1.2 并发池现状（硬编码）

- `backgroundMediaPool` = `defaultBackgroundPoolLimit()` = `min(4, max(1, floor(cores/2)))`（**用户不可调**）
- `uiFeedbackPool` = `UI_FEEDBACK_POOL_LIMIT` = 3（**用户不可调**）
- 两池互不感知（审计 H2 设计：后台批量与实时 UI 反馈分离，避免饿死用户交互）

### 1.3 优先级现状

- `MediaJobPriority = 'high' | 'low'`（2 级）
- `compareMediaJobPriority` 排序键：status（running>pending>error>canceled>success）> priority（high>low）> createdAt > id
- `startNextJob` 取排序后第一个 pending；runner 一次填满 limit 槽位 → **运行中任务不可被高优先级抢占**，只能在槽位释放后让高优先级排前
- `moveJobBefore`：手动拖拽重排（TaskMonitorSettingsPanel 已有拖拽 UI）
- `upgradeExistingProxyJobs`：仅 proxy 任务支持入队时升级优先级

### 1.4 UI 现状

`apps/desktop/src/settings/TaskMonitorSettingsPanel.tsx`（245 行）：任务列表（文件/类型/进度/状态/ETA）+ 取消/重试/清除 + 拖拽重排 + 系统资源快照（CPU/内存/运行数）。
**缺**：并发上限设置、暂停/恢复、优先级调整按钮、优先级展示。

### 1.5 设置持久化参照

`apps/desktop/src/store/proxySettingsStore.ts` 用 localStorage（`open-factory:proxy-settings`）+ zustand，可作为新设置 store 的模板。

### 1.6 测试现状

- `media-concurrency.test.ts`：MediaSemaphore 并发/排队
- `media-job-monitor.test.ts`：排序/重排/ETA
- `background-media-task-queue.test.ts`：兼容 API

---

## 2. 缺口分析（对应 roadmap 目标）

| roadmap 目标 | 现状缺口 |
|---|---|
| Priority scheduling | 仅 2 级；运行中任务不可抢占；仅 proxy 支持升级；无 UI 表达优先级 |
| Explicit throttling controls | limit 硬编码；无暂停/恢复；无持久化设置 |

---

## 3. 设计方案

### 3.1 显式限流控制（throttling）

**新增 `mediaJobSettingsStore`**（参照 proxySettingsStore 的 localStorage 持久化模式）：

| 设置项 | 默认 | 范围 | 说明 |
|---|---|---|---|
| `backgroundConcurrency` | 'auto' | auto / 1 / 2 / 3 / 4 | 后台批量池并发上限 |
| `uiFeedbackConcurrency` | 3 | 1 / 2 / 3 | UI 反馈池并发上限 |
| `paused` | false | bool | 暂停/恢复后台队列（不取新任务） |

**`MediaSemaphore` 支持动态 limit**：新增 `setLimit(n)`，立即生效（已 active 不缩减，新 acquire 受新 limit 约束）。

**runner 支持暂停**：`runJobs` 循环检查 `paused`；paused 时不再 `startNextJob`，运行中任务自然完成。

### 3.2 优先级调度增强

**优先级扩展**：`'high' | 'normal' | 'low'`（3 级，默认 normal）。

**高优先级抢占策略（推荐方案 A）**：
- 方案 A（**推荐**，低风险）：不中断运行中任务；高优先级任务入队后参与 `compareMediaJobPriority` 排序，在下一个槽位释放时**排在最前**。运行中的低优先级任务自然完成。
- 方案 B（高风险）：运行中低优先级任务可被抢占中断，涉及取消 FFmpeg 子进程 + 进度回滚，复杂度高、收益有限，**不推荐**。

**UI 表达**：
- 任务行显示优先级徽标（高/中/低）。
- 提供「提升/降低优先级」按钮，调用新增 `setJobPriority(jobId, priority)` action。
- 选中片段的 proxy 生成提升为 high（现有 `upgradeExistingProxyJobs` 接线补全）。

### 3.3 UI 改动（TaskMonitorSettingsPanel）

- 顶部：并发上限选择器（auto/1/2/3/4）+ 暂停/恢复开关。
- 任务行：优先级徽标 + 提升/降低按钮。
- i18n 补充（`zhCN.settings.taskMonitor.*` + en-overrides）。

### 3.4 测试策略

- `media-concurrency.test.ts`：`setLimit` 动态调整（缩小 limit 后新任务排队、active 不缩减）。
- `media-job-store.test.ts`：`setJobPriority`、暂停/恢复（paused 时 runner 不取新任务）。
- `mediaJobSettingsStore`：持久化读写 + 归一化。
- E2E（可选）：TaskMonitor 面板拖拽 + 优先级调整 + 并发设置。

---

## 4. 需要用户决策的开放问题

1. **优先级粒度**：2 级 → 3 级（high/normal/low），还是保留 2 级只补 UI 表达？（推荐 3 级）
2. **抢占策略**：方案 A（不中断、下个槽位优先，推荐）还是方案 B（可中断运行中任务）？
3. **并发上限范围**：auto/1/2/3/4 是否够？是否需要支持更高（如 8）？
4. **暂停语义**：暂停 = 「停止取新任务」还是「暂停运行中任务」？（推荐前者，后者需 FFmpeg 暂停支持）
5. **依赖**：无新增（纯前端 + 现有 zustand/localStorage 模式）。

（若按最小风险默认——3 级优先级 + 方案 A + auto/1-4 + 暂停取新任务——改动收敛为：新增 mediaJobSettingsStore + MediaSemaphore.setLimit + runner 暂停检查 + 优先级扩展 + TaskMonitor UI，约 400-500 行，无新依赖，editor-core 零改动。）

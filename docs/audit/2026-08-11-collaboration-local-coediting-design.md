# collaboration 系列（×7）本机多窗口模拟协同 —— 调研与设计方案

日期：2026-08-11（仅调研+设计，零生产代码改动、零 commit、零分支）
目标：让 `e2e/collaboration.spec.ts` 的 7 例（:14/:28/:45/:69/:107/:128/:174）转绿。
形态约束：本机多进程/多窗口模拟协同；无网络发现、无外部服务器。
注：spec 文件实际含第 8 例 :152（并发编辑冲突提示），不在本次 7 例清单内，其断言为 `if visible` 软门控、当前空跑即过，本方案不覆盖（列为开放问题）。

---

## 1. 现有代码调研结论

**结论：传输/控制/状态层约 90% 已存在且已接线，可直接复用；会话面板 UI、工具菜单入口、E2E 模拟钩子为 0，需新建。**

| 层 | 现状 | 完成度/可复用性 |
|---|---|---|
| editor-core 协作原语 | `collaboration.ts`（role: host/client；permission: read-only/edit；operation kinds: timeline-command/comment/playhead/project-sync；presence/clip-lock/rebase/serialize/apply 全套）、`collaboration-permissions.ts`（owner/editor/commenter/viewer + PermissionAction 矩阵）、`collaboration-notes.ts`（笔记/报告） | 完整，纯函数，直接复用 |
| Rust 传输 | `src-tauri/src/commands/collaboration.rs`（225 行）：WebSocket-over-TCP host（默认端口 37822，network_mode `localhost`=仅回环 / `lan`，可选 auth token 握手），收到客户端消息 → `app.emit("collaboration-message")` 广播到**所有窗口** + 转发其他 TCP 客户端；`broadcast_collaboration_message` 同时发 TCP 通道与本地 emit（**本机自环**）。含单测 | 完整，已在 lib.rs 注册，零改动可用 |
| tauri-bridge | `window.ts`：startCollaborationHost / stopCollaborationHost / broadcastCollaborationMessage / listenCollaborationMessage（= listenBridge('collaboration-message')） | 完整 |
| 控制器 | `src/collaboration/local-network.ts`（294 行）：enableHost / enableClient(permission) / disable / broadcastCommand / broadcastProjectSync / receiveMessage（presence→用户列表+clip 锁；operation→应用远端项目；project-sync→client 重连同步）/ updatePresence | 完整 |
| 命令广播接线 | `store/commandManager.ts:47`：**每个 timeline 命令已自动 `collaborationController.broadcastCommand(command)`** | 已接线（:69 的同步断言基础） |
| UI 状态 store | `store/collaborationStore.ts`（44 行）：enabled/role/permission/userId/users/locks/operations/lastSyncAt + setControllerState/reset | 完整，需扩 sessionId/锁定字段 |
| E2E bridge mocks | `install-mocks.ts`：host/broadcast mocks 齐全，broadcast 走页内 `emit('collaboration-message')` 自环；已有 enableMockCollaboration / disableMockCollaboration / emitMockCollaborationMessage / getCollaborationState / getCollaborationBroadcastMessages / getCollaborationHostState | 完整，需扩 6 个 simulate* 钩子 |
| 设置入口 | `GeneralSettingsPanel.tsx` settings-local-coediting-*（enabled/mode host-client/permission/port/host-url）+ `collaboration/settings.ts` applyLocalCoeditingSettings | 已存在（2026-08-09 审计确认的"本地协同编辑"新形态设置面） |
| 面板/组件 | `CollaborationNotesPanel.tsx`（301 行，挂载于 MediaCompareDialogs，是"笔记"面板，**不是** spec 要的会话面板）；`ColorGradingWorkspace.tsx`（`color-grading-workspace` ✓）+ `ColorWheelPanel.tsx`（`color-wheel-panel` ✓）+ `PrimarySlidersPanel.tsx`（`slider-{label}` 动态 testid，现有滑块：色温/色调/对比度/轴心/饱和度/色相——**无"亮度"**）；调色工作区目前仅内嵌于 Inspector EffectPanel | 调色组件可复用，缺独立入口与亮度滑块（软门控，非必需） |
| **缺失清单** | `collaboration-panel`、`collab-session-status`、`collab-create-session-button`、`collab-session-id`、`collab-invite-section`、`collab-user-*`、`collab-comment-*`、`collab-lock-status`、`collab-readonly-notice`、`toolbar-tools-collaboration-menu-item`、`toolbar-tools-color-grading-menu-item`、simulateCollabUserJoin / simulateCollabSessionActive / simulateCollabRole / simulateCollabConflict / simulateCollabLock / getCollabOperationsSent —— **全部 0 命中** | 需新建 |

## 2. 技术底座确认

**Tauri 2 + Rust**（依据：`apps/desktop/src-tauri/`、tauri.conf.json v4.73.0、package.json 无任何 electron 依赖、AGENTS.md 声明）。

多窗口能力事实：
- Tauri 应用 = 单进程多 WebviewWindow。`app.emit`（Rust 侧）/`emit`（JS 侧，tauri-bridge 已封装 emitBridge）事件**送达同进程所有窗口**——本机多窗口同步的天然通道，**已有实现**（collaboration.rs 的 `app.emit("collaboration-message")`）。
- 二级窗口先例已存在：`openPreviewWindow`（Rust 命令 + bridge + mock 全链路）。
- TCP WebSocket 层已实现，但注意：**当前没有 client 端 TCP 连接命令**——`enableClient` 只监听本地 emit，不连 host 的 TCP。本机多窗口场景下这恰好不是缺陷（同进程 emit 直达）；跨机 lan 场景才需要补 client 连接。
- E2E 环境 = Playwright Chromium + Vite dev server + install-mocks 模拟 Tauri。spec 的 7 例**全部通过 `__E2E_ACTIONS__.simulateCollab*` 页内钩子模拟远端用户**（不真开第二窗口）——这是既有 spec 写法，意味着 e2e 层验证的是"单窗口 UI + 模拟远端事件"，真实多窗口是产品能力、不由这 7 例直接驱动。

## 3. 七个用例行为规格提取（唯一规格来源 = spec 原文）

| # | 用例 | 硬断言（必须满足） | 软门控（`if visible`/恒真，不满足也不失败） |
|---|---|---|---|
| :14 | 开启协作会话并显示用户面板 | 工具菜单 → `toolbar-tools-collaboration-menu-item` → `collaboration-panel` 可见；`collab-session-status` 可见且含文本 **"未连接"** | — |
| :28 | 创建协作会话并邀请用户 | `collab-create-session-button` 可点 → `collab-session-status` 含 **"已创建"**；`collab-session-id` 可见；`collab-invite-section` 可见 | — |
| :45 | 用户加入后显示在线状态 | `simulateCollabUserJoin({userId:'remote-user-1',userName:'Bob',role:'editor',color})` 后开面板：`collab-user-remote-user-1` 可见且含 "Bob"；`collab-user-remote-user-1-status` 有 `data-online="true"` | — |
| :69 | 调色参数变更应同步到远程 | 导入媒体、`simulateCollabSessionActive()`、拖卡入时间线、点选 clip、工具菜单 → `toolbar-tools-color-grading-menu-item` → `color-grading-workspace` **可见** | `slider-brightness` 存在才 fill；`getCollabOperationsSent()` 断言 `>=0` 恒真 |
| :107 | 查看者不应能修改调色参数 | `simulateCollabRole('viewer')` 后开调色菜单（菜单项必须可点） | 若 `color-wheel-panel` 可见 → `collab-readonly-notice` 必须可见（条件成立时是硬断言） |
| :128 | 应能添加和查看评论 | `simulateCollabSessionActive()` 后开面板 | 若 `collab-comment-input` 可见 → fill + `collab-comment-submit` → `collab-comment-list` 含评论文本（条件成立时是硬断言） |
| :174 | 会话锁定应阻止其他用户编辑 | `simulateCollabSessionActive()` + `simulateCollabLock('other-user')` 后开面板 | 若 `collab-lock-status` 3s 内可见 → 必须含 **"已锁定"**（条件成立时是硬断言） |

关键推论：
- 评论（:128）与锁定（:174）的 UI 一旦实现即受硬断言约束——**做就必须做对**，不做则空跑通过。按"实现本地协同新形态"的方向，应当实现。
- `slider-brightness` 与 :152 冲突提示是唯一可合法不做的两项。
- `__E2E_ACTIONS__` 类型是宽松 `Record<string, (...args)=>unknown>`（vite-env.d.ts），新增钩子无类型手术。

## 4. 同步机制候选方案对比

| 方案 | 机制 | 现状 | 权衡 |
|---|---|---|---|
| **A. Tauri app.emit 事件扇出（推荐）** | 任一窗口 `broadcastCollaborationMessage` → Rust `app.emit` → 同进程所有窗口 `listenCollaborationMessage` 收到 | **已实现**（Rust+bridge+控制器+mock 自环全链路） | ✅ 零新增代码即可跨窗口；同进程低延迟；e2e mock 已用页内 emit 自环模拟。⚠️ 仅限同进程（本机多窗口正好满足）；跨机需 TCP |
| B. WebSocket TCP localhost | 新窗口作为 client 连 `ws://127.0.0.1:37822`（host 已实现） | host 侧已实现；**client 连接命令缺失** | ✅ 与 lan 场景同构、可演进到跨机；token 鉴权已有。⚠️ 需新增 Rust client 命令+前端连接逻辑（新代码面）；本机场景相对 A 是绕路 |
| C. 共享状态文件 + 轮询/fs-watch | 会话状态写 appData 文件，各窗口轮询 | 无 | ✅ 极简、不依赖事件系统。⚠️ 延迟高、竞态多、与既有控制器完全并行（重复建设），不推荐 |
| D. BroadcastChannel API | 浏览器同源跨上下文通道 | 无 | ✅ e2e（Chromium 多 page）天然可用。⚠️ Tauri 各平台 Webview（WebView2/WKWebView/WebKitGTK）跨窗口支持不一致，不能作为产品主通道；仅适合 e2e 模拟层备选 |

**推荐：A 为主通道**（本机多窗口=同进程，A 恰好完备且已实现）；B 作为 lan 演进的既有预留（本轮不补 client 连接）；C/D 不采用。此为开放问题 1，待用户确认。

## 5. 会话 / 权限模型设计

### 会话模型
- **创建**：面板"创建会话"按钮 → `collaborationController.enableHost({port, authToken})`（复用现有）→ 控制器生成 `sessionId`（如 `collab-${Date.now().toString(36)}`）→ 面板状态机 `未连接 → 已创建`，展示 sessionId 与邀请区。
- **邀请（单机语义）**："邀请"= 打开一个新应用窗口并令其以 client 身份加入。新窗口的加入引导（bootstrap）机制是**开放问题 2**（URL 参数 / 共享会话配置 / 新窗口自动发现本机活跃会话）。邀请区 UI 先展示会话信息（sessionId、port、加入方式说明），不依赖引导机制的选型即可满足 :28。
- **E2E 模拟语义**：`simulateCollabUserJoin(user)` = 注入一条 presence 消息（等价于"某用户从另一窗口加入"），走控制器既有 receiveMessage('presence') 路径——复用 users 列表 + 颜色分配 + clip 锁逻辑。
- **生命周期与存储**：会话 = host 运行期生命周期（disable/stop = 会话结束）。状态仅内存（collaborationStore），不落盘——单机测试用途，重启即失效（是否持久化 = 开放问题 3）。

### 权限模型（对应 :107）
- 复用既有两层：`CollaborationPermission: 'read-only'|'edit'`（控制器级，broadcastCommand 前 `canApplyCollaborationOperation` 已做拦截——**写保护逻辑已存在**）+ UI 级禁用。
- `simulateCollabRole('viewer')` → 置本机 permission='read-only' → 调色控件（ColorWheelPanel/PrimarySlidersPanel）接收 `disabled` 渲染 + 面板顶部 `collab-readonly-notice` 提示。
- 更细的 owner/editor/commenter/viewer 矩阵（collaboration-permissions.ts）本轮不接入，留作演进。

### 会话锁定（对应 :174）
- 新增会话级锁概念：`sessionLockedBy?: string`（当前控制器只有 clip 级锁）。`simulateCollabLock('other-user')`（真实场景：host 广播 lock 消息）→ 面板 `collab-lock-status` 显示"已锁定（by other-user）"。需要：CollaborationMessage 增加 `'session-lock'` 类型 + store 字段 + 面板展示。锁定期间的编辑拦截策略 = 开放问题 4。

## 6. 逐条用例对照表

| 用例 | 设计方案满足方式 |
|---|---|
| :14 | 新建 CollaborationPanel（含 `collab-session-status`，初始渲染"未连接"）+ ToolsMenu 新菜单项 `toolbar-tools-collaboration-menu-item`，打开方式沿用 lutEditorOpen 模式（editorUIStore 布尔 + dialog-state 注册 + EditorShell lazy 挂载） |
| :28 | 面板内 `collab-create-session-button` → enableHost + 生成 sessionId → 状态"已创建" + `collab-session-id` + `collab-invite-section`（展示 port/sessionId/加入方式） |
| :45 | install-mocks 新增 `simulateCollabUserJoin` → 注入 presence → 控制器 users 更新 → 面板渲染 `collab-user-{userId}`（名称 + `collab-user-{userId}-status` data-online） |
| :69 | ToolsMenu 新菜单项 `toolbar-tools-color-grading-menu-item` → 独立打开 ColorGradingWorkspace（复用现有组件，`color-grading-workspace` testid 已存在）；同步链路已有（commandManager→broadcastCommand→operations），`getCollabOperationsSent` 钩子返回已发送 operations |
| :107 | `simulateCollabRole('viewer')` → permission='read-only' → 调色面板 disabled + `collab-readonly-notice`（color-wheel-panel 已存在，条件断言成立时满足） |
| :128 | 面板评论区：`collab-comment-input` + `collab-comment-submit` → 评论作为 kind='comment' 的 CollaborationOperation 入列（复用 comment 类型）→ `collab-comment-list` 渲染 |
| :174 | `simulateCollabLock('other-user')` → sessionLockedBy → 面板 `collab-lock-status` 显示"已锁定" |

## 7. 预估改动范围

**生产代码（全部为新增或最小扩展，无 Rust 改动、零新增依赖）：**

| 文件/模块 | 改动 |
|---|---|
| `src/collaboration/CollaborationPanel.tsx` | **新建**：会话面板（全部 collab-* testid、用户列表、评论区、锁定状态、只读提示挂载点） |
| `src/collaboration/local-network.ts` | 扩展：sessionId 生成、`sessionLockedBy` 状态、`'session-lock'` 消息类型、`setLocalRole/permission` 方法（供钩子与设置共用） |
| `src/store/collaborationStore.ts` | 扩展：sessionId、sessionLockedBy 字段 |
| `src/components/Toolbar/ToolsMenu.tsx` | +2 菜单项（collaboration、color-grading） |
| `src/store/editorUIStore.ts` + `src/store/dialog-state.ts` + `src/components/EditorShell.tsx` + `lazyComponents.ts` | +collaborationPanelOpen、+colorGradingWorkspaceOpen（沿用 lutEditorOpen 既有模式） |
| `src/components/ColorGrading/*` | ColorWheelPanel/PrimarySlidersPanel/ColorGradingWorkspace 增加 `disabled` 只读态 + `collab-readonly-notice` 渲染 |
| `src/i18n/strings.ts`（+en-overrides） | 新增面板文案（未连接/已创建/已锁定/只读提示/邀请区等） |

**测试基建（非生产代码）：**

| 文件 | 改动 |
|---|---|
| `src/e2e/install-mocks.ts` | +6 钩子：simulateCollabUserJoin / simulateCollabSessionActive / simulateCollabRole / simulateCollabLock / simulateCollabConflict（可选）/ getCollabOperationsSent |

**明确不动**：Rust 传输层、playwright.config.ts、其余 8 项产品决策类失败、performance:27、spec 断言本身。

## 8. 需要用户拍板的开放问题

1. **同步主通道**：采用方案 A（app.emit 扇出，已实现、零新增）作为本机多窗口主通道？还是要求走方案 B（TCP localhost，需补 Rust client 连接命令）？（推荐 A）
2. **新窗口加入的引导机制**：URL 参数（`?collab-join=<sessionId>&port=&token=`）/ 共享会话配置（appData 内会话信息，新窗口启动自动发现）/ 邀请按钮直接开新窗口并注入参数（Tauri WebviewWindow 创建 API）？决定"邀请"的真实产品路径。
3. **会话持久化**：会话信息仅内存（重启失效，简单）还是落 appData（可重新加入）？
4. **锁定期间的拦截深度**：仅面板状态展示（满足 :174 断言）还是同时拦截编辑命令广播（与 permission 体系联动）？
5. **`slider-brightness`**：不实现（spec 软门控，合法）还是补齐（需动 editor-core PrimarySliderParams 与 FFmpeg 滤镜参数映射，成本明显上升）？
6. **:152 冲突提示（第 8 例）**：本轮 7 例不含它，是否顺手实现 simulateCollabConflict + collab-conflict-notice 使钩子集完整？（推荐不做，严守 7 例范围）
7. **e2e 是否需要真实双窗口验证**：现有 spec 以页内钩子模拟远端用户（单窗口即可转绿）。真实多窗口的端到端验证（Playwright 开第二个 page / Tauri 双窗口）是否作为后续补充任务？（推荐：本轮不做，另立任务）

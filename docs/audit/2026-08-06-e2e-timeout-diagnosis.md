# issue #114 诊断报告：E2E 系统性超时的根因定位

- 日期：2026-08-06
- 性质：**只读诊断**（未修改任何配置/spec/CI 文件，未重跑 CI，未提交任何改动）
- 原始证据目录：`docs/evidence/e2e-diag-2026-08-06/`（issue 原文、CI job 日志、绿→红 diff、探针脚本与输出、trace 截图）
- 本地复现残留：`apps/desktop/test-results/`（已被 .gitignore 忽略，含 trace.zip/video）

## 结论摘要（TL;DR）

**根因已定位，本地 100% 复现，并经对照实验确认因果。**

卡点不在 Playwright 基础设施（无 globalSetup、webServer 正常、浏览器初始化正常），甚至不在 issue 猜测的
`waitForE2eActions`/`__E2E_ACTIONS__` 注入链（该链本地实测 <1.3s 就绪）。

真正的根因是 **dev 模式专属组件 `DevPerfOverlay` 的无限渲染循环**：

1. `apps/desktop/src/components/DevPerfOverlay.tsx:67` 在**渲染函数体内**调用 `trackRender('DevPerfOverlay')`；
2. `trackRender` 同步通知所有订阅者（`apps/desktop/src/hooks/usePerfMonitor.ts:32 → :18-22`），
   而 `DevPerfOverlayInner` 自己通过 `useSyncExternalStore` 订阅了同一个 store（`usePerfMonitor.ts:182-186`）；
3. 每次通知都会生成新的快照 Map（`usePerfMonitor.ts:20`），快照引用恒变 → 必然触发重渲染；
4. 挂载后约 500ms，FPS 监控的 `setInterval(notifyFpsListeners, 500)`（`usePerfMonitor.ts:90`）
   触发 DevPerfOverlayInner 重渲染 → `trackRender` → 通知自身订阅 → 再重渲染 → **自持无限循环**；
5. React 抛出 `Maximum update depth exceeded` 并反复做 concurrent→sync 恢复（本地探针实测到两类错误），
   主线程被渲染循环保住（观测到单个 chrome renderer 累计 1825 CPU 秒）；
6. 此后**任何 store 驱动的 UI 更新都无法落地**：导入的媒体卡片、新建的文字剪辑都不会出现在 DOM；
7. 所有 spec 在各自的"第一个 UI 更新等待"处命中 5s/10s 超时 → 均匀的 13-15s 失败；
8. 378 个测试 ×（1+2 重试）× ~15s ÷ 2 workers ≈ 142 分钟 ≫ 20 分钟步骤上限 →
   `nick-fields/retry` 两次 `Timeout of 1200000ms`，按字母序永远卡在 `ai-*` 之前。

该组件只在 `mode === 'development'` 启用（`apps/desktop/vite.config.ts:7` 的
`__DEV_PERF_MONITOR__: mode === 'development'`），而 e2e 的 webServer 恰好跑的是 `vite dev`
（`apps/desktop/playwright.config.ts:30`）——**所以只有 e2e/dev 挂，production 构建与 Tauri 发布不受影响**。

修复方向见文末（本轮不改）。

## 1. 卡点层级定位（按排查顺序逐层排除）

| 层级 | 结论 | 证据 |
|---|---|---|
| globalSetup / fixture | ❌ 排除 | `apps/desktop/playwright.config.ts` 无 `globalSetup` 字段；`e2e/fixtures.ts:41-69` 只做页面对象注入，无异步初始化 |
| webServer 启动 | ❌ 排除 | 本地 `vite dev` 秒级响应 1420 端口；CI 日志中首个 spec 在 job 开始约 2 分钟内即开始执行（`ci-e2e-job-30968049931-0805.log` L1017，02:02:17），说明服务器启动正常 |
| 浏览器 context/page 初始化 | ❌ 排除 | 探针实测 `page.goto` + `__E2E_ACTIONS__` 就绪共 745-1238ms（`probe-no-overlay.out`/`probe-baseline.out` 首行） |
| `__E2E_ACTIONS__` mock 注入链 | ❌ 排除（issue 的猜测方向） | `waitForE2eActions`（`e2e/e2e-actions.ts:3-9`）本地 <1.3s 通过；两个复现的 spec 都越过了这一步 |
| **特定 wait：首个 store 驱动 UI 更新** | ✅ **卡点在此** | adjustment-layer 卡在 `e2e/e2e-actions.ts:20`（media-card click，10s actionTimeout）；advanced-text 卡在 `e2e/advanced-text.spec.ts:10`（`[data-clip-type="text"]` toBeVisible，5s） |
| **应用层根因** | ✅ **DevPerfOverlay 无限渲染循环** | 对照实验：运行时把 `DevPerfOverlay.tsx` 模块替换为 no-op 后，卡片正常渲染、0 错误（见 §3） |

## 2. 本地复现（真实 Playwright runner，非自制脚本）

环境：Windows 本地，bun 1.3.14（与 CI 相同，`ci-e2e-job-30968049931-0805.log` 中 `bun install v1.3.14`），
Playwright chromium headless，命令（未改任何配置文件，均为 CLI 覆盖）：

```
cd apps/desktop && bunx playwright test e2e/<spec> --workers=1 --retries=0 --timeout=60000 --reporter=list
```

### 2.1 adjustment-layer.spec.ts —— 复现失败

- 结果：`Test timeout of 60000ms exceeded` + `locator.click: Timeout 10000ms exceeded`，
  等待 `[data-testid^="media-card-"]` 的 add-to-timeline 按钮（`e2e/e2e-actions.ts:20`）。
- 失败前步骤全部成功：`goto` ✓、`waitForE2eActions` ✓、点击 `import-media-button` ✓。
- trace 截图（`docs/evidence/e2e-diag-2026-08-06/repro-empty-mediabin.jpeg`）：应用外壳完整渲染，
  媒体库标题显示 **"3 个素材"**（store 里已有 3 个资产），但**卡片列表区完全空白**——
  store 更新没有落到 DOM。
- 原始产物：`apps/desktop/test-results/adjustment-layer-adds-an-a-3feb5-s-filter-in-the-export-plan-chromium/`
  （trace.zip、video.webm、error-context.md；后者副本在证据目录 `repro-error-context.md`）。

### 2.2 advanced-text.spec.ts —— 复现失败

- 结果：卡在 `advanced-text.spec.ts:10`，`expect(textClip).toBeVisible()` 5s 超时，
  `locator('[data-clip-type="text"]')` **element(s) not found**（副本：`repro-advanced-text-error-context.md`）。
- 即：点击 `add-text-clip-button` 成功，但新建文字剪辑的 store 更新同样没有落到 DOM。

两个 spec 一媒体一时间线，卡在**同一个语义点：bootstrap 之后第一个由 store 驱动的 UI 更新不出现**。
这解释了 CI 里"所有 spec 无差别均匀失败"的签名——不是某个 spec 写坏了，是应用层共同故障。

### 2.3 页面控制台错误特征（探针抓取）

- `pageerror: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or ...`（`probe-baseline.out`）
- 或刷屏式 `There was an error during concurrent rendering but React was able to recover by instead synchronously rendering the entire root.`（探针首跑观测到 100+ 次）
- 伴随 `Cannot update a component (DevPerfOverlayInner) while rendering a different component` 警告——**直接点名了循环组件**。
- 资源占用：卡死的 chrome renderer 累计 **1825 CPU 秒**（`Get-Process` 观测，2 核持续打满），确认是"死循环"而非"慢但会动"。

## 3. 因果验证（对照实验，运行两次均可重复）

不改仓库任何文件，用 Playwright 的 `page.route` 在运行时把 `/src/components/DevPerfOverlay.tsx`
模块响应替换为 `export function DevPerfOverlay(){return null}`（脚本：`probe-causality.cjs`）：

| 组 | 媒体卡片 | gridView 元素 | 页面错误 |
|---|---|---|---|
| baseline（不拦截） | **缺失**（15s 未出现） | `null`（整个网格分支未渲染） | `Maximum update depth exceeded` ×1 |
| no-overlay（禁用 DevPerfOverlay） | **出现，3 张** | 存在，高 964px，高度链健康 | **0** |

原始输出：`probe-baseline.out`、`probe-no-overlay.out`（各跑了两轮，结果一致）。

结论：**DevPerfOverlay 存在 ⟺ 渲染循环发生 ⟺ spec 失败；移除 ⟺ 一切正常。** 因果关系成立。

## 4. 根因机制详解（file:line）

```
App.tsx:50            <DevPerfOverlay /> 无条件挂载（App 根部）
DevPerfOverlay.tsx:62   __DEV_PERF_MONITOR__ 为 true 时渲染 DevPerfOverlayInner
DevPerfOverlay.tsx:67   渲染体内调用 trackRender('DevPerfOverlay')   ← 违规点
usePerfMonitor.ts:28-34   trackRender → renderCounts.set → notifyRenderListeners()
usePerfMonitor.ts:18-22   notifyRenderListeners 同步调用所有 listener；
                          且每次 new Map(...) 快照（:20）→ 引用恒变
usePerfMonitor.ts:182-186 DevPerfOverlayInner 经 usePerfMonitor() 用
                          useSyncExternalStore 订阅 renderCounts ← 自己订阅自己
usePerfMonitor.ts:86-91   startFpsMonitor：setInterval(…, 500) ← 挂载 ~500ms 后点火
```

循环链：挂载 → ~500ms FPS interval → DevPerfOverlayInner 重渲染 → `trackRender`（渲染中）→
同步通知自身订阅 → React 记"render 期间更新"并安排重渲染 → 再渲染 → `trackRender` → …
无限自持。React 最终以 `Maximum update depth exceeded` 抛错并进入
"concurrent 失败 → sync 恢复 → 再失败"的抖动，主线程饱和，后续 store 更新的 render/commit 排不上队。

**为什么只在 e2e/本地 dev 出现**：`vite.config.ts:7` 定义
`__DEV_PERF_MONITOR__: mode === 'development'`。`vite build`（production）下该值为 false，
`trackRender` 直接 early-return（`usePerfMonitor.ts:29`），组件返回 null（`DevPerfOverlay.tsx:62`）。
e2e 的 webServer 是 `bun run dev`（`playwright.config.ts:30`）→ mode=development → 循环必现。

**为什么单测没拦住**：`DevPerfOverlay.test.tsx:6-15` 用 `vi.mock` 把 `usePerfMonitor`/`trackRender`
整体 mock 掉（`trackRender: vi.fn()`），真实的"渲染中通知订阅者"路径从未在测试里执行过。

## 5. 时间线：为什么是"08-02 起持续红"

| 时间 | 事件 | 证据 |
|---|---|---|
| 07-14 01:12 | **最后一次绿** run 29297969428（sha `1c983277`，feat: AI Smart Montage #63），e2e job success（01:12:30→01:40:19，全程约 28 分钟） | `gh run view 29297969428 --json jobs` |
| 07-14 01:13 | 首个红 run 29298017171（merge `4485ea29`）：rust/frontend/e2e 全挂。绿→红 diff 只有 5 个文件（`green-to-red.diff`：ProfessionalColorGrading 新组件 + Inspector +12 行 + MediaBin 列表分支包 wrapper + 新 spec），**与当前失败签名无关**（见 §5.1） | `git diff 1c983277 4485ea29 --stat` |
| 07-14 ~ 08-01 | 其间所有 run 失败在**测试执行之前**：lockfile 不同步（`bun install --frozen-lockfile` → `error: lockfile had changes, but lockfile is frozen`）、workflow 语法问题等。例：07-20 run 29760440801 的 e2e job 日志只有 162 行，死于 install 步骤（`ci-e2e-job-29760440801-0720.log` L129）。**这段时间 e2e 根本没跑过 spec** | 同上证据文件 |
| **07-28** | **`5e75fd6a`（"feat: 探索 Timeline 组件结构 (agent a2425384)"）引入 `DevPerfOverlay.tsx` + `usePerfMonitor.ts`——根因在此埋入** | `git log --follow -- <两文件>` 唯一来源提交 |
| 08-02 | `926fbd53`（fix(ci): 同步 bun.lock）修好 install → run 30756025285 中 e2e **第一次真正跑到 spec** → 根因首次显现：签名与今日完全一致（✘ 列表均匀 10-15s，`Timeout of 600000ms` ×2） | `ci-e2e-job-30756025285-0802.log` L1006-1013、L1057、L1117 |
| 08-03 | `55bd4ee8`（issue 所称"调大 timeout"提交） | 见 §6 |

### 5.1 关于 07-14 首红 run 的说明

issue 里"失败签名逐字一致"的对比表从 08-02 开始是对的；更早的 07-14~08-01 红 run 是**另一类失败**
（CI 基础设施层：lockfile/workflow），当时 Playwright 从未执行到 spec。
因此"e2e 从未绿过"的准确表述是：**自 07-14 之后，e2e 要么没跑到，要么一跑到就全挂**；
而"一跑到就全挂"的模式自 08-02 首次显现后逐字稳定，因为根因（07-28 引入）一直未变。

## 6. "08-03 调大 timeout" 提交是否掩盖了根因？

逐字节核对了该窗口内两个 e2e 相关提交的完整 diff：

- `55bd4ee8`（08-03 11:34，"fix(e2e): 调大 timeout 适配当前代码规模 (P1)"）：
  只改了 4 处数值——`playwright.config.ts` timeout 30→60s、navigationTimeout 15→30s、
  webServer.timeout 新增 120s；`ci.yml` e2e 步骤 `timeout_minutes` 10→20。**没有任何其他夹带改动。**
- `0b2c4d98`（08-03 12:51，"page.goto 改用 domcontentloaded"）：只在 `playwright.config.ts`
  增加 `gotoOptions: { waitUntil: 'domcontentloaded' }`。同样无夹带。

结论：**没有掩盖根因的夹带改动**。这两个提交只是把"步骤被强杀的墙钟时间"从 10 分钟拉到 20 分钟，
并把导航等待策略放宽——失败模式在其前后逐字一致（对比 08-02 run 与 08-05 run 的 ✘ 列表），
说明它们是无效的止血而非致病因。它们的提交信息（"代码规模膨胀导致慢"）是**误诊**：
真实原因是渲染循环，与代码规模无关。

## 7. 数字核算：为什么 20 分钟必然撞墙、且卡在 ai-*

- spec 文件 286 个，顶层 `test(...)` 共 **378 个**（`grep -c '^test(' e2e/*.spec.ts`）。
- 每个失败测试 ≈ goto(~2s) + waitForE2eActions(<1.5s) + 点击(~1s) + 首个 UI 等待超时（5s 或 10s）≈ **13-15s**，与 CI 日志 ✘ 行耗时逐条吻合（`ci-e2e-job-30968049931-0805.log` L1017-1047）。
- CI 参数：`--workers=2`（ci.yml e2e 步骤）+ `retries: process.env.CI ? 2 : 0`（`playwright.config.ts:9`）→ 每测试最多 3 次尝试。
- 总量：378 × 3 × ~15s ÷ 2 workers ≈ **8500s ≈ 142 分钟 ≫ 20 分钟**步骤上限。
- Playwright 按文件名顺序 + 2 worker 交错消费，20 分钟约能消耗 ~160 次尝试 ≈ 50 来个测试，
  正好走到 `ai-*` 前缀段——与 issue 观察"两次尝试均卡在 ai-*，effect-*/preset-* 从未执行"一致。
- `playwright-report` artifact 缺失的原因：`nick-fields/retry` 步骤超时直接 SIGKILL 整个进程树，
  Playwright 来不及执行 reporter flush。**不是报告生成逻辑坏了**，修复根因后 artifact 自然恢复。

## 8. CI 与本地环境对照（排除环境差异假设）

| 项 | CI | 本地 | 是否相关差异 |
|---|---|---|---|
| OS | ubuntu-latest（Hosted Compute Agent，image 20260707.563） | Windows 10 | ❌ 本地 Windows 100% 复现 |
| bun | 1.3.14（setup-bun，version-file） | 1.3.14 | ❌ 完全相同 |
| 浏览器 | chromium headless（bunx playwright install） | chromium headless | ❌ |
| workers | 2（CLI 显式） | 复现时用 1（隔离） | ❌ 只影响总时长，不影响单测试失败 |
| dev server | `bun run dev`（webServer 拉起，VITE_E2E=true） | 同 | ❌ 相同路径 |
| `__DEV_PERF_MONITOR__` | true（mode=development） | true | ✅ **两边都命中——这就是为什么无需环境差异假设** |

**无需 SSH 访问 CI runner**：本地对照实验已闭环。

其他核查过的嫌疑项：

- **僵尸进程/端口残留**：本地每轮 playwright 结束后 1420 端口正常释放（netstat 验证）；
  CI 中 `reuseExistingServer: true` + `nick-fields/retry` 组合下，attempt 2 理论上可能复用
  attempt 1 被 SIGKILL 后幸存的 dev server——但两次 attempt 的失败签名逐字相同，
  说明复用与否不改变结果。**非根因**（修复阶段可顺带评估改为 `false`）。
- **install-mocks.ts 顶层副作用**：模块顶层只有 Map 声明、`window.__TAURI_MOCKS__`/`window.fetch`/
  `window.__E2E_ACTIONS__` 赋值（L1555/L1558-1559/L1607），无顶层 await、无阻塞调用；
  探针实测注入 <1.3s 完成。**排除**。
- **失败 spec 的共同 fixture/helper**：共同点是 `waitForE2eActions`（`e2e/e2e-actions.ts:3`，
  15s poll）+ "goto 后立刻驱动 UI"的模式；`waitForE2eActions` 本身健康，共同失败点在其后的首个 UI 更新。
- **07-14 绿→红 diff 中的 MediaBin.tsx 改动**（列表分支外包 flex wrapper + 元数据面板）：
  no-overlay 对照中 gridView 高度链健康（964px，祖先链 `probe-no-overlay.out`），
  虚拟化列表正常出卡——**排除布局/高度链假设**。

## 9. 下一步修复方向（仅建议，本轮未改）

按推荐顺序：

### 方向 A（根因修复，强烈推荐）：消除"渲染中通知订阅者"

把 `trackRender` 的调用移出渲染阶段，或切断自订阅回路。两种等效做法（任选其一即可）：

- A1：`DevPerfOverlay.tsx:67` 的 `trackRender('DevPerfOverlay')` 移入 `useEffect`
  （渲染计数语义不变，只是计数时机在 commit 后）；
- A2：`usePerfMonitor.ts` 的 `notifyRenderListeners` 改为微任务/`queueMicrotask` 异步通知，
  避免在 React 渲染相位内触发订阅回调；同时该文件内所有 notify 同改。

风险：**低**。只影响 dev 性能面板的计数精度与展示时机，不触碰业务逻辑、不触碰 e2e 配置。
验证方式：本地重跑本报告 §2 的两个 spec + `bun run typecheck` + 相关 vitest。

### 方向 B（快速兜底，可叠加但不建议单独使用）：e2e 环境关闭性能面板

`vite.config.ts:7` 改为 `mode === 'development' && !process.env.VITE_E2E`。
一行改动立刻全绿。风险：**中**——它把 dev 性能监控从 e2e 路径整体隐藏，
未来同类"dev-only 渲染病理"再次失去暴露渠道，且性能面板在 e2e 场景从此不可用。
只建议作为 A 落地前的临时止血，或与 A 同时作为双保险。

### 方向 C（测试基建加固，与 A 并行推进）

1. **补单测盲区**：新增一个不 mock `usePerfMonitor` 的集成用例（真实 trackRender + 真实订阅，
   断言"渲染 N 次不抛 Maximum update depth"），防止本类回归再次绕过 vi.mock。
2. **e2e 冒烟前置**：新增一个 30 秒级 app-launch 冒烟 spec（goto → `__E2E_ACTIONS__` →
   一次最小 store 更新落地断言）并置于套件最前；配合 CI 侧
   `--workers=1 --retries=0 --fail-fast`（排查期参数，issue 中已有此建议）——
   下次再出系统性故障时，5 分钟内就能拿到首个失败签名而不是烧掉 2×20 分钟。
3. （可选）`playwright.config.ts:32` `reuseExistingServer` 在 CI 下改 `false`，
   杜绝 retry 间复用幸存 dev server 的灰色地带。

### 不建议

- 继续调大 timeout/workers/retries：§7 的核算表明任何上限都会被 378×3 的放大量击穿，
  且 08-03 的实践已经证明无效。

## 10. 局限与未覆盖项（如实说明）

- CI 侧没有拿到任一失败 spec 的 trace/报告（artifact 被步骤超时杀死，见 §7），
  "CI 卡点 = 本地卡点"依赖**时间算术吻合（13-15s 构成逐条对上）+ 本地同代码 100% 复现 + 对照实验闭环**
  三重证据支撑；未能在 CI 环境内直接抓取 trace（本轮禁止重跑 CI）。如需 100% 直证，
  在修复 PR 中附带一次 CI 运行即可验证。
- 渲染循环的触发存在少量非确定性（探针各轮观测到的错误形态略有差异：
  单次 `Maximum update depth exceeded` vs 恢复刷屏 vs 主线程饱和），
  但"卡片缺失 + gridView 为 null + 禁用 overlay 即恢复"在全部 4 轮实验中一致。
- 顺带发现、**未展开**（超出本 issue 范围）：`apps/desktop/src/components/EditorShell.tsx.bak`
  遗留备份文件；`logStoreSubscription`（usePerfMonitor.ts:137）无任何调用方，属死代码。

## 附录：证据清单（docs/evidence/e2e-diag-2026-08-06/）

| 文件 | 内容 |
|---|---|
| `issue-114.txt` | issue #114 原文（gh issue view --json 抓取） |
| `ci-e2e-job-30968049931-0805.log` | 08-05 main run e2e job 完整日志（1200s×2 超时签名、✘ 列表） |
| `ci-e2e-job-30756025285-0802.log` | 08-02 run e2e job 日志（当前签名首次出现） |
| `ci-e2e-job-29760440801-0720.log` | 07-20 run e2e job 日志（死于 bun install，未到测试执行） |
| `green-to-red.diff` | 最后绿 `1c983277` → 首个红 `4485ea29` 的完整 diff |
| `probe-causality.cjs` | 因果对照探针（page.route 运行时替换 DevPerfOverlay 模块，不改仓库） |
| `probe-baseline.out` | 基线组输出 ×2 轮：卡片缺失 + Maximum update depth exceeded |
| `probe-no-overlay.out` | 对照组输出 ×2 轮：3 张卡片、高度链健康、0 错误 |
| `repro-empty-mediabin.jpeg` | 本地复现 trace 截图："3 个素材"但列表空白 |
| `repro-error-context.md` / `repro-advanced-text-error-context.md` | 两个 spec 的 Playwright error context |
| （仓库内，gitignored）`apps/desktop/test-results/…` | 两次复现的完整 trace.zip/video.webm |

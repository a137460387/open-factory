# preflight-checklist:55 诊断 + 分支交付前体检

- 日期：2026-08-08
- 分支：`fix/114-dev-perf-overlay-render-loop`
- HEAD：`a45289ab`（本轮 amend 自 `d06a6253`，仅 message 更正，diff 不变）
- 原始证据落盘：
  - 探针 `apps/desktop/e2e-probes-stash/zz-preflight-ack-probe.spec.ts` + `zz3.config.ts`
    （执行注：探针原目录已于 2026-08-08 按决策整体删除并加入 gitignore，结论已固化于本文档）
  - 探针输出 `docs/evidence/preflight-ack-probe-2026-08-08.log`
  - 单跑失败现场 `apps/desktop/test-results/preflight-checklist-prefli-d5f15-*/`（screenshot + error-context）
  - 全量单测 `D:\tmp\vitest-final-full.log`（607 文件 11171 过 / 3 跳过，exit 0）

## 1. preflight-checklist:55 诊断（只诊断，不修）

### 1.1 复现与签名更正

- 单跑复现：失败于 **spec:82 的 `click()`**（10s TimeoutError），**不是** spec:81 的可见性等待
  （上轮报告"ack 按钮 DOM 存在但可见性等待失败"的转述不准确：`toBeVisible()` 通过，
  click 的 actionability 检查失败）。
- 拦截日志：`<div>…</div> from <div>…</div> subtree intercepts pointer events`，
  18 次重试持续 10s 不释放 → **确定性几何遮挡，非时序问题**。

### 1.2 "与导出对话框 preflight 是两个组件"——坐实

- 本用例面板 = `PreflightChecklistPanel`（`src/components/Export/PreflightChecklistPanel.tsx`，
  经 `ShellFloatingDialogs.tsx:246` 挂载为底部全宽栏）。
- 导出对话框 preflight = `PreflightPanel`（仅渲染于 export 步）。
- 两者不同文件、不同 testid 前缀（`preflight-ack-*` vs `export-preflight-*`）。坐实。

### 1.3 根因（探针坐实）

- 探针（elementFromPoint）：ack 按钮 rect (1218, 641, 48×16)，中心点命中
  `z-index=99999, position=fixed` 的 div 链 = **DevPerfOverlay**；
  overlay rect (1012, 586, 260×126) 完全覆盖按钮；面板全宽 (0, 566, 1280×154)，
  ack 按钮在行最右端（消息 span `flex-1` 推到右缘）。
- DevPerfOverlay 仅 dev 模式启用（`__DEV_PERF_MONITOR__ = mode === 'development'`，
  vite.config.ts:74）；e2e 跑 dev server 故恒在，默认展开，fixed 右下 z=99999。
  **生产构建不渲染，真实用户不受影响。**
- 与本分支的关系：分支未改面板/overlay 几何（63a56ee7 仅把 trackRender 移入 useEffect
  切断渲染闭环，usePerfMonitor 改动纯通知时序）。该几何冲突在 main 上即潜在存在，
  是分支的渲染循环修复让 overlay 在 e2e 中稳定可用后才**显性化**——main 上 e2e 因
  无限渲染循环系统性超时，此冲突无从观测。**非分支引入的回归。**
- 系统性：全量日志 `intercepts pointer events` 共 24 处 / 7 个用例。其中
  **dubbing-adaptation:47 的拦截源直接是 overlay 子元素 `<button>Reset</button>`**（坐实）；
  lut-editor:4、media-organizer:4、release-workflow:4、timeline-compare:4 为同一匿名 div
  签名（疑似同源，未逐例坐实）。overlay 是 e2e 右下交互的系统性风险源。

### 1.4 分类

非产品缺陷（生产不受影响）、非 spec drift（断言合理）、非环境竞态（确定性几何）。
= **e2e 环境特有的几何冲突**（main 潜在、分支修复后显性化、系统性）。

### 1.5 决策：不修代码，方案交用户

| 方案 | 内容 | 否决/保留理由 |
|---|---|---|
| A | spec 侧先折叠 overlay / force click | 掩盖类操作，且只修一例不修类 |
| B | e2e 下 overlay 默认折叠 | 折叠小条 (≈130×24, y∈[685,712]) 仍盖 continuity 行 ack (≈y686)；能修当前红例（flash ack y641）但不修类；改 dev 工具默认态 |
| C | overlay 换位置 | 移动受害者，不消除类 |
| D | overlay 容器 pointer-events 穿透 | 改 dev 工具交互模型（影响人工诊断：选中文本/点 Reset），顶部两按钮仍拦截 |
| E | 产品面板布局改（ack 不靠右） | 真实用户为 dev-only 问题让路，方向反 |

均超出"这一个 bug 的最小根本修复"或涉方向性取舍 → 按本轮标准只报告不动代码。

## 2. 提交体检（main..HEAD：22 非 merge + 3 merge）

逐 commit 核对 diff 与 message。**发现 2 处数字不一致**：

1. **d06a6253（HEAD，已 amend 为 a45289ab）**：message 验证段"转绿 4（audio-envelope:4、
   timecode-project-settings:4、subtitles:4/49/110）"——列举实为 5 例，与计数 4 自相矛盾；
   且失败 ID 清单交叉核对（/tmp/n100.txt vs /tmp/postfix-ids.txt）显示**实际转绿 4 =
   timecode:4 + subtitles:4/49/110，audio-envelope:4 全量仍失败**（spec:61 值断言 0 vs 0.5，
   即"负载下几何未稳态"模式二，与冷编译无关、不在门控范围）。561 模块数复测吻合
   （10.3s vs 原 10.9s 为测量波动）。→ 已 amend 更正 message（diff 不变）。
2. **3a731fcc**：标题"14 处入口"，实际 diff 新增 **16** 处 acquire（10 个命令模块），
   正文清单合计也是 16（5+1+1+2+1+1+1+2+1+1）。正文正确、标题笔误。
   修正需重写其后 ~20 个提交历史 → 报告并交用户决定（建议 PR 合并时改标题或容忍）。

其余一致：63a56ee7（闭环修复+集成测试+install-mocks，diff 吻合）、a1ed037a（两处回归=
useTimelineState+export-scheduler 两产品文件+测试）、d603f049（仅 1 行 testid，无行为变更）、
5e67c344（算术自洽：397/150→427/116、381/166→426/117、w1-only 30→1、w2-only 14→0、
both 136→116，与第一轮审计文档互证）、9cca14ce（7 测试文件实测=7）、69312367
（deleted=76 ≈ 批次①~9 项+⑤a 70，量级吻合）、1aa2bf88/cf52b616/6a64ca2b/02ce908a
（上轮已验证）、其余 chore/refactor/Rust 提交文件清单与 subject 吻合。

## 3. PR 拆分建议：按主题拆 3 个

- **PR-1 既有非 #114 批次**（9）：6dd9e9fa、3a731fcc、9cca14ce、f1a32a19、7d92b272、
  69312367、e33b8089、a57e8641、c73cc29d。含 3 个本地 PR merge（#105/#109/#110），
  本就该独立交付；先合入 main，其余 PR 以其为基。
- **PR-2 issue #114 范围**（9）：63a56ee7、c94e427c、96800e42、f2418bd7、fe1173a4、
  a1ed037a、d603f049、5e67c344、1aa2bf88。故事自洽："e2e 系统性超时修复 + 基线恢复"。
- **PR-3 顺带真实功能修复**（4）：cf52b616、6a64ca2b（调度器）、02ce908a（preflight
  切步）、a45289ab（e2e 预热门控）。均为独立可 revert 的真实缺陷修复，各有单测/证据。

理由：仓库规则"PR 范围必须聚焦"；revert 粒度（PR-3 任一修复有争议可独立回退）；
审查聚焦（PR-1 chore/Rust、PR-2 测试/布局、PR-3 产品逻辑）。不建议 1 个大 PR
（混入无关 chore 违反聚焦规则）；也不建议更细（PR-3 内 4 提交都小且自含测试，
再拆增加合并开销；如用户偏好可再拆为 3）。

## 4. e2e-probes-stash 处置建议

现状 13 文件 + test-results/：
- 远古组（07-05/07-10）：debug-folders / debug-height / debug-height-folders /
  debug-height-chain —— 媒体高度链探索，结论早已定案（根因实为 toolbar shrink，5e67c344）。
- 本分支组：zz-probe（media-card 根因→5e67c344）、zz-task2-probe（C 簇导航→1aa2bf88）、
  zz-fps-diagnosis（FPS 9 瞬态）、zz-audio-envelope-probe/probe2（→a45289ab+模式二待办）、
  zz-preflight-ack-probe（本轮→§1）、pw.config/zz2.config/zz3.config、test-results/。

建议 **清理 + gitignore**：合并前删除全部已定案探针与 test-results（结论均已固化在
审计文档/commit message/evidence 日志，探针本身无复跑价值）；同时 .gitignore 增加
`apps/desktop/e2e-probes-stash/`，未来临时探针有去处且不进 status、不误提交。
不建议整理成正式可复用工具（探针本质一次性诊断脚本，形式化需重写为断言形式，工量不值）。
**由用户决定是否本轮执行。**

## 5. sanity check

- `bun run typecheck`：通过（tsc -b 无输出）。
- `bun run lint`：通过（eslint 无输出）。
- `bun run test`：607 文件全过，11171 passed / 3 skipped (11174)，exit 0，覆盖率阈值通过。

## 6. 对提示词基线描述的更正

当前 97 失败的正确结构 = 移除 52 + 步骤导航 5 + 值断言/时间线语义 13 + 面板长尾 24 +
**audio-envelope 1** + preflight-checklist 1 + auto-generate:68 1 = 97。
提示词清单漏列 audio-envelope:4（合计 96），源于上轮报告误将其列为全量转绿；
本轮已 amend 更正 commit message（§2.1），本文档更正存档。

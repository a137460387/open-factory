# HANDOFF.md — 工作交接文档

> 更新时间：2026-08-29 | 基线：main = `e5266a6b`（PR #194 merge，HANDOFF 发版前同步合入）| 版本：v4.79.0（本 PR 发布，主题「情感高潮 top-K 建议」；上版 v4.78.2「隐藏控制台窗口」/ bump `89fb5d12`）
>
> e2e 基线（双口径）：**发现数 543 / passed 542 + 1 flaky**（main run 33165898507 实测 `542 passed + 1 flaky (42.7m)`，flaky 为池内已知 ai-multicam-cut 第 2 次；#188 run 33133132292 曾 `540 passed + 1 flaky (44.8m)`，nested-sequence-export 第 3 次）。注：#175/#176/#177 时期记录的 534 为 passed 数，实际发现数为 535（1 例 flaky 重试通过不计入 passed）；自 #178 起以发现数为准，避免口径混淆；#178 时点基线 537 经 #181 smart-subtitles.spec 9→7 例重写净减 2 例至 535，M3-3 A1 +3 例至 538（2026-08-27），M3 扩展·首实施 +3 例至 541（2026-08-27），M3 扩展·第二梯队 +2 例至 543（2026-08-28）——逐 run 实测见 2.5 口径修正记录。

---

## 1. 项目背景和目标

**open-factory** 是本地优先（local-first）的桌面视频编辑器，技术栈：React 19 + TypeScript + Vite + Tauri 2（Rust）+ Zustand + Bun monorepo（`apps/*` + `packages/*`）。核心约束见 `AGENTS.md`（本地优先判定、Timeline 命令对象、tauri-bridge 层、Store 按功能域拆分等）。

本交接覆盖的工作线（按时间顺序）：

1. **v4.74.1 patch 发布 + CI 基建稳定性专项**（已完成，2026-08-22 前收尾）：三轮 CI 修复解锁 frontend 徽章与 coverage 产出，为 v4.75 主线决策提供数据——历史摘录见 2.1
2. **P0-1 覆盖率攻坚专项**（已结项，2026-08-24）：desktop 覆盖 47.68% → 72.65%，一期预估"70% 需 4-5 期"按期达成并留 2.65pp 缓冲——详见 2.2
3. **P1-2 Smart Rough-Cut 主线**（已结项，2026-08-26）：M1 结构拆分 → M1b 提案对比接活 → M2 参数化，三阶段全部合入——详见 2.3
4. **v4.75.0 发版 + P2 前置桥接**（已合入，2026-08-26）：#173 发版 / #174 发版工作流文档 / #175 转写文本→语义引擎桥接，P2 由 no-go 转 go——详见 2.4
5. **P2 主线 M3 语义建议两阶段**（M3-1/M3-2 已合入，2026-08-26/27；M3-3 未启动待决策）：数据层 narrativeMarkers 派生建议纯函数 + SemanticSuggestionList 列表 UI；本工作线起 e2e 基线统一为发现数口径 537（后经 #181 重写净减至 535，见头部基线注）——详见 2.5
6. **v4.76.0 发版**（历史回填，2026-08-26）：bump `87d83f6a` / release merge `f6c36efd`（PR #180），主题「语义建议」，含 M3 两阶段；发版时未同步 HANDOFF，本条为 2026-08-27 v4.77.0 发版前补记
7. **P2 收官双修复 + 观察池销账**（已合入，2026-08-27）：#181 ASRStage 死链路退役 / #182 VAD 纯音乐误报治理 + `lib/asr.ts` 桩删除，观察池篇章收官——详见 2.6
8. **M3-3 A1 语义建议接入 Compare 审阅与应用**（PR #184 / merge `e8f94590`，2026-08-27 定调后落地）：单条建议对比审阅（before/after + 保留比例）+ 显式采纳走既有 ApplyRoughCutProposalCommand 通道 + undo 链路 e2e 断言；A2 批量整合降格为设计候选——详见 2.5 定调记录
9. **M3 扩展·首实施：语义建议多源「掐头去尾」+ 采纳计数**（PR #186 / merge `a609d8f5`，2026-08-27）：双源勘察共识第一梯队 b+d 落地（contentAnalysis 派生掐头/收尾收紧建议接入既有审阅采纳链）+ 情感高潮 top-K 算法内核入池 + 纯本地采纳记录器——详见 2.5 扩展记录
10. **v4.77.0 发版**（历史回填，2026-08-27）：bump `9afaa8a3` / release merge `3e661490`（PR #185），主题「语义建议应用」，含 M3-3 A1 + P2 收官双修复；发版时 HANDOFF 工作线未及立目（发版事实当时只记于头部基线行与 §3 位置行），本条为 2026-08-28 v4.78.0 发版前补记
11. **v4.78.0 发版**（2026-08-28）：主题「语义建议多源·掐头去尾 + 采纳计数」，正式收录 PR #186（M3 扩展首梯队：head-trim/tail-trim 双源 + 采纳计数器 + top-K 互斥内核入池），零功能代码变更
12. **v4.78.1 热修：生产包启动黑屏（vendor 分块循环求值）+ 生产冒烟入 CI**（PR #188 / merge `20e93ba5`，2026-08-28）：v4.78.0 真机冒烟发现安装包启动黑屏，CDP 取证定位 manualChunks 循环分块致 React 初始化前入口崩溃；两层塌缩修复 + prod-smoke CI 门禁基建——详见 2.7；本条目随本发版 PR（release/v4.78.1）收录
13. **v4.78.2 维护发版：Windows 正式包隐藏控制台窗口**（PR #190 / merge `d74769b7`，2026-08-28）：v4.78.1 真机冒烟发现正式包启动伴随黑色控制台窗口，根因为 `src-tauri/src/main.rs` 缺失 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`（Windows 正式构建按 console 子系统编译）；单行属性补齐（release 隐控制台 / dev 保留日志），零功能变更；本条目随本发版 PR（release/v4.78.2）收录
14. **M3 扩展·第二梯队：情感高潮 top-K 建议组装接入**（PR #192 / merge `0706cf38` + 搭车维护 PR #193 / merge `c6bf6365`，2026-08-28）：top-K 闸门经人类定调放行（单一用户项目，用户本人已实际采纳 b+d 建议，原判定标准「b+d 真实使用信号」以定调记录方式关闭）；`selectEmotionalClimaxIntervals` 组装层（窗口过滤 + 内核互斥选取 + 边界 clamp + 极短保护，内核零改动）+ `semantic-climax-suggestion` 派生层 + 多源合并第三源（climax 组 confidence 降序）+ 采纳计数器 `emotional-climax` 枚举；搭车维护 = roadmap 补勾两项 + ltx-video downloadModel/deleteModel 浏览器回退补齐 + PR #104 wontfix 关闭（hooks 拆分思路并入 #108）——详见 2.8
15. **v4.79.0 发版**（2026-08-29）：主题「情感高潮 top-K 建议」，正式收录 PR #192（情感高潮 top-K 建议组装接入，merge `0706cf38`）+ PR #193（搭车维护：roadmap 补勾两项 + ltx-video 浏览器回退补齐 + PR #104 wontfix 关闭，merge `c6bf6365`）+ PR #194（HANDOFF 发版前同步，merge `e5266a6b`），bump 见本 PR

---

## 2. 已完成的事项（含关键决策与原因）

### 2.1 历史工作线摘录（2026-08-22 及之前）

- **v4.74.1 发布链**（PR #156）：--no-ff merge + 三文件 bump（根 package.json / Cargo.toml / tauri.conf.json）+ lightweight tag 打在 bump 提交 + `gh release edit` 校正标题；v4.73.1 轻量 hotfix 不可作发布惯例基准（实际基准 = v4.25.1 + v4.74.0 组合）
- **CI 基建三轮修复**：
  - PR #157：fast-uri GHSA 用扁平 override（bun 1.3.14 不支持嵌套/range-selector overrides）；h2 RUSTSEC 真修复并移除 audit.toml 豁免；e2e timeout 20→50 分钟
  - PR #158：brace-expansion override 移除（各链自然解析 semver 兼容，audit 0 漏洞）；performance 1000 clips CI 预算放宽；audit-logger tampered-hash flaky 根因修复——merge 后 e2e 历史首次全绿
  - PR #159：i18n 环境差异根因修复（Node 全局 navigator 跟随 OS locale + setLanguageAsync 相等早退不加载 en-overrides）——CI coverage 首次生成
- **e2e 时序加固**（PR #161）：timeout 50→60 分钟、关键 spec 15s 可见性等待、AI mock 400ms 延迟——后续连续多轮全绿的基础
- 此前 frontend job 的 2 个 unhandled rejection 基线已消除（当前全量 exit 0）

### 2.2 P0-1 覆盖率攻坚（结项）

**推进轨迹**（desktop 整体，口径 B = lcov 排除 `apps/desktop/src/e2e/**`）：

| 阶段 | PR | 覆盖 | 主要内容 |
|---|---|---|---|
| 一期（勘察） | — | — | 分域可测性分级；预估 70% 需 4-5 期 |
| 二期 | #162 | 58.85% | Timeline 工厂直调模式铺开 |
| 三期 | #163 | 63.49% | Timeline + Inspector 288 用例 |
| 四期-A | #164 | 66.74% | preview 核心 9 文件（renderer/text/video/hw-decode/render-cache 等） |
| 四期-B | #165 | 70.01% | export/hooks 2 文件 + audio-renderer + gpu-acceleration |
| 五期 | #166 | 72.65% | tauri-bridge 7 桥 + store 洼地 8 文件 + cache-service |

**域覆盖终态**：

| 域 | 覆盖 | 来源期次 |
|---|---|---|
| Timeline | 93.55% | 一-二期 |
| Inspector | 94.44% | 二期 |
| preview 域 | 59.36%（四期-A 时点；核心 9 文件 82-100%，四期-B 另补 audio-renderer 88.66% / gpu-acceleration 97.36%） | 四期-A |
| export/hooks | 84.86% | 四期-B |
| tauri-bridge（7 桥接文件） | 89.61% | 五期 |
| store 洼地 8 文件 | 87-100% | 五期 |
| cache-service | 95.78% | 五期 |

**不入期决策登记**（复核时按理由重估）：

| 目标 | 决策期次 | 理由 |
|---|---|---|
| workers/collaboration | 一期 | Worker/协作宿主桩 ROI 低 |
| webgl-compositor（1178 行，11.63%） | 四期-B | ~600 行 GLSL 字符串 + 类方法需完整 GL 上下文 mock，ROI 低；长期候选 = Playwright 截图对比路径 |
| workers 9 文件 550 行 | 五期维持 | 消息循环宿主桩，与一期同因 |

### 2.3 P1-2 Smart Rough-Cut 主线（结项）

**推进轨迹**（基线 ec769bb4 = #150 退役一键编排器后，分步路径为唯一入口）：

| 阶段 | PR | merge commit | 主要内容 |
|---|---|---|---|
| M1 结构拆分 | #169 | `80ea5ece` | SmartRoughCutStepPanel 830 行 → 466 行纯渲染 + `useSmartRoughCut`（414 行 hook）+ `smart-rough-cut-utils`（99 行），行为等价（effect deps/memo deps/getState 非响应式读取逐字搬移，e2e 契约零变更） |
| M1b 提案对比接活 | #170 | `de806e12` | RoughCutComparePanel 影子功能转正：`useRoughCutAnalysis`（contentAnalysis 派生 highlights/onsets，D1-B 决策）+ `ApplyRoughCutProposalCommand`（core 命令，ripple 删间隙 + undo/redo）+ EditorShell stub 接线；未分析 clip 入口禁用（Step 1B 限制） |
| M2 参数化 + 联动 | #171 | `72206d66` | 5 检测参数状态化（sceneThreshold 0.3 / silenceMinDb -40 / silenceMinDuration 0.5 / silenceMargin 0.1 / dialogueSensitivity 'medium'，默认值=原硬编码零回归）+ ParamSlider/segmented 控件（disabled 联动 anyRunning）+ 结果项 hover playhead 联动 |

**累计**：16 文件 +2335/-424（`git diff ec769bb4..72206d66` 实测；逐 PR 合计 +2341/-430）；SmartRoughCut 域单测 3 → 76 用例（utils 27 + hook 29 + 面板 5 + core 命令 5 + state 3 + Compare hook 7）；e2e 531 → 534（rough-cut-compare.spec 2 例 + smart-rough-cut.spec 新增 2 例，既有 3 例零改动）；desktop 覆盖（口径 B）72.84%（ec769bb4 实测）→ 73.04%（+0.20pp，三阶段全程无回落；**口径 B 勘误注（2026-08-27）**：73.04% 等 desktop 覆盖数字一律指 desktop 口径 B = `apps/desktop/src/**` 排除 `src/e2e/**` 的 ΣLH/ΣLF，勿与 editor-core 全局口径混用——后者受 vitest thresholds 80% 强制，实测 91.7% 量级）；三阶段 CI 全绿零 flaky。

**关键决策存档**：
- D1-B：Compare 数据源走 contentAnalysis 派生（帧采样留后续增强）；onsets 从 segments.loudness 上升沿 + dialogueTurns 起点派生，不调 bridge
- D2-A：检测参数 hook 本地 state（会话级），不新增 store
- D3/D4：语义智能建议（M3）与批量处理留 P2——M3 启动前提 = whisper 转写可用性 + contentAnalysis dialogueTurns 覆盖率达可用阈值（待勘察）

### 2.4 v4.75.0 发版 + P2 前置桥接（main 推进 3 PR）

**推进轨迹**（自 #172 HANDOFF 归档点 72206d66 起）：

| PR | merge commit | 主要内容 |
|---|---|---|
| #173 | `70cf89d8` | v4.75.0 发版：三文件 bump（4.74.1→4.75.0，Cargo.lock 经 `cargo update -w --offline` 同步）+ CHANGELOG（Features/Bug Fixes/Refactor/Tests/Docs 分组）；bump 提交 `39e7cf74`；lightweight tag v4.75.0 触发 release.yml 三平台构建自动建 Release（6 资产），`gh release edit` 校正标题「v4.75.0 智能粗剪」并替换 notes；CI 全绿（e2e 原记录 534 passed，run 原文实为 535 passed——见 2.5 口径修正） |
| #174 | `f8eece75` | RELEASING.md 发版工作流文档（97 行）：固化三处既有惯例——lightweight tag 打 bump 提交 / release.yml 自动建 + edit 校正 / merge 信息 `release:` 前缀 |
| #175 | `5183ae89` | P2 前置桥接管线：`collectSubtitleTranscriptForClip`（subtitle 轨按 clip 范围收集 text + 时间对齐，1e-6 容差）+ `useTranscriptForClip` hook（组装 `(transcript, timeAlignment)` 调用 understandSpeech）+ `useSmartRoughCut` 返回值 `speechUnderstanding` 扩展位；4 文件 +260 行，新 hook 覆盖率 100%，e2e 534 零回归 |

**P2 no-go → go 转折点记录**：

1. **勘察结论 no-go**（2026-08-26，P1-2 结项后）：M3 语义建议需"带时间对齐的转写文本"，两个前置数据可用性评估均不达标——whisper 转写管线真实可用但转写文本不回流 contentAnalysis；contentAnalysis dialogueTurns 产出率 54% 但零语义能力（纯能量启发式，无文本输入）；唯一语义引擎 understandSpeech 沉睡在 core，smart-creation-orchestrator 因 `aiAnalysis.transcript` 字段不存在而恒空转
2. **桥接补齐**（PR #175）：不动 understandSpeech 内部实现（沉睡资产激活而非重写）、不动 whisper.rs（转写管线已可用，只接其产物），从时间线 subtitle 轨直读 whisper 产物组装入参
3. **go 判定**：understandSpeech 已激活，`speechUnderstanding`（含 keywords/topics/narrativeMarkers/summary + ready 就绪信号）可从 `useSmartRoughCut` 直接消费——M3 启动的数据前提已补齐

**M3 待决策项**（启动前需决策，勘察项 3 已定位挂载点两处均现成）：

- **挂载点**：SmartRoughCutStepPanel 扩展位（M1 拆分预留，面板头注释明示模式）vs RoughCutComparePanel 路径（Compare 已有 contentAnalysis 数据就绪门控模式可类比）
- **产品形态**：基于叙事标记的粗剪建议列表——understanding 产出的 narrativeMarkers（opening/rising/**climax**/falling/ending）天然适配"高光优先"式建议，keywords/topics 可作建议的语义注脚 vs 其他形态
- **数据就绪信号复用**：`speechUnderstanding.ready` 是否作为 M3 入口门控（类比 Compare 入口依赖 contentAnalysis 的模式：未分析 clip 入口禁用）

**观察池追加**（勘察发现，不在 M3 范围）：ASRStage worker 请求参数空占位未接线（已于 2026-08-27 销账——定性死链路退役，见 4.2 销账记录）；VAD 纯音乐误报 30s"对话轮"（已于 2026-08-27 销账——detectDialogueTurns 结构化治理，见 4.2 销账记录）

### 2.5 P2 主线 M3 语义建议两阶段（M3-1/M3-2 已合入，M3-3 未启动）

**三阶段规划总览**（M3 启动数据前提已由 #175 补齐，go 判定见 2.4）：

| 阶段 | PR / merge commit | 状态 | 主要内容 |
|---|---|---|---|
| M3-1 数据层 | #177 / `1b42a9c0` | ✅ 已合入（2026-08-26） | 桥接产出派生建议列表纯函数 |
| M3-2 UI 层 | #178 / `4367f9d9` | ✅ 已合入（2026-08-27） | SemanticSuggestionList 组件 + ready 门控 |
| M3-3 应用整合 | #184（A1）/ `e8f94590` | ✅ A1 已合入（2026-08-27；定调：A1 先行，落地后发 v4.77.0；A2 批量整合降格为下一个小版本设计候选——前置条件 = Compare 单条应用的真实使用信号证明批量入口必要 + 应用整合设计文档（MediaState 撤销边界/draft 合成/冲突消解）过审） | A1 边界：单条审阅+显式采纳；A2 备注见本节末 |

**#177（M3-1，纯数据层）**：`SemanticRoughCutSuggestion` 类型 + `generateSemanticRoughCutSuggestions` 纯函数（从语义桥接产出 narrativeMarkers 派生建议列表：区间 = marker.time → 下一 marker.time，末项延伸至 clip 末端；climax 按 confidence 降序优先、其余时间升序殿后；clip 范围外 marker 剔除）+ `useSmartRoughCut.semanticSuggestions` 扩展位接线（useMemo 派生）。零 UI 改动，上游 understandSpeech / useTranscriptForClip 零改动，类型不落库不入持久化 schema。semantic-suggestion.ts 行覆盖 **100%**（lcov LF/LH = 41/41 实测），单测 13 例，e2e 发现数 535 零回归。

**#178（M3-2，UI 层）**：`SemanticSuggestionList` 只读组件（label + timeRange + reason + confidence 展示，climax 项 `data-climax` 标记高亮；只读呈现不自动应用——应用整合属 M3-3 范围），挂载 SmartRoughCutStepPanel basic tab whisper 步后扩展位（2.4 决策预留位之一）；hover playhead 联动复用 M2 结果项 onMouseEnter 路径（无 leave 回调，行为对齐）；`speechUnderstanding.ready` 门控对齐 Compare 入口惯例（未就绪显示提示文案，类比 Compare 依赖 contentAnalysis 就绪信号）。e2e +2 例（门控→转写→列表渲染含 climax 高亮 / hover playhead 断言）：whisper mock SRT 变量化 + `setWhisperSrtContents` e2e action 注入叙事标记转写，默认值不变保既有用例兼容。累计 7 文件 +417/-10。

**CI major outage 事件记录**（供未来故障参考）：2026-08-26T15:21:05Z 起，PR #178 分支 pull_request run（id 32984802342）持续卡 queued 约 3h20m 无进展——GitHub API 显示 run 内零 job 被调度、updatedAt 冻结在创建时刻（定性平台侧僵死，非正常排队等待）；18:41:29Z close → 18:41:31Z reopen 重触发新 run（18:41:34Z 创建）一次全绿，处置成功。处置要点：长时卡 queued 先查 API 层 job 是否存在与 updatedAt 是否推进，确认僵死后 close+reopen 强制新建 run，优于无限等待。

**e2e 口径修正记录**（双口径确立，逐 run CI 实测汇总）：

| 时点 | main 位置 | 静态套件 | Playwright 汇总原文 |
|---|---|---|---|
| v4.75.0 发版 | `70cf89d8`（run 32931852510） | 535 specs | `535 passed (32.5m)` |
| #175 merge | `5183ae89`（run 32943128891） | 535 specs | `1 flaky / 534 passed (41.5m)` |
| #176 merge | `02a052eb`（run 32971840207） | docs-only | e2e job 走 Docs-only 跳过路径 |
| #177 merge | `1b42a9c0`（run 32979199629） | 535 specs | `535 passed (32.0m)` |
| #178 merge 后 main | `4367f9d9`（run 33004915434） | 537 specs（+2） | `537 passed (41.8m)` 零 flaky |
| #186（M3 扩展·首实施） | feat 分支（run 33077635573） | 541 specs（+3） | `2 flaky / 539 passed (43.1m)`，flaky 均池内已知（ai-multicam-cut / nested-sequence-export） |

自 v4.75.0 发版至 #177，spec 文件零变更（`git diff 70cf89d8..1b42a9c0 -- apps/desktop/e2e/` 为空），静态发现数恒为 535。此前 HANDOFF 各处 "534" 均为 passed 数口径（其中 2.4 表内 "#173 e2e 534 passed" 行与发版 run 原文 `535 passed` 不符，系笔误沿袭 M2 时期数字）；#175 merge run 的 `1 flaky / 534 passed` 中 flaky 用例为 nested-sequence-export.spec.ts:67「批量序列渲染入队」（观察池既有项，只记录不修），重试通过不计入 passed 即 534 与发现数 535 并存的根因。自本文档起统一以发现数表述；该时点基线 537 后经 #181 smart-subtitles.spec 9→7 例重写净减 2 例，当前基线**发现数 535 = passed 535 零 flaky**（PR #182 run 33045131192 实测，41.5m，2026-08-27 归档更新）。

**M3-3 待决策项**（启动前需决策，三项择一）：

- **Compare 策略语义增强**：语义建议并入 RoughCutComparePanel 策略对比体系（叙事标记如何参与策略对比轴待设计）
- **建议应用整合 ApplyCommand 化**：建议应用走命令对象——涉撤销栈与既有命令体系关系（Timeline 命令对象约束要求 undo/redo 完整，M1b ApplyRoughCutProposalCommand 波纹删除为先例）
- **或暂缓**：保持两阶段产出只读呈现，整合排期另行评估

**2026-08-27 定调记录**：M3-3 方向择定为 A1（语义建议接入 Compare 审阅 + 单条显式应用），A1 合并后另行发 v4.77.0；A2（批量/多选整合）降格为下一个小版本设计候选，启动前置条件 = ①Compare 单条应用的真实使用信号证明批量入口必要 ②应用整合设计文档（MediaState 撤销边界 / draft 合成 / 冲突消解）过审；A3（暂缓）不再单独跟踪。

**M3-3 A1 实现（PR #184，merge `e8f94590`）**：新增纯函数层 `semantic-suggestion-review.ts`（时间线绝对时间 → 源素材时间换算 `source = trimStart + (abs − clip.start) × speed`、单元素 segments 构造、before/after 审阅视图模型、整 clip 覆盖预判——与 ApplyRoughCutProposalCommand 命令侧守卫口径一致）+ `SemanticSuggestionReviewDialog`（before/after 双条带 + 保留比例 + 「采纳此建议」单一显式入口 + 成功/失败即时反馈；整 clip 建议禁用采纳并说明）+ `useSmartRoughCut.applySemanticSuggestion`（try-catch 包既有命令通道，失败零时间线变更）+ `SemanticSuggestionList` 项内「对比审阅」入口。审阅目标打开时快照 clip（采纳以新 id 切片替换原 clip，实时 selectedClip 会失联）。红线遵守：无多选/批量/自动应用、无新增 store/持久化、撤销只走既有 undo 栈、MediaState 撤销栈内部零触碰、detectDialogueTurns/maxTurnDuration 零改动。e2e +3 例（审阅打开断言 / 采纳成功+undo 恢复 / 整 clip 建议预判禁用），发现数 535 → 538（run 33052967308：`536 passed + 2 flaky`，flaky 均池内：advanced-text:4 / nested-sequence-export:67）；desktop 口径 B 73.2213%。

**M3 扩展·首实施（PR #186，双源勘察共识第一梯队，2026-08-27）**：b（掐头收紧 head-trim）+ d（收尾收紧 tail-trim）落地——均为单区间 keep-range，审阅采纳链零改造复用（suggestionToSegments → ApplyRoughCutProposalCommand → undo 既有链路，审阅模型与 coversEntireClip 不做多区间改造）；c（情感高潮 top-K）仅交付通用算法内核 `selectTopKMutuallyExclusive`（高潮点向后 windowDuration 成区间、score 降序贪心互斥、端点相接不算重叠、并列 score 时间升序决断），本期组装层不消费；a（长静默）/ e（节拍对齐）/ f（冗余台词）三方向评估不碰；A2 批量整合维持人类决议挂起，本轮任何形态不涉及多选/批量应用。实现分层：editor-core 三个只增纯函数（`detectHeadTrimStart`：首个内容起点 + `HEAD_TRIM_MARGIN_SECONDS=0.3` 余量、onset 兜底、极短 clip 保护 `TIGHTEN_MIN_KEEP_SECONDS=1`；`detectTailTrimEnd`：尾部低能量回溯、防误伤片尾淡出的 silenceThreshold 显式参数（默认 0.08 与 detectDialogueTurns 同口径，参照 maxTurnDuration 先例定性）；单测矩阵 42 例，detectDialogueTurns/maxTurnDuration 零改动）+ desktop 派生层 `semantic-tighten-suggestion.ts`（contentAnalysis 源域 → 时间线绝对域换算 + loudness 上升沿 onset 兜底，阈值常量自 useRoughCutAnalysis 导出复用防重复实现）+ 合并去重规则（确定性并配测：climax 优先（confidence 降序）→ 非 climax narrative 时间升序 → head-trim → tail-trim；派生项与 narrative 项 timeRange 完全相等（1e-6 容差）时剔除派生项，同区间重复出现视为缺陷）+ `SemanticRoughCutSuggestion.source` 字段（narrative/head-trim/tail-trim，向后兼容补默认值）+ `semanticReady` 双源门控（转写或内容分析任一就绪即呈现各自部分）+ UI「掐头收紧」「收尾收紧」文案与「启发式」来源标签（zh 文案，en-overrides 不动，沿 M3-2 先例）。**情感高潮 top-K 闸门**：入池待裁——待 b+d 真实使用信号后再裁是否组装接入，且届时须同时回答与 Compare 方案卡的双入口分工。**销项（人类定调，2026-08-28）**：单一用户项目，用户本人已实际采纳 b+d 建议，原判定标准「b+d 真实使用信号」以定调记录方式关闭，组装接入放行（定调与双入口分工答案详见 2.8）；落地 = PR #192。**采纳计数器**：`open-factory:semantic-suggestion-adoptions` 键（`{source, ts}[]` 封顶 500 截旧），挂点 applySemanticSuggestion 成功分支（失败不入账，写入异常静默）；纯本地零上报、不进项目持久化 schema；用途 = 可按任意口径（来源类型/时间窗）聚合，作为建议质量评估与后续拓展方向（含 top-K 闸门判定）的长期候选拓展信号积累。e2e +3 例（混合门控：仅分析就绪时收紧类条目出现且 narrative 缺席 / head-tighten 审阅+采纳时长缩短+undo 还原 / tail-tighten 同款），发现数 538 → 541（run 33077635573：`539 passed + 2 flaky` 均池内已知项）；desktop 口径 B 73.2941%（基线 73.1881%，+0.11pp）。

### 2.6 P2 收官双修复 + 观察池销账（2026-08-27）

| PR | 代码提交 | merge commit | 主要内容 |
|---|---|---|---|
| #181 | `93c12e31` | `c1e2f4e5` | ASRStage 死链路退役：四断点实证（请求参数空占位 / worker `tauri-request` 无主线程应答器 / audioPath 结构性缺失 / `whisperReady` 恒 false）定性死链路而非接线；执行「保下游、去上游」切割（删除 ASRStage.tsx 与 ai-transcription.worker.ts，转写生成字幕由分步面板 whisper 步与 Timeline 右键承接）；e2e smart-subtitles.spec 9→7 例壳层重写，发现数 537→535 |
| #182 | `f5ecaf03` | `74da84a4` | detectDialogueTurns maxTurnDuration 判据治理纯音乐误报（默认 15s 可配，六形态回归矩阵固化入 content-analysis.test.ts）+ `lib/asr.ts` 空壳桩及桩测试删除（死代码自证闭环）；run2 实测 e2e `535 passed (41.5m)` 零 flaky；desktop 口径 B 覆盖率 73.1881%（基线 73.04%，+0.15pp） |

### 2.7 v4.78.1 热修：生产包启动黑屏（vendor 分块循环求值）+ 生产冒烟入 CI（2026-08-28）

**事故与诊断**：v4.78.0 真机冒烟发现安装包启动黑屏（#root 空、React 挂载中断）。机器侧 CDP 程序取证定位：生产构建 vendor 分块拆分下，vendor-utils 中 @tanstack/react-virtual 的模块级代码 `const Wn=typeof document<"u"?N.useLayoutEffect:N.useEffect`（N=React 导入绑定，为 undefined）在 React 初始化前求值，入口模块求值期崩溃。本地 vite build 复现实锤循环：入口 index 首行 import vendor-react → vendor-react 首行 import vendor-utils（react-dom 的直接依赖 scheduler 被 manualChunks 兜底规则路由进 vendor-utils）→ vendor-utils 首行 import vendor-react（react-virtual 依赖 React）——**双向 chunk 级循环**，vendor-utils 模块体先于 react 模块体求值。

**考古定性（遗留债，非 #186 回归）**：@tanstack/react-virtual ^3.14.5 引入于 `8bf7a5f4`（2026-07-04，v4.13.0 起在产）；manualChunks vendor 拆分引入于 `d17ffe76`（2026-07-28，v4.73.0 起生效）；两者均早于 v4.77.0（bump `9afaa8a3`）。实证：checkout v4.77.0 + vite build（产物落 TEMP 自证后清），其 vendor-utils-BI0vssp6.js / vendor-react-D38zqad2.js 块名 hash 与 main 构建完全一致——**分块结构同构，v4.73.0～v4.78.0 生产包均带病**，此前从未被真机冒烟检验；v4.77.0→v4.78.0 vite.config.ts 零 diff、package.json 仅版本号变更，排除 #186 回归。

**e2e 漏网原因**：e2e 全量跑 dev server（vite dev 无 rollup 分块，浏览器原生 ESM 加载序不同），生产分块崩溃对 e2e 不可见——这是本事故的流程盲区，生产冒烟基建即为此补齐。

**修复（方案 B 循环塌缩，两层，commit `23795583`）**：

1. **vendor 层**：vendor-react 收敛为 React 生态闭包（react + react-dom + scheduler 同块，消除 react-dom→vendor-utils 反向边）；@tanstack 独立成 vendor-tanstack，对 vendor-react 保持单向依赖（React 不反向依赖 tanstack），既保证求值序安全又守住 vendor-react 200KB 预算（实测 194.65KB）。
2. **editor-core 层（修复 vendor 后暴露的第二层 TDZ）**：vendor 修复后冒烟复跑发现 `ReferenceError: Cannot access 'w' before initialization`（editor-core-timeline 块，timeline-templates 顶层求值 BUILT_IN_TIMELINE_TEMPLATES 访问 model 的 DEFAULT_COLOR_CORRECTION）；逐层定位后实测 editor-core 家族按文件名正则拆出的 10 个域块存在 **92+ 条兜底→域、300+ 条域→兜底、40+ 条域间文件级循环边**（Rollup 15+ 组 Circular chunk 警告实锤），多个域文件顶层求值访问跨块绑定，打地鼠不可持续——**合并为单一 editor-core 块**，环回到 chunk 内部由 Rollup 模块拓扑排序保证求值顺序（块级执行序由浏览器 import 决定、Rollup 失去控制，正是多块循环爆 TDZ 的机制）。原分块缓存粒度损失可接受（本地 Tauri 桌面加载无网络往返，包级缓存语义保留）。

**配套变更**：`budget.json` maxChunkSizeKB 600→2000（editor-core 单块 1547KB，正确性塌缩的结构性代价；总量 6800KB 与 vendor-react 200KB 预算不变仍受控，check:bundle 实测 PASS）。

**生产冒烟基建（事故核心产出）**：`apps/desktop/scripts/prod-smoke.mjs`（vite preview 起静态服务 + 无头 Chromium 加载首页，断言 #root childElementCount>0 且零 pageerror；纯浏览器下 Tauri invoke 不可用的 console error 为环境预期项，不计入门禁）+ CI 新增 `prod-smoke` job（commit `e9025f37`，与 e2e 并行：bun install → playwright chromium → bun run build → node scripts/prod-smoke.mjs）。

**本地验证证据**：修复前 prod-smoke 断言超时（#root 30s 未挂载，pageerror 实录 TDZ）；修复后 `{"passed":true,"rootChildElementCount":1,"pageErrors":[]}` exit 0；typecheck / 全量单测（675 文件 12494 passed + 3 skipped）/ `bun run build` / check:bundle 全部 exit 0。本 PR 零 spec 文件变更（e2e 发现数 541 不变）、零 src 代码变更（覆盖率口径 B 预期持平，CI 复核）。

**CI 实测（PR #188 run 33133132292 全绿）**：changes / frontend（4m52s）/ rust（6m15s）/ **prod-smoke（2m18s，新基建首跑即绿）** / e2e（45m58s）全部 pass；e2e 汇总 `1 flaky + 540 passed (44.8m)` = 发现数 541 不变（flaky 为池内已知 nested-sequence-export 第 3 次复发，只记录不修）；desktop 口径 B **73.2941%**（CI artifact lcov 实测，与 #186 基线逐位一致，零回归实锤）≥ 门槛 73.1881%。

### 2.8 M3 扩展·第二梯队：情感高潮 top-K 建议组装接入 + 搭车维护（2026-08-28）

**闸门定调记录**：top-K 内核 `selectTopKMutuallyExclusive` 于 #186 入池待裁，原判定标准为「b+d 真实使用信号」。人类定调放行（2026-08-28）：单一用户项目，用户本人已实际采纳 b+d 建议（采纳计数器入账），原判定标准以定调记录方式关闭——闸门销项，组装接入放行；2.5 闸门原文保留不动。

**设计答案**（勘察结论，已落地）：

- **数据源**：`clip.contentAnalysis.emotionCurve`（源域）→ 过滤至 clip 源窗口 → top-K（K=2，window 5s，minScore 0）→ clamp 至窗口 → 换算时间线绝对时间；clamp 后短于 1s（`TIGHTEN_MIN_KEEP_SECONDS` 同口径）不产出
- **互斥语义**：top-K 组内互斥（内核保证）；与 head/tail-trim 不跨组互斥（局部高光区间 vs 整 clip keep-range，语义不同），区间完全相等时走既有 1e-6 去重
- **双入口分工**：Compare 方案卡 = 整段粗剪重构（多区间策略提案）；建议列表 top-K = 局部高光保留（单区间），同一 `ApplyRoughCutProposalCommand` 命令通道
- **UI 文案**：UI 零改动——SemanticSuggestionList 已按 `markerType==='climax'` 琥珀高亮、`source!=='narrative'` 挂「启发式」标签，新源天然适配

**实现**（PR #192 / merge `0706cf38`，12 文件 +539/-15）：

- editor-core：`selectEmotionalClimaxIntervals` 组装层（窗口过滤 + 内核互斥选取 + 边界 clamp + 极短保护），内核零改动；单测 +6 例
- desktop：`semantic-climax-suggestion.ts` 派生层（emotionCurve → 时间线绝对域换算）+ `mergeSemanticSuggestions` 第三源（climax 组 confidence 降序）+ `SemanticSuggestionSource` 新增 `emotional-climax` 枚举 + 采纳计数器 `VALID_SOURCES` 同步；单测 +12 例
- e2e：+2 例（单源形态呈现 / 审阅采纳 + 计数入账 + undo 恢复），发现数 541 → 543
- 门禁：PR CI 六项全绿；全量单测 12513 passed（基线 12494 + 19）；desktop 口径 B 73.35%（基线 73.2941%，+0.06pp）；typecheck / build exit 0；本地 prod-smoke passed 零 pageerror；main 终位 run 33165898507 实测 `542 passed + 1 flaky (42.7m)`（flaky 为池内已知 ai-multicam-cut 复发）
- 红线遵守：无多选/批量/自动应用（A2 维持挂起零涉及）；无新增 store/持久化；撤销只走既有 undo 栈；纯本地零上报

**搭车维护**（PR #193 / merge `c6bf6365`，3 文件 +17/-6）：

- roadmap.md：补勾两项 v4.75.0 已交付项（后台媒体作业优先级调度与显式限流 / 批量波形预生成与 codec 感知音频解码回退），Last updated 刷新至 2026-08-28
- ltx-video：`downloadModel`/`deleteModel` 补 `isTauriRuntime` 检查——浏览器环境以明确错误拒绝（写操作不可静默成功），对齐同文件 detectGpu/listLocalModels 回退惯例；单测同步（4.1 补漏清单该项销账）
- PR #104 关闭：人类定调 wontfix（2026-08-28）——hooks 拆分思路不废弃，并入 #108（editorUIStore 冻结约束系统性执行漏洞）治理范围统一处置，避免两次大改同一文件；分支保留远端作拆分参考（观察池销账）

---

## 3. 当前状态

**位置**：main = `e5266a6b`（PR #194 merge），本分支为 v4.79.0 发版（主题「情感高潮 top-K 建议」，bump 见本 PR），工作区干净。v4.78.2「隐藏控制台窗口」已发布（2026-08-28）。M3 扩展·第二梯队（情感高潮 top-K 组装接入）已合入，top-K 闸门已定调销项（见 2.8）；M3-3 A2 为下一个小版本设计候选。

**基线数据**：

- desktop 覆盖（口径 B）= **73.35%（CI artifact lcov 实测，#192 run 33158276571）**；基线演进：73.04%（4367f9d9）→ 73.1881%（74da84a4）→ 73.2213%（e8f94590）→ 73.2941%（a609d8f5 → 20e93ba5 持平）→ 73.35%（0706cf38）；历史本地-CI 偏差 ≤0.04pp 稳定规律（CI artifact lcov 可下载复核）
- editor-core 行覆盖 = **91.7356%**（CI artifact lcov 实测，#186 run；阈值 80%）
- 全量单测：675 文件全过 exit 0（**12513 passed + 3 skipped**，#192 实测 = 基线 12494 + 19），无 unhandled rejection
- e2e（双口径，自 2.5 起以发现数为准）：**发现数 543**（main run 33165898507 实测 `542 passed + 1 flaky (42.7m)`，flaky 为池内已知 ai-multicam-cut 复发；#190 run 33141956888 曾 `541 passed (34.1m)` 零 flaky；#188 run 33133132292 曾 `540 passed + 1 flaky (44.8m)`，flaky 为池内已知 nested-sequence-export 第 3 次复发；drawtext 族监控规则继续有效，本 run 无 drawtext 族新面孔）
- typecheck 0 错误；coverage 稳定生成

---

## 4. 待办与观察池

### 4.1 按需补漏清单（非专项，遇改即测）

- store 三件：editorStore 25.07% / performanceMonitorStore 24.68% / editorFeatureStore 58.88%
- 深水区：color-grading / scripting / plugins / media
- renderer.ts 剩余 144 行 WebGL 深交互路径
- ~~ltx-video downloadModel/deleteModel 浏览器回退缺失（缺 isTauriRuntime 检查，小缺陷候选）~~——**已销账（2026-08-28）**：PR #193 补齐 isTauriRuntime 检查（见 2.8）

### 4.2 观察池（全量刷新，含来源期次）

| 观察项 | 来源期次 | 说明 |
|---|---|---|
| e2e flaky：nested-sequence-export | e2e 多轮观察 | 间歇性，常规监控；累计 3 次复发（#175 首见 / #184 复发 / #188 再现），重试均通过 |
| e2e flaky：ai-multicam-cut / credits-roll-drawtext | 四期-B 后第 6 轮 | 低优先；ai-multicam-cut 累计 2 次（第 6 轮首见 / v4.79.0 前 main run 33165898507 复发，重试通过），credits-roll-drawtext 维持 1 次 |
| e2e flaky：advanced-text | PR #182 CI（2026-08-27） | 首见；累计 2 次（#182 首见 / #184 复发），持续监控；rich text drawtext 导出用例重试通过，只记录不修 |
| **drawtext 导出族监控规则** | 2026-08-27 收官归档 | 已两例同风味（advanced-text:4 / credits-roll-drawtext）；出现第三例同类时启动只读勘察定位共性根因 |
| **生产构建分块顺序监控规则** | v4.78.1 热修（2026-08-28） | 事故根因为 manualChunks 循环分块 + 模块级求值访问跨块绑定（v4.73.0 起潜伏）。监控规则：任何 manualChunks 规则改动后本地必跑 `node scripts/prod-smoke.mjs`；CI prod-smoke job 持续把关。新增 vendor 依赖或调整路由时检查 vendor-react 闭包完整性与 chunk 依赖方向单向性（vite build 输出出现 Circular chunk 警告即红灯） |
| **正式包 Rust stdout 不可见** | v4.78.2（2026-08-28） | 正式包 Rust stdout（tracing JSON）自 v4.78.2 起 windows_subsystem=windows 后不再可见，属预期行为；后端诊断以 CDP 前端取证为主通道（v4.78.0 事故中已验证有效） |
| 慢 runner noisy-neighbor | e2e 稳定性专项 | 定性不变，timeout 余量约 49% |
| getClipSpeed 重复实现 | 二期 | ai-features.ts vs editor-core |
| useClipInspectorState 拆分重构候选 | 三期 | hook 结构过大 |
| generateSubtitles store 引用一致性 | 二期 | — |
| removeAnomaly 边界 | 二期 | 边界条件未定义 |
| vi.clearAllMocks / mockIPC clearMocks 基建纪律 | 四期-B / 五期 | resetAllMocks 防跨测试泄漏；mockIPC clearMocks 不删 `__TAURI_INTERNALS__` 本体，测浏览器回退需手动 delete |
| subtitle 定位 y 双重偏移 | 四期-A | text-renderer，潜在产品缺陷待定 |
| checkAppUpdate 依赖 plugin-updater null 契约 | 五期 | plugin 大版本升级时复核 |
| runPipeline 测试桩依赖 enqueueExport 返回结构 | 四期-B | 返回结构变化需同步桩 |
| syncExportPresetsWithWebdav 错误传播隐晦 | 四期-B | getText 失败内部捕获，仅 putText 失败外显 |
| estimateTextureBytes(NaN) 保守归一 | 四期-B | NaN 污染整积归一为 1，保守设计 |
| relaunch 命名差异 | 五期 | 实际命令为 plugin:process\|restart |
| fast-uri override / release.yml 标题 / audit.toml 豁免复核 | CI 基建专项 | 上游更新后逐项清理 |
| ASRStage worker 请求参数空占位未接线 | ~~P2 勘察（2026-08-26）~~ | **已销账（2026-08-27）**：定性死链路退役，见下方销账记录 |
| VAD 纯音乐误报 30s"对话轮" | ~~P2 勘察（2026-08-26）~~ | **已销账（2026-08-27）**：detectDialogueTurns 治理，见下方销账记录 |
| issue #104 SettingsDialog hooks rewrite | ~~悬置（2026-08-27 收官归档）~~ | **已销账（2026-08-28）**：人类定调关闭 wontfix——hooks 拆分思路并入 #108 治理范围统一处置，分支保留远端作拆分参考（关评原文见 PR #104） |

**观察池销账记录（ASRStage 死链路退役，2026-08-27）**：四断点实证定性 b) 死链路而非接线——①请求参数空占位（原 ASRStage.tsx L113-115）②worker `tauri-request` 消息无主线程应答器，调用必挂起至内置超时 ③audioPath 结构性缺失（selectedClip 仅 `{id,name}` 无媒体路径）④`whisperReady` 全仓无写入 true 路径恒 false。执行「保下游、去上游」：删除 ASRStage.tsx 与 ai-transcription.worker.ts（后者经穷举核实全仓唯一消费方为 ASRStage），面板流程改为润色→样式→导出三阶段直入，Polish/Style/Export 组件渲染契约零变更；转写生成字幕由分步面板 whisper 步与 Timeline 右键「生成字幕」承接（均 `buildWhisperSubtitleTrackForClip` 命令化入轨、e2e 覆盖）。e2e smart-subtitles.spec 由 9 例重写为 7 例壳层用例，`setupAISubtitleWorkflowFixtureWithClip` action 同步移除。附带发现未处理（仅记录）：`lib/asr.ts` 为独立空壳桩且全仓无消费者，属另一既有死代码候选。

**观察池销账记录（VAD 纯音乐误报治理，2026-08-27）**：`detectDialogueTurns` 新增结构化判据——超过 maxTurnDuration（默认 15s，可配）的完全无切分连续高能量块判定为非对话性能量流（纯音乐/环境声典型形态：能量 VAD 无法区分语音与音乐，真实对话必有换气停顿被 mergeGap 切分）而剔除。六形态回归矩阵固化入 content-analysis.test.ts（2Hz 合成口径）：纯音乐 1×30.5s 假 turn → **0**；近静音/无音频轨/访谈 7 轮/vlog 3 轮/电影对白 14 轮全部零变化（前后对照实测）。消费方零外溢：ai-scene-tagger 对话占比与轮次数、Compare onsets 假触发点、sceneTypes dialogue 虚标均自动正向修正或不变。附带预授权项同步完成：`lib/asr.ts` 空壳桩及其桩测试删除（修正上轮记录：桩存在唯一消费方为其自身 8 行测试文件，属死代码自证闭环）。

**观察池收尾（2026-08-27）**：本轮观察池治理完毕，进入准稳态，主线开放项收敛为上述两项待调决策（M3-3 方向 A1/A2/A3 择一、issue #104 去留）。

**观察池更新（2026-08-28）**：top-K 闸门销项（人类定调放行，2.5 闸门原文保留，定调见 2.8）+ issue #104 销账（wontfix 关闭，hooks 拆分思路并入 #108）；主线待调决策收敛至 M3-3 方向一项（A2 批量整合启动前置评估：①Compare 单条应用真实使用信号证明批量入口必要 ②应用整合设计文档过审，见 2.5 定调记录）。

---

## 5. 重要的文件路径和约定

### 5.1 CI 结构（`.github/workflows/`）

- `ci.yml`：changes（paths-filter）→ rust（required，含 cargo-audit）+ frontend（bun audit → typecheck → vitest --coverage）+ e2e（playwright，timeout 60 分钟 × retry 2）+ prod-smoke（生产产物冒烟：vite build → preview + 无头 Chromium 断言 #root 挂载，v4.78.1 起与 e2e 并行）+ security-scan（仅 schedule）
- `release.yml`：`on: push: tags: 'v*'`，tauri-action 三平台构建自动建 Release
- **audit 豁免机制**：`apps/desktop/src-tauri/.cargo/audit.toml`（每条豁免须附风险评估注释 + 升级待办）

### 5.2 发布流程惯例（v4.74.1 确立，v4.75.0 沿用）

> 详细工作流已固化为 `RELEASING.md`（PR #174）。

1. fix 分支 --no-ff merge 进 main（信息 `release: vX.Y.Z <中文标题>`）
2. bump 三文件 + CHANGELOG 条目 + bump 提交（`chore: bump version to vX.Y.Z`）
3. check:release 验证（smoke:golden 必须 exit 0；smoke:preview/cancel 失败为 main 既有可忽略）
4. lightweight tag 打在 bump 提交上，显式推送（**勿用 --follow-tags**，会静默漏掉 lightweight tag）
5. tag 触发 release.yml 自动建 Release → `gh release edit` 校正标题（仓库惯例：纯版本号或 `vX.Y.Z 主题`）+ notes-file 替换为 CHANGELOG 提取内容
6. main 入库必须走 PR（分支保护），gh pr create → 等 rust 过 → `gh pr merge --merge --delete-branch`

### 5.3 测试基线（当前健康度）

- 全量单测：672 文件全过 exit 0（12415 passed + 3 skipped），CI 实测 ~273s，无 unhandled rejection
- 全量 e2e：**发现数 537 / passed 537 零 flaky**（双口径纪律见头部注与 2.5 口径修正记录；历史 "534" 为 passed 数口径）；CI 单轮 28-45 分钟（慢 runner 区间）
- 覆盖率：desktop（口径 B）73.04%（4367f9d9 CI artifact 实测，历史本地-CI 偏差 ≤0.04pp）；editor-core thresholds 80% 无违规
- vitest 默认 `reportOnFailure=false`：**测试失败时 coverage 不生成**（CI coverage 依赖测试全绿）

### 5.4 长命令执行方式（TRAE 终端约束）

- 超过 5 分钟的命令必须用 **schtasks 计划任务模式**（`/create` + `/run` + 日志重定向文件 + 轮询 + 事后 `/delete`）
- Start-Process 分离进程会被终端连树回收（约 15 分钟）；脚本必须**纯 ASCII**（PowerShell 5.1 解析无 BOM UTF-8 中文 .ps1 会乱码致语法错误）
- PR body 含中文/引号时用 `--body-file`（命令行内联转义不可靠）

### 5.5 关键模块路径与工具存档

| 类别 | 路径 |
|---|---|
| e2e mock 基建 | `apps/desktop/src/e2e/install-mocks.ts`（VITE_E2E=true 时 main.tsx 动态加载） |
| playwright 配置 | `apps/desktop/playwright.config.ts`（webServer 注入 VITE_E2E、CI retries=2） |
| 覆盖率配置 | 根 `vitest.config.ts`（thresholds：editor-core glob 80%、全局 70%；coverage 排除 `apps/desktop/src/e2e/**`） |
| **覆盖率统计脚本（存档复用）** | `.git/coverage-stats.cjs`（本地 lcov 聚合：desktop 口径 B + preview 逐文件）；另 `.git/phase5-survey.cjs`（tauri-bridge/store/workers/cache 四域分域统计） |
| 项目记忆 | `c:\Users\luoguangyu\.trae-cn\memory\projects\-d-code-Ai-open-factory--p2-ce08563aa2e9a1157684\project_memory.md` |

**成熟测试模式五套**（新测试优先套用）：

1. **工厂直调**：`createXxxHandlers(...)` 直接调用（Timeline/Inspector 9 文件确立）
2. **renderHook + vi.mock store**：props 必须在 renderHook 外创建（引用稳定），否则 project 每渲染为新对象会触发派生效果无限重渲染（export/hooks 教训）
3. **beforeEach mockReset/resetAllMocks**：防跨测试 mock 实现泄漏（Inspector 确立，四期-B/五期沿用）
4. **纯计算函数直调**（preview 四期-A 确立）
5. **Fake Web Audio 上下文**断言节点参数与调用序列（audio-renderer）+ **mockIPC 拦截 invoke** 断言 command/参数/三分支（tauri-bridge 五期确立）

### 5.6 工作约束（来自用户）

- 授权全部本地 git 操作（含 merge/tag）；允许 push main 与既有 tag；PR 工作流分支按既定流程推送；**禁止 force push**；main 直推被分支保护拦截，必须走 PR（required check `rust` + 0 approvals 可自 merge）
- cargo 一律 `--offline` 或 `CARGO_NET_OFFLINE=true`（依赖升级任务明确授权在线时除外）
- 与预期不符立即停止该步如实报告，不猜测不绕行
- 发现其它缺陷只记录不修（单提交原则）
- Conventional Commits 中文描述

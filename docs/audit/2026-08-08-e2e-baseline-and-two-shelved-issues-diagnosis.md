# E2E 新基线（443/100，w1/w2 零差集）+ audio-envelope / preflight-warmup 两项搁置问题诊断

- 日期：2026-08-08
- 分支：`fix/114-dev-perf-overlay-render-loop`（HEAD = 6a64ca2b）
- 性质：**纯测量 + 只读诊断。未改任何产品/spec 代码，未改 playwright.config.ts / CI，未 commit，未 push。** stash 对照实验仅临时改动两个文件并已用 `git checkout` 完整恢复（恢复后 `git status` 无已跟踪文件变更）。
- 原始证据落盘：
  - w2 全量日志 `docs/evidence/e2e-baseline-2026-08-08-w2.log`（443/100，28.8m）
  - w1 全量日志 `docs/evidence/e2e-baseline-2026-08-08-w1.log`（443/100，46.2m）
  - 诊断探针 `apps/desktop/e2e-probes-stash/zz-audio-envelope-probe.spec.ts` / `zz-audio-envelope-probe2.spec.ts` / `zz2.config.ts`

## 0. 状态核对（与本轮任务提示词的差异，如实记录）

1. 分支 / 工作区 / 最近 4 次提交（6a64ca2b、cf52b616、1aa2bf88、5e67c344）均与提示词一致。
2. **上一轮（FPS 诊断）没有正式审计文档**，只在 stash 留下 `zz-fps-diagnosis.spec.ts` + `pw.config.ts`（08-08 01:01 前后）；"FPS 9 为瞬态环境现象、非渲染循环复发"的结论仅存在于提示词转述，本轮照单接收、未复核。
3. 提示词写的上次 w1 基线为 **421/117**，但 5e67c344 提交信息原文为"全量 workers=1：381/166 → **426/117**"（426+117=543 与测试池吻合，421+117=538 不吻合）。本文采用 **426/117**。
4. 397/150 时代是 **547** 个测试，427/116 起是 **543** 个。d603f049→5e67c344 之间无任何 spec 提交，4 个测试的差额**推测**是当时暂存于 e2e/ 的探针用例（现 stash 中 zz-probe 等）被移出 testDir 所致——标注为推测，无直接证据。跨池对比（397/150 一线）仅供参考。
5. 环境异常：本轮 harness 后台任务通知**多次回放上一轮的 w1 输出（"432 passed / 111 failed"）并伴随假完成信号**，与磁盘/进程实况不符（当时实测进程存活、进度 100-400/543）。本轮所有结论一律以磁盘日志与进程直接检查为准，通知全部弃用。

## 1. 新基线数字与两轮调度器修复的净贡献

| 时点 | 提交状态 | workers=2 | workers=1 | 备注 |
|---|---|---|---|---|
| 08-07 上午 | task-2(d603f049) 后、布局修复前 | 397/150 | 381/166 | 547 池（含探针，见 §0.4） |
| 08-07 下午 | +布局修复 5e67c344 | **427/116** | **426/117** | 543 池；布局修复 +30/+45 |
| 08-07 傍晚 | +C 簇 spec 1aa2bf88 | **431/112**（final-w2.log） | 未测 | spec 补齐 +4 |
| **本轮** | **+调度器修复 cf52b616、6a64ca2b** | **443/100**（28.8m） | **443/100**（46.2m） | 543 池 |

- **两轮调度器修复合计净贡献（w2，有中间锚点可精确归因）：431→443，+12 转绿，0 新增失败。**
- w1 侧无中间锚点：426/117 → 443/100（+17），其中含 1aa2bf88 的约 +4 贡献，调度器修复在 w1 的独立贡献约 +13。
- **转绿的 12 个**（112 清单有、100 清单无，逐例核对）：audio-viz-export:4、auto-generate:68、export-upload:4、gif-export:4、motion-graphics:4、multicam:4、panorama-export:4、**performance:4**、png-sequence-export:4、post-export-script:4、reframe-export:4、video-stitch-wizard:4。多为簇 G 值断言类（调度器参数顺序/无编码器注入修复后导出参数正确）+ 依赖导出成功的下游断言（history/upload）。
- **新增失败：0**（100 清单 ⊆ 112 清单，`comm -13` 为空）。

### w1/w2 差集：清零

- 本轮 w1 与 w2 的失败集合**逐例完全相同**：共同失败 100，w1-only 0，w2-only 0。
- 对比历史倒挂：08-07 时 ~44 个 flaky 池（w1-only 30 / w2-only 14）；布局修复后缩到 w1-only 1 / w2-only 0；本轮彻底归零。
- 含义：**并发敏感性已消除**，剩余 100 个失败在两种并发下签名逐例一致，全部是确定性 drift/移除/重构，后续任何修复的效果对比不再被 flaky 污染。这是本分支 4 个真实修复（渲染循环、媒体网格布局、两处调度器）+ testid/导航补齐后的累计成果。

## 2. 当前 100 个失败的分类清单（w1/w2 相同）

| 类别 | 数量 | 典型代表 | 处置归属 |
|---|---|---|---|
| 移除/重构簇（testid/入口在现代码无渲染路径） | **52** | multi-device-sync ×10（`toolbar-tools-sync-menu-item`）、team-management ×6、collaboration ×7、plugin-marketplace ×11、color-management-export ×3 + export.spec:105（`export-batch-paths`）、codec-compare-export:4、export-pipeline:4、publish-pipeline:4、super-resolution:4、assist-editing:4、content-generation:4、quality-assessment:4、video-restoration-export ×2、smart-rough-cut:35/62、color-grading-audio ×3（`summary` 结构） | **产品决策**（下线 or 重接），禁止本轮处理 |
| 导出向导步骤导航类 | **6** | export.spec:3/79/133 + versioned-batch-export:4（`export-max-concurrent-select` 在 export 步，spec 在 config 步操作）、nested-sequence-export:67、**timecode-project-settings:4（preflight 面板需切步，见 §4）** | 工程：spec 补切步 or 产品把控件/自动切步补齐 |
| 值断言/时间线语义类（簇 G/H 长尾） | **16** | subtitles:4/49/110、timeline-advanced-tools:5/31/49、timeline-basic:32、timeline-compare:4、timeline-efficient-editing:4、timeline-multiselect:4、timeline-protection:12、timeline-ruler:4、timeline-zoom:39、clip-transition-export:34、keyboard-shortcuts:4、ai-tts:268 | 工程核对新输出正确性后更新断言（或认真回归） |
| 面板导航/外壳长尾（testid 存在、需先打开面板或媒体流程） | **24** | dubbing-adaptation:4/47（`dubbing-analyze-btn`）、lut-editor:4、media-organizer:4、frame-inspector:4、preview:16/38、auto-generate:17/36、app-launch:13、i18n:6、startup-update:4 等 | 逐例 spec 补导航，低风险批量 |
| audio-envelope:4（独立项，本轮已诊断） | **1** | 见 §3 | 见 §3 修复选项 |
| preflight-checklist:55（独立项） | **1** | ack 按钮 DOM 可 resolve 但可见性等待失败（`preflight-ack-flash-clip-preflight-1-1`，元素存在、"waiting for visible/enabled/stable" 反复失败，疑似折叠分类未展开或被遮挡） | 待单独排查（与导出对话框 preflight 是两个组件） |
| **新出现的未知签名** | **0** | —— | 100 全部在 112 清单内 |

preflight/warmup 不自动切步问题本身**没有直接红案**（export.spec:215、export-warmup.spec:4 均已靠手动切步 workaround 通过），但 timecode-project-settings:4 正是该缺口的现行者（归入步骤导航类的 6 个之中）。

## 3. audio-envelope:4 诊断（只诊断，不修复）

### 3.1 复现与失败模式

该用例有**两种失败模式，随运行上下文确定性切换**（不是随机 flaky）：

| 上下文 | 失败点 | 本轮证据 |
|---|---|---|
| 单跑/冷 dev server | spec:10 `timeline-clip-clip-beat-audio` 5s 内不出现（element not found） | 单跑复现 ✓，与上上轮记录一致 ✓ |
| 全量（w1 与 w2 均复现） | spec:61 拖拽后值断言：期望 0.5、实际 0（clip 正常出现、时间 3.0 断言通过） | w1/w2 日志签名逐字一致 |

### 3.2 实验过程

1. **单跑复现**：`bunx playwright test e2e/audio-envelope.spec.ts` → 失败于 spec:10（clip 不出现），与上上轮记录一致。
2. **探针 v1**（store vs DOM 分层检查）：fixture 注入后 **t+0ms store 里 3 个 clip 齐全**（`getTimelineSnapshot` 含 clip-beat-audio），但 DOM 无 `timeline-clip-*`/轨道/gridcell；t+3s 仍无；**t+8s 全部渲染**。→ 问题在渲染层而非 fixture 注入，且渲染延迟在 3-8s 之间。
3. **探针 v2**（精确计时 + 全序列复现）：冷态首次渲染 **8439ms**；clip 出现后按 spec 相同序列操作：点击创建关键帧 `time=2, value=1.5`（与组件映射 `value = 2 - 2y/h` 完全吻合），拖拽到 (0.75w, 0.75h) 后 `time=3, value=0.5` —— **与 spec 期望逐字一致，用例通过**。→ 只要时间线完全渲染稳定，包络产品逻辑完全正确；全量下的 value=0 是几何未稳态下的时序问题（捕获的 boundingBox 与交互时刻的实际几何不一致，y 被 clamp 到底 → value 0），不是包络逻辑 bug。
4. **根因定位**：`Timeline` 是 React.lazy 懒加载（`ShellMainArea.tsx:19`）。冷 dev server 下该 chunk 现编译 8.4s，而 spec:10 的 `toBeVisible()` 走全局 `expect.timeout = 5s` → 单跑必挂；全量时 server 已暖、chunk 已编译，clip 及时出现，随后落入第二种几何时序失败。
5. **stash 对照实验（验证与本分支布局修复的关系）**：将 `MediaBin.tsx`/`Toolbar.tsx` 临时还原到 5e67c344^（`git show` 覆盖，diff 恰为修复的逆），单跑 audio-envelope → **同样失败、同样签名**（clip 不出现）；随后 `git checkout --` 恢复，`git status` 确认无已跟踪文件变更。**结论：与 Toolbar shrink-0 / MediaBin min-h 布局改动无关**（与 5e67c344 提交信息中"audio-envelope 无修复时单跑同样失败"的记载互证）。

### 3.3 结论

- 独立问题，**非本分支任何修复引入**；根因 = lazy Timeline chunk 冷加载 ~8.4s vs 5s expect 超时（模式一）+ 负载下布局未稳态的坐标时序（模式二）。
- 若修（供决策，本轮不动手）：
  - **方案 A（spec 侧，推荐优先）**：spec:10 的可见等待单独放宽到 20s（`{ timeout: 20_000 }`）+ 包络交互前对 envelopeBox 做一次"稳定后重取"（等 500ms 或轮询 box 不再变化再取）。改动 2-5 行，不动产品；工作量 S（约 0.5h + 一轮单跑/全量验证）。覆盖两种模式。
  - **方案 B（产品侧）**：VITE_E2E 下预加载 Timeline chunk（或在 app 启动时 prefetch），消除冷热差异；改动面稍大、影响首屏加载策略，工作量 M。
  - 不建议动全局 expect 超时（配置越界）。

## 4. preflight/warmup 不自动切步诊断（只诊断，不修复）

### 4.1 代码事实（useExportActions.ts addToQueue）

- 入队路径：`collectPreflightIssues → issues.length>0 ? setPreflight(...)+return : warmupSelectedJobs → enqueueSelectedJobs`。
- **preflight 命中（含 warning 级）时只 `setPreflight` 后 return：不切步、不 setError**。PreflightPanel 只渲染在 export 步（ExportProgress.tsx:35-40）；config 步（ExportConfig）**没有任何 preflight 引用**。→ 用户视角：点"加入队列"后界面无任何变化（静默拦截）。
- warmup 期间 config 步唯一可见反馈是入队按钮 disabled（cursor-wait）；`export-warmup-status` 同样只在 export 步（ExportOptimizationPanel.tsx:109）。
- 唯一自动切步发生在 **single 模式入队成功**后（`queuedTasks.length>0 → setCurrentStep('export')`，useExportActions.ts:846-848）。**batch 三个模式（version-batch/sequence-batch/codec-compare）即使入队成功也不切步**。

### 4.2 影响面

| spec | 状态 | 说明 |
|---|---|---|
| export.spec:215（preflight 拦截+relink） | 绿 | 靠 :224 手动 `export-step-export` workaround（注释明示"入队被拦截时不会自动切步"） |
| export-warmup.spec:4（warmup 状态） | 绿 | 靠 :18 手动切步 workaround |
| **timecode-project-settings.spec.ts:4** | **红（当前 100 个失败之一）** | :22 入队触发帧率 warning、:23 直接断言 `export-preflight-panel` 可见，**没有切步 workaround**，5s 超时失败 |

无其他 spec 依赖该行为（`project-save-reload-v411`/`old-project-migration-v411` 的 preflightReport 是项目 schema 字段，无关）。

### 4.3 UX 还是功能性？

- **拦截机制本身功能正常**（导出确实被阻止，relink/continue 按钮可用）。
- 但**可见性断裂构成实质性功能缺陷**：blocking 级（如 missing-media）时真实用户点导出→毫无反馈，等价"导出坏了"；**warning 级（如帧率不匹配）同样静默拦截**——必须手动切到 export 步点 continue 才能继续，普通用户无从知晓。这不是纯打磨。
- warmup 缺反馈相对偏 UX（导出其实在进行），但同一处修改可一并覆盖。

### 4.4 若修（供决策，本轮不动手）

- **方案 A（产品侧，推荐）**：在 addToQueue 的 4 条 preflight 分支 setPreflight 前/后加 `setCurrentStep('export')`，并在 `warmupSelectedJobs` 前同样切步；可选顺带补齐 batch 模式入队成功后的切步一致性。改动 ~5-8 行、单文件（useExportActions.ts），影响面 = 导出对话框交互流（与既有"成功自动切步"先例一致）；spec 侧可同步移除 export.spec:215 / export-warmup.spec:4 的手动切步（workaround 变冗余但保留也无害），**timecode-project-settings:4 无需改 spec 直接转绿**。工作量 S（~1h + 一轮相关 spec 验证 + vitest export 相关）。
- **方案 B（spec 侧）**：只给 timecode-project-settings:23 前加一行切步。1 行、零产品风险，但真实用户的静默拦截问题原样保留。

## 5. 建议（不替用户决策）

1. 本轮产出的决策材料：§3.3 与 §4.4 各两套方案+影响面+工作量，请用户决定下一轮是否排期、走产品侧还是 spec 侧。
2. 移除/重构簇 52 个仍需产品一次性决策（功能下线 or 重接），与 08-06/08-07 各轮结论一致。
3. 值断言/时间线语义 16 个需工程核对"新输出是否正确"再决定改断言还是修代码。
4. 面板导航长尾 24 个是低风险批量 spec 工作，可在上述两项决策后随手清理。
5. flaky 池已清零，后续对比基线可直接用单次全量（w1/w2 任选），不再需要双跑互证。

# issue #114 本轮落地报告：任务一（两处真实回归已修）+ 任务二（导航类逐例探针重分类）

- 日期：2026-08-07
- 分支：`fix/114-dev-perf-overlay-render-loop`
- 依据：`docs/audit/2026-08-06-e2e-baseline-and-cluster-reclassification.md`
- 全程未改 playwright.config.ts / CI workflow；任务二只按规则做探针验证，未为凑数硬改 spec。

## 任务一：两处真实行为回归（已修，单 commit）

**commit `a1ed037a` — fix(desktop): 修复两处真实行为回归 (issue #114 任务一)**

### 1a. NVENC 硬件编码 preset 被 x264 速度档覆盖（export.spec:175）
- **判定：产品代码回归，spec 断言正确**，故修代码而非改断言。
- 依据：NVENC 合法 preset 为 `p1-p7`，`veryslow` 是 x264 CPU 档位，对 h264_nvenc 非法；代码自身在 `buildVideoEncodingArgs` 简单路径也硬编码 `-preset p4`（utils.ts:43），说明 p4 才是预期的 NVENC preset；spec 期望 `['-c:v','h264_nvenc','-preset','p4','-cq','23']` 正确。
- 根因：`applySchedulerDecision`（export-scheduler.ts）只凭 `decision.useHardwareAcceleration` 判断（调度配置 `getRecommendedExportConfig` 恒返回 `hardwareAccelerationEnabled:false`，未感知用户在导出设置里开启的硬件编码），于是把 x264 速度档 `veryslow` 和 `-crf` 覆盖到硬件编码器参数上。
- 修复：`applySchedulerDecision` 同时检测计划里 `-c:v` 的实际编码器（`isHardwareEncoderArgs`），硬件编码时保留自身 preset、移除 CRF（主路径 + 多 pass）。新增 `export-scheduler.test.ts` 用例（复现 `useHardwareAcceleration:false` + `-c:v h264_nvenc` 的真实场景）。
- 验证：单测 30 过；export.spec:175 本地通过（3.9s），全量终跑中 ok（4.3s）。

### 1b. 场景检测点击无反应（scene-detection.spec）
- **判定：产品代码回归（无限 effect 循环），非缺 handler、非 spec 问题**。
- 定位过程：Tools 菜单项存在且 enabled（canOpenSceneDetection 为 true），`onOpenSceneDetection → setSceneDetectionRequestId(id+1) → useTimelineState effect → handlerRefs.current.openSceneDetection` 整条链路其实已接线（useTimelineHandlers.ts:152 有赋值）。加临时日志探针发现：该 effect **被反复触发上百次**（`sceneDetectionRequestId:1, hasHandler:true`），但对话框始终不渲染。
- 根因：effect 依赖 `[sceneDetectionRequestId, selectedClipId, selectedChipIds]`，而 `openSceneDetection` 内调用 `setSelectedClipId(clip.id)` 触发选择状态变化 → effect 重触发 → 再调 openSceneDetection → 无限循环，`setSceneDialog` 无法稳定提交。
- 修复：加幂等守卫 `lastSceneDetectionRequestIdRef`，同一 requestId 只处理一次，阻断循环。
- 验证：scene-detection.spec 本地通过（9.2s），全量终跑中 ok（2.6s）。临时调试日志已移除。

> 说明：1b 不是"缺一个 handler"的局部问题，而是选择状态联动引发的 effect 循环；用幂等守卫这一局部、明确的手段阻断，未做更大范围的状态管理重构。

## 任务二：C/E/F 导航类逐例探针重分类

**重要结论：重分类文档把"入口/导航重构"估计得偏乐观。逐例探针 + 代码核对后发现，C/E/F 的多数失败并非"补导航就能过"，而是功能被移除/组件被重构（目标 testid 已不存在），或导出步骤按钮根本没有 testid（任务二只改 spec、不能给产品加 testid，无法稳健导航）。** 按你给的规则（目标元素不存在/testid 对不上 → 不算导航重构 → 记为疑似真实回归、不硬改 spec），本轮**不提交任务二 spec 改动**，改为如实记录。

### 探针证据（逐簇）

**簇 C（ExportDialog）**
- `export-pipeline.spec:4`：spec 点击 `export-mode-pipeline-tab`（存在）后断言 `export-pipeline-tab` 可见，但**全仓无 `export-pipeline-tab`/`export-pipeline-create-*`/`export-pipeline-node*` 任何 testid**——pipeline 编辑器 UI 已整体移除，仅剩 mode tab。→ **功能移除**，非导航。
- `export.spec:3/105`、`color-management-export:4/24`：依赖 `fillBatchPaths` → `export-batch-paths` textarea，**该控件已无渲染**（batchOutputPaths 仅剩 state，useExportActions.ts:819 使用）。→ **功能移除**。
- `codec-compare-export:4`：`export-codec-compare-preset-*` 预设勾选 **全仓无**。→ **功能移除**。
- `export.spec:3/79/133`（`export-max-concurrent-select`）：控件存在，但已移到"导出"步（ExportProgress.tsx:86）；spec 在"配置"步操作。导出对话框步骤按钮（配置/预览/导出/完成）**无 testid、仅文本**（探针 dump 证实），任务二只改 spec、不能给步骤按钮加 testid，只能用脆弱文本点击。→ **步骤重构，但缺可稳定定位的 testid，本轮不硬改**。
- `export-quality:4`、`post-export-script:4`（`export-history-entry`）、`export-preview-sampling:4`、`export-recovery:4`、`nested-sequence-export:67`、`export.spec:215`：目标 testid 均存在（分别在 完成/预览/导出 步或条件渲染），同样卡在"步骤按钮无 testid"。→ 同上。

**簇 E（Inspector/PreviewCanvas 面板）**
- `super-resolution:4`：组件 `SuperResolutionPreview` 现存 testid 仅 `sr-apply-btn/sr-model-select/sr-preview-canvas/sr-process-btn`；spec 断言的 `sr-preview-container/sr-factor-2/sr-factor-4/sr-denoise/sr-sharpen` **全部不存在**——组件被重构。→ **组件重构/疑似回归**，非导航。
- `multi-device-sync`（10）、`collaboration`（7，协作调色）、`team-management`（6）：对应面板组件/入口在现代码**无渲染路径或无 testid**（EditorShell 仅剩 collaborationNotes）。→ **功能移除**，需产品确认。
- 其余面板类（smart-rough-cut、dubbing、cover-frames、lut-editor、frame-inspector、media-organizer、release-workflow 等）：目标 testid 存在，但打开路径依赖工具栏按钮/e2e fixture，且部分与 scene-detection 同属"点击后状态联动"问题，需逐例深挖；本轮未逐一验证其可达性，**不硬改**。

**簇 F（plugin-marketplace）**
- `openPluginMarket`（toolbar-settings-button → settings-tab-plugins）导航本身正确；新面板 `PluginsSettingsPanel` 用 `plugin-market-list/plugin-market-card/plugin-market-install-button/plugin-market-refresh-button` 等**新 testid**。
- 但 spec 断言的 `plugin-market-category`、`plugin-market-sort`（分类/排序筛选）在新面板**不存在**。→ 11 条中约 3 条（分类/排序）**功能移除**，其余为 testid 改名，但需整体映射新面板结构并验证 mock 目录加载，本轮不硬改。

### 任务二"疑似真实回归/移除"清单（本轮最重要产出）
1. **导出 pipeline 编辑器整体移除**（export-pipeline.spec 依赖的 create/node/status UI 全无）。
2. **导出 batch-paths 多路径输入移除**（export.spec:3/105、color-management-export:4/24）。
3. **codec-compare 预设勾选移除**（codec-compare-export:4）。
4. **super-resolution 控件重构**（factor/denoise/sharpen/container testid 消失）。
5. **多设备同步 / 协作调色 / 团队管理面板移除或未接线**（23 条）。
6. **plugin-marketplace 分类/排序筛选移除**（约 3 条）。
7. **导出对话框步骤化后步骤按钮无 testid**（阻碍稳健 spec 导航；属产品代码可改进项，非本轮范围）。
8. （已在任务一修复）scene-detection effect 无限循环、NVENC preset 覆盖。

## 最终全量结果与对比

| 运行 | 并发 | 通过 | 失败 | 说明 |
|---|---|---|---|---|
| 本轮开始（full-suite-r3） | workers=2 | 398 | 149 | 任务一修复前 |
| 本轮结束（full-w1-final） | workers=1 | 381 | 166 | 任务一修复后 |

- **任务一两处已确认转绿**：export.spec:175（NVENC）、scene-detection.spec:4 在终跑均 ok（此前均失败）。
- **并发数混淆**：workers=1 失败数（166）反而高于 workers=2（149），说明该套件对并发/时序敏感，跨并发直接对比通过数会被混淆；任务一的净收益应以"这两个用例由红转绿"为准，而非总数差。
- 剩余失败分布（workers=1 终跑头部）：plugin-marketplace 11、multi-device-sync 10、collaboration 7、team-management 6、export.spec 6、auto-generate 4、timeline-advanced-tools/subtitles/smart-rough-cut/smart-distribution/color-management-export/color-grading-audio 各 3，其余为 1-2 的长尾。主体即上面"移除/重构"清单 + 既有的负载 flaky/时间线断言类。

## 提交清单
- `a1ed037a` fix(desktop): 修复两处真实行为回归 (issue #114 任务一)（export-scheduler.ts + export-scheduler.test.ts + useTimelineState.ts）
- 任务二：未提交 spec 改动（按规则，探针证实多为移除/重构、非可稳健修复的导航，未硬改）。

## 建议（不替你决策）
1. 任务二清单 1-6 属"功能移除/重构"，需**产品**确认：这些功能是下线了，还是要恢复入口/补 testid。
2. 清单 7（导出步骤按钮无 testid）建议下一轮允许在产品代码补 `data-testid`，之后 C 簇步骤导航类 spec 才能稳健修复。
3. 负载 flaky 与并发敏感仍未解决：建议先稳定 dev-server 冷启动/并发或引入重试策略，再做下一轮 spec 修复，否则通过数会继续随并发波动。

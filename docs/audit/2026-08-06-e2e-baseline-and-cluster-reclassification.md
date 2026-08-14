# E2E 干净基线 + 簇 A/C/E/F 重新定性

- 日期：2026-08-06
- 性质：**只读诊断。未改任何 spec/产品代码/playwright.config/CI；未提交、未 push、未切分支（全程 `fix/114-dev-perf-overlay-render-loop`）**。
- 数据源：
  - workers=2 全量失败清单：`/tmp/e2e-diag/full-suite-r3.log`（149 失败，`w2-failed.txt`）。
  - workers=1 隔离重跑（覆盖全部 92 个失败 spec 文件、149 个失败用例，无抽样）：`/tmp/e2e-diag/iso-w1.log`（139 失败 / 84 通过 / 35.4m）。
  - 对照脚本：`compare2.cjs`，产出 `det.txt`（确定性）/ `flaky.txt`（负载）。
  - 可达性探针：`probe-scene.cjs` / `probe-scene2.cjs`（只读驱动页面，不改 spec）。

## 任务一：干净失败基线（workers=1 vs workers=2）

### 结果

| 项 | 数量 |
|---|---|
| workers=2 失败总数 | 149 |
| **确定性 drift**（w2 失败 且 w1 隔离仍失败） | **135** |
| **负载 flaky**（w2 失败、w1 隔离通过） | **14** |
| 未在 w1 覆盖到 | 0（149 全覆盖） |

结论：上一轮 149 里有 **14 个是负载敏感**（并发下 dev-server 变慢撞 10s timeout），隔离即过；**135 个是确定性 drift**。后续所有定性只针对这 135 个。

### 负载 flaky 清单（14，隔离通过）

audio-envelope:4 · automation-workflow:78 · batch-keyframes:50 · content-analysis:4 · data-subtitles:32 · export-confidence:17 · media-replace:4 · performance-profiler:4 · professional-color-grading:54 · project-snapshots:64 · proxy-batch-verify:4 · timeline-feedback:6 · timeline-snapping:18 · undo-tree:4

处置建议：不属于 drift，归入"并发/负载"问题（簇 B），靠降并发、提速 dev-server 或放宽这类等待解决，不需要改 spec 逻辑。

### 确定性失败总数

**135**（完整清单 `/tmp/e2e-diag/det.txt`）。

## 任务二：簇 A/C/E/F 逐用例定性

分类口径：
- **移除**：组件/入口在当前代码无渲染路径（grep 全仓找不到挂载点）。
- **重构**：功能还在，但需先导航/切 tab/进展骤才可见（附新触达路径）。
- **回归**：功能应在但接线/状态有 bug（附证据）。
- 可达性已验证 = 用只读探针实际走通/证伪了导航路径。

### 簇 A —— Tools 菜单（24 个）：**全部"移除"**

证据（grep，均无渲染路径/testid）：
- `MultiDeviceSyncPanel`：组件存在（components/Sync/MultiDeviceSyncPanel.tsx）但**无任何 import/渲染方**（grep 除自身与 .test 外为空），且组件内**无 data-testid**。→ 面板未接线。
- `TeamManagement`/团队成员面板：components、store 中**无此组件**。
- 协作调色：`collaboration-panel`/`collab-session-*` testid 全仓**不存在**；EditorShell 只有 `collaborationNotesOpen`（协作笔记，另一功能，ToolsMenu.tsx:178）。
- `sync-panel` 唯一命中是 subtitle-sync-monitor/SubtitleSyncPanel.tsx:55（字幕同步，非多设备同步）。

| 用例 | 分类 | 证据 |
|---|---|---|
| multi-device-sync.spec.ts:15/27/40/54/75/90/129/147/165/179（10） | 移除 | MultiDeviceSyncPanel 无渲染方、无 testid |
| collaboration.spec.ts:14/28/45/69/107/128/174（7） | 移除 | collab-panel testid 不存在，仅剩协作笔记 |
| collaboration-permissions.spec.ts:4（1） | 移除 | 同上（协作面板不存在） |
| team-management.spec.ts:15/27/104/126/144/159（6） | 移除 | TeamManagement 组件不存在 |

决策：需**产品**确认——这些功能是下线了，还是入口要重接。工程无法仅凭改 spec 修复。

### 簇 C —— ExportDialog（19 个）：混合（移除/改名重构/步骤导航/行为）

背景：导出对话框已重构为"模式 tabs（single/version-batch/sequence-batch/codec-compare/pipeline/stem，testid `export-mode-*-tab`，ExportConfig.tsx:239）+ 步骤向导（config/preview/export/complete）"。

| 用例 | 失败定位 | 分类 | 证据/新路径 |
|---|---|---|---|
| codec-compare-export:4 | export-codec-compare-preset-web-1080p | 移除 | codec-compare 预设勾选 UI 全仓无（仅 mode tab 存在） |
| color-management-export:4/24（2） | export-batch-paths（fill） | 移除 | batch-paths textarea 无渲染（batchOutputPaths 仅剩 state，useExportActions.ts:819 使用） |
| export.spec:105 | export-batch-paths（fill） | 移除 | 同上 |
| export-pipeline:4 | export-pipeline-tab | 改名/重构 | 现为 `export-mode-pipeline-tab`（ExportConfig.tsx:239） |
| export-preview-sampling:4 | export-preview-button（click timeout） | 步骤导航 | 在 preview 步（ExportPreview.tsx:42），需先切 preview 步 |
| export-quality:4 / post-export-script:4 | export-history-entry | 步骤导航 | 在 complete 步（ExportHistory.tsx:36） |
| export-quality:24 | post-export-quality-result | 步骤导航/条件 | 历史/结果面板，complete 步 |
| export-recovery:4 | export-recovery-report | 步骤导航/条件 | PostExportStatusPanels.tsx:57 |
| export-upload-status（export.spec 内）/ export.spec:215 | export-preflight-panel | 条件 | PreflightPanel.tsx:22，仅 preflight 有问题时出现 |
| nested-sequence-export:67 | export-sequence-batch-row | 步骤导航 | SequenceBatchSection.tsx:78，需 sequence-batch 模式 |
| export.spec:3/79/133（3） | export-max-concurrent-select（selectOption timeout） | 步骤导航 | 控件在 export 步（ExportProgress.tsx:86），spec 在 config 步操作 → 需切步；可达性已由 adjustment-layer 修复（入队后自动跳 export 步）间接证明 |
| export.spec:175 | NVENC toEqual | 真实行为/值 | 硬编检测输出变化，需工程核对（属簇 G 性质） |
| export-upload:4 / export.spec:191 / color-management-export:45 | media-card add-to-timeline（click timeout） | media 导入流程 | 非导出对话框问题；确定性失败，需单独查 media 导入（跨簇） |

小结：移除 4、改名/步骤导航 11、行为值 1、media 导入流程 3。可达性：**export 步导航已被 adjustment-layer（已绿）证明可达**；preview/complete/sequence-batch 步未逐一手动验证。

### 簇 E —— Inspector/PreviewCanvas 面板（30 个）：移除/改名 7，导航/接线 12，其余混合

testid 存在性（grep 全仓计数）：
- **不存在（移除/改名，7）**：assist-preset-quick-cut、cg-tab-subtitle、qa-profile-broadcast、smart-scene-button、smart-rough-cut-tab-dialogue、video-restoration-section、quality-enhancement-section。
- **存在（导航/可达性/接线，12）**：beat-sync-checkbox、cover-frame-option、dubbing-analyze-btn、frame-inspector-popover、lut-editor-export-button、media-organizer-remove-selected-button、release-publish-button、scene-detect-dialog、smart-rough-cut-panel、sr-apply-btn、frame-interpolation-quality-status、frame-search-input。

可达性已验证（探针）：
- **scene-detection:4**：`toolbar-tools-scene-detection-menu-item` 存在且在"选中 video clip"时**enabled**（canOpenSceneDetection，useEditorShellDerivedState.ts:107），但**点击后 scene-detect-dialog 不出现**（probe-scene2：menu enabled、click 后 dialog count=0）。→ 不是"补导航就过"，是**接线/打开逻辑回归**，需工程查 onOpenSceneDetection → dialog 渲染条件。

| 用例 | 失败定位 | 分类 | 证据 |
|---|---|---|---|
| assist-editing:4 | assist-preset-quick-cut | 移除/改名 | testid 全仓无 |
| content-generation:4 | cg-tab-subtitle | 移除/改名 | testid 全仓无 |
| quality-assessment:4 | qa-profile-broadcast | 移除/改名 | testid 全仓无 |
| smart-rough-cut:35 | smart-scene-button | 移除/改名 | testid 全仓无 |
| smart-rough-cut:62 | smart-rough-cut-tab-dialogue | 移除/改名 | testid 全仓无 |
| video-restoration-export:4 | video-restoration-section | 移除/改名 | testid 全仓无 |
| video-restoration-export:23 | quality-enhancement-section | 移除/改名 | testid 全仓无 |
| scene-detection:4 | scene-detect-dialog | **回归（接线）** | 菜单 enabled 但点击不开 dialog（探针证实） |
| auto-generate:68 / cover-frames:4 / dubbing:4,47 / frame-inspector:4 / lut-editor:4 / media-organizer:4 / release-workflow:4 / smart-rough-cut:4 / super-resolution:4 / frame-interpolation:36 / frame-search:4 | 对应存在 testid | 导航/可达性 | testid 存在，面板需先打开；未逐一手动验证可达性 |
| ai-content-tags:4 / ai-quality-assessment:4 / auto-generate:17,36 / smart-distribution:58,89 / macro-recording:4 / preflight-checklist:55 / publish-pipeline:4 / proxy-auto:4 | 各自定位 | 混合（导航/media 流程/值） | 需逐例核查，部分含 media-card 等待 |

### 簇 F —— plugin-marketplace（13 个）：市场移入 Settings→Plugins，testid 改名

证据：市场 UI 已并入 `settings/PluginsSettingsPanel.tsx`，新 testid：`plugin-market-list`（原 panel）、`plugin-market-card`（原 plugin-card-*）、`plugin-market-install-button`（原 plugin-install-*）、`plugin-market-refresh-button`、`plugin-list-item`/`plugin-toggle-button`/`plugin-uninstall-button`（原 installed-plugin-*）。旧独立市场面板 testid（plugin-market-panel/category/sort）不存在。

| 用例 | 分类 | 证据 |
|---|---|---|
| plugin-marketplace:118/198/226/252/274/289/316/340（8） | 重构（入口移入 Settings→Plugins + testid 改名） | PluginsSettingsPanel.tsx 新 testid |
| plugin-marketplace:142/163/179（3） | 移除/待核 | plugin-market-category/sort testid 全仓无（分类/排序筛选疑被移除） |
| plugins.spec:39/93（2） | 重构/待核 | 含 media-card 等待与插件列表，需逐例 |

可达性：未手动验证（市场在 Settings→Plugins 内，需打开设置面板）。改 spec 补导航 + 换 testid 有较大概率转绿，但 category/sort 3 条若功能已删则需产品确认。

## 汇总

| 分类 | 数量（A/C/E/F 内，约） | 决策归属 | 风险 |
|---|---|---|---|
| 移除 | A 24 + C 4 + E 7 + F 3 ≈ **38** | **产品**（功能是否下线/重接） | 高，不可仅改 spec |
| 入口/导航重构 | C 11 + E 12 + F 8 ≈ **31** | **可直接改 spec 补导航/换 testid** | 中（部分可达性未逐一验证） |
| 真实行为回归 | C 1（NVENC）+ E 1（scene 接线）≈ **2** | **工程**判断可直接修 | 中 |
| media 导入流程（跨簇） | C 3 + E 若干 ≈ **5+** | 需单独查 media 导入 | 中 |
| 负载 flaky（任务一，非 A/C/E/F） | **14** | 并发/负载策略 | 低（不改 spec） |

### 既非移除/重构/回归的独立项（不硬塞三类）
- **export.spec:175（NVENC toEqual）**、**subtitles/clip-transition 等值断言**：属"行为/输出变化"，需工程核对新输出是否正确（簇 G 性质），不是 UI 定位问题。
- **export-upload:4 / export.spec:191 / color-management-export:45 / proxy-auto:4** 等卡在 `media-card add-to-timeline`：是 media 导入确定性问题，跨多个"簇"，应独立成一类排查。
- **scene-detection:4**：菜单可达但 dialog 不开——接线回归，非导航补 spec 能解决。

## 建议（不替你决策）
1. 先把 **14 个负载 flaky** 与 drift 分离（降并发或提速 dev-server 复跑确认），避免继续污染基线。
2. **移除类（~38）**：打包问产品"这些功能下线了吗 / 入口要不要重接"，一次性决策。
3. **导航重构类（~31）**：可按面板批量改 spec 补导航 + 换 testid；动手前对每条先做可达性探针（本轮已示范 scene-detection 的反例：可达 ≠ 能打开）。
4. **回归类（NVENC、scene 接线）**：工程直接查代码修。
5. media 导入流程单独立项排查（影响跨簇多条）。

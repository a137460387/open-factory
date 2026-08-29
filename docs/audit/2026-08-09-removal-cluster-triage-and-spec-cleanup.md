# 移除类簇逐例核实与 spec 清理（issue #114 衍生收尾）

- 日期：2026-08-09
- 分支：`main`（HEAD 起点 99239fd6，本轮 3 个本地提交 c72f6bff / be71b4ca / dd2cba1a，未 push）
- 性质：**只删测试 spec，未碰任何产品代码、playwright.config.ts、CI workflow。**
- 原始证据落盘：
  - 删除前全量日志 `docs/evidence/e2e-baseline-2026-08-09-before-removal-w2.log`（454 passed / 89 failed，26.0m，workers=2）
  - 删除后全量日志 `docs/evidence/e2e-baseline-2026-08-09-after-removal-w2.log`（454 passed / 68 failed，24.1m）
  - 批次验证日志 `/d/tmp/plugin-after-delete.log`（plugin-marketplace 剩余 6 用例实跑）
  - 失败清单 `/d/tmp/failed-final.txt`（89 条）/ `/d/tmp/failed-after.txt`（68 条）

## 0. 状态恢复与基线校准

1. 分支 main、工作区干净（仅未跟踪审计文档）、HEAD = 99239fd6（#118 squash），四个 PR（#112/#116/#117/#118）均已合入 —— 与提示词一致。
2. **本轮实测基线 454/89（543 池）**。提示词引用的 446/97 是 #118 合并轮的数字；本轮同条件（workers=2）实测多了 8 个通过。差异未深挖（未出现新失败签名，89 失败清单与 08-08 审计的 100 清单相比的变化全部可归因于既有簇），如实记录。
3. 审计文档中"移除类簇 52"的原始记录：
   - `2026-08-08-e2e-baseline-and-two-shelved-issues-diagnosis.md` §2（52 个，含构成明细）；
   - `2026-08-06-e2e-baseline-and-cluster-reclassification.md`（簇 A/C/E/F 定性，口径：移除 = 组件/入口无渲染路径）。
4. **本轮实测移除簇候选 = 53 个失败用例**，与旧记录 52 的差异构成：
   - −1：`collaboration-permissions.spec.ts:4` 本轮**已通过**（不在失败清单）；
   - +2：`smart-rough-cut.spec.ts:4`（旧清单只有 :35/:62）与 `export.spec.ts:105`（仍在失败，但失败点仍是 batch-paths helper，见 §2.6）。

## 1. 逐簇诊断结论总表

判断口径（提示词给定）：**确认移除** = 功能痕迹全无，或组件文件在但从未被引用/挂载；**疑似重构误判** = 功能代码存活、入口/testid 变了；**不确定** = 功能代码存在但明显半成品/未接线，无法自行判断。

| 簇 | 实测用例数 | 结论 | 依据摘要 |
|---|---|---|---|
| multi-device-sync | 10 | **确认移除** | MultiDeviceSyncPanel.tsx 存在但全仓无 import/渲染方（仅自身+配套单测引用）；组件内 0 个 data-testid；spec 全部 sync-\* testid 全仓 0 命中；ToolsMenu 无 sync 菜单项（155-210 行全量核对）。editor-core 的 multi-device-sync.ts 纯逻辑仍在但无 UI 接线。 |
| team-management | 6 | **确认移除** | TeamManagement/team-member/teamInvite 等组件与状态关键字在 apps/desktop/src、packages/editor-core/src 全部 0 命中；全部 testid 0 命中；ToolsMenu 无入口。 |
| plugin-marketplace | 11 | **拆分：5 确认移除 + 6 重构误判** | 市场 UI 现位于 Settings→Plugins（PluginsSettingsPanel.tsx，settings-tab-plugins 存活）。见 §2.4。 |
| collaboration | 7 | **疑似重构误判（功能重构，非纯移除）** | 协作能力重构为"本地协同编辑"：GeneralSettingsPanel.tsx:361 settings-local-coediting-\* 设置 UI 存活、local-network.ts 控制器被 commandManager.ts 与 settings.ts 引用、timeline 读取协作锁/用户（useTimelineState.ts:294-297）。旧协作会话面板 UI（collab-\* testid）整体移除、simulateCollab\* e2e actions 也已删除。见 §3.1。 |
| color-management-export | 3 | **疑似重构误判** | 色彩管理导出链路完整存活（export-color-management-summary/export-output-color-space-select/project-color-pipeline-select 各 1 命中）；仅输出路径控件由 export-batch-paths 改名为 export-output-path（ExportConfig.tsx:215）。见 §3.2。 |
| codec-compare-export | 1 | **不确定（半成品接线）** | mode tab（动态 testid export-mode-codec-compare-tab）与入队逻辑存活（useExportActions.ts:770），但预设勾选 UI 与结果 UI（export-codec-compare-preset-\*/results/ssim/recommend-button）全仓 0 命中，codecComparePresetIds/codecCompareResults 状态无任何 tsx 消费方。见 §4.1。 |
| export-pipeline | 1 | **不确定（半成品接线）** | mode tab 与 runPipeline() 存活（useExportActions.ts:737/873），但 pipeline 节点编辑器 UI（export-pipeline-node/create-two-node/node-status）0 命中，pipelineConfig/pipelineStatuses 无 tsx 消费方。见 §4.2。 |
| publish-pipeline | 1 | **不确定（半成品接线）** | 同上：publish runner 存活（publish-pipeline-runner.ts、runPipelineUtilityNode），但 export-pipeline-create-publish/export-publish-log(-list) 0 命中，publishPipelineLogs 无 tsx 消费方。 |
| super-resolution | 1 | **疑似重构误判（fixture drift）** | SuperResolutionPreview.tsx 存活且 sr-preview-canvas/sr-factor-\*/sr-model-select/sr-denoise/sr-sharpen/sr-process-btn 齐全；失败点 sr-apply-btn 仅在 `onApply` prop 存在时渲染（组件 :464 条件渲染），fixture（install-mocks.ts:7184）挂载方式与组件契约漂移。组件在产品 UI 无挂载方，纯 fixture 驱动测试。 |
| assist-editing | 1 | **疑似重构误判（整体改名）** | AssistEditingPanel.tsx 存活且被 ShellRightPanel 引用，ToolsMenu 有入口；testid 整体改名 assist-preset-\* → assist-editing-preset-{id}、assist-config-\* → assist-editing-min/max-duration、assist-generate-btn → assist-editing-generate。 |
| content-generation | 1 | **疑似重构误判（整体改名）** | ContentGenerationPanel.tsx 存活；cg-tab-\* → content-gen-tab-\*（dubbing 改为 content-gen-tab-tts）、cg-music-\* → content-gen-music-\*。 |
| quality-assessment | 1 | **疑似重构误判（整体改名）** | QualityAssessmentPanel.tsx 存活；qa-profile-\* → quality-profile-{broadcast,web,social,cinema}、qa-assess-btn → quality-assess。 |
| video-restoration-export | 2 | **疑似重构误判** | EffectPanel.tsx 内控件存活（video-restoration-temporal-preset :332、quality-enhancement-deblock-toggle :175）；仅区域容器 testid（video-restoration-section/quality-enhancement-section）不存在（Section 包装 div 无 testid）。 |
| smart-rough-cut | 3（:4/:35/:62） | **疑似重构误判（UI 重构为 orchestrator）** | 旧 SmartRoughCutPanel.tsx 文件仍在（含旧 testid 模式）但从未被渲染（ShellRightPanel 仅 lazy 声明、无 JSX 使用）；同目录 SmartRoughCutOrchestratorPanel.tsx 承接功能（场景检测 detectSceneChanges、对话检测 detectClipDialogue、suggestions 应用流）并在 ShellRightPanel.tsx:291 渲染。 |
| color-grading-audio（调色部分） | 3（:26/:33/:41） | **疑似重构误判（结构重构）** | Inspector Section 由可折叠 details/summary 重构为静态 `<section>`+`<h2>`（InspectorFields.tsx:22），spec beforeEach 的 `locator('summary', 调色)` 无命中；调色功能存活（EffectPanel.tsx:226 Section 调色 → ColorGradingWorkspace :227，且 workspace 经 EffectPanel 挂载可达）。 |
| export.spec:105（scheduled export） | 1 | **疑似重构误判** | 定时导出能力存活；失败点是 exportDialog.fillBatchPaths → safeFill('export-batch-paths')（export-dialog.page.ts:58），同 §3.2 的改名问题。注意 :3/:79/:133 失败点不同（selectOption export-max-concurrent-select，属步骤导航类，不在移除簇）。 |
| collaboration-permissions | 0（本轮通过） | 无需处理 | 权限能力以 settings-local-coediting-permission（read-only/edit）形式存活于 GeneralSettingsPanel.tsx:396；spec 内 collab tab 断言本就是条件式。本轮未失败，不动。 |

**合计**：53 = 21 确认移除 + 29 疑似重构误判 + 3 不确定。

## 2. 确认移除部分的执行（本轮唯一动代码的部分，均为删 spec）

### 2.1 批次 A — commit c72f6bff

删除 `apps/desktop/e2e/multi-device-sync.spec.ts` 整文件（10 用例）。判断依据见 §1；删除前独立核实文件存在、10 个 test block 全部指向同一未接线功能。

### 2.2 批次 B — commit be71b4ca

删除 `apps/desktop/e2e/team-management.spec.ts` 整文件（6 用例）。

### 2.3 批次 C — commit dd2cba1a

删除 `apps/desktop/e2e/plugin-marketplace.spec.ts` 内 5 个 test block（-108 行）：

| 原行号 | 用例 | 被删理由（当前面板实现逐项核对） |
|---|---|---|
| :118 | 显示市场插件列表并支持文本搜索 | 面板无搜索框、无过滤逻辑（catalogEntries 直接全量渲染）；搜索是该用例主考点 |
| :142 | 支持按分类筛选插件 | plugin-market-category 全仓 0 命中，面板无分类筛选 |
| :163 | 支持按排序方式切换 | plugin-market-sort 0 命中，面板无排序 |
| :179 | 分类标签芯片显示计数并可点击切换 | 面板无分类芯片渲染 |
| :198 | 点击插件卡片打开详情弹窗 | plugin-detail-dialog 0 命中，面板卡片无点击打开弹窗逻辑 |

### 2.4 保留未删的 plugin-marketplace 6 用例（改名类）

:226 SHA-256 安装、:252 SHA 拒绝、:274 启用切换、:289 禁用后钩子、:316 刷新、:340 缓存回退 —— 对应能力均存活（installCatalogPlugin 含 SHA-256 校验 plugin-market.ts:126-163、togglePlugin、onRefreshCatalog、catalog.source='cache' 提示），失败仅因 testid 改名（plugin-install-\* → plugin-market-install-button、installed-plugin-\* → plugin-list-item、plugin-market-refresh → plugin-market-refresh-button）+ 安装确认对话框流程取消（改为 toast）。删除后实跑该 spec：6 失败签名与删除前逐条一致，无新增错误。

## 3. 疑似重构误判清单（只报告，不动代码）

### 3.1 collaboration ×7 —— 需要产品确认新形态的可测性

旧协作面板（会话创建/邀请/用户列表/评论/冲突/锁定 UI）整体移除；协作重构为 settings 驱动的本地协同编辑（host/client 模式、presence、timeline 锁）。**7 个用例中 5 个测旧会话面板、2 个（:69/:107）测"协作+调色"联动**（且调色工作区入口也已从 Tools 菜单移除，现经 Inspector EffectPanel 挂载）。
若要修：不是补导航能解决的，需按新形态重写（开设置启用本地协同 → 验证 presence/锁），工作量 M-L，且需产品确认"本地协同编辑"是否为最终形态、是否要保留 E2E 覆盖。

### 3.2 输出路径改名链（color-management-export ×3 + export.spec:105 + export.spec 多处 fillBatchPaths 调用方）

`export-batch-paths` textarea 移除，单输出路径改为 `export-output-path` input；`batchOutputPaths` state 残留（useExportState.ts:136、useExportActions.ts:825 消费）但无 UI 设置入口。
若要修：单路径用例（color-management-export ×3、scheduled export）把 fill 换成 export-output-path 即可（各 1 行）；多路径用例（export.spec:15/:88/:145/:151 经 fillBatchPaths 传多行路径）需要改走 version-batch/sequence-batch 模式，工作量 M。helper `fillBatchPaths`（export-dialog.page.ts:58）是共同改造点。

### 3.3 AI 三面板整体改名（assist-editing:4 / content-generation:4 / quality-assessment:4）

面板均存活、菜单入口均在（ToolsMenu 有 AI 辅助剪辑/AI 内容生成/AI 质量评估项），fixture actions 存活。纯 testid 批量改名，逐映射：
- assist-preset-{quick-cut,rhythm-match,emotion-driven,content-aware} → assist-editing-preset-{id}；assist-config-min/max-duration → assist-editing-min/max-duration；assist-generate-btn → assist-editing-generate
- cg-tab-{subtitle,dubbing,music,effect} → content-gen-tab-{subtitle,tts,music,effect}；cg-music-genre/mood → content-gen-music-genre/mood
- qa-profile-{broadcast,web,social,cinema} → quality-profile-{id}；qa-assess-btn → quality-assess
若要修：3 个 spec 批量替换 testid，工作量 S（每个 10-15 行）。

### 3.4 video-restoration-export ×2

控件存活，仅 Section 容器无 testid。若要修：spec 去掉容器断言直接操作控件（或产品给 Section 补 testid），工作量 XS。

### 3.5 smart-rough-cut ×3（:4/:35/:62）

功能由 orchestrator 面板承接（工作流/建议/报告三 tab、scene_split/dialogue_extract suggestion、应用流）。旧"一键场景/对话模式"交互不存在。若要修：按 orchestrator 流程重写 3 个用例（运行分析→勾选建议→应用→断言 clip），工作量 M。

### 3.6 color-grading-audio ×3（:26/:33/:41）

Inspector Section 改为静态常开。若要修：删除 beforeEach 的 summary 点击（1 行），工作量 XS。音频部分（:69-101）本轮全部通过。

### 3.7 super-resolution:4

sr-apply-btn 条件渲染（需 onApply prop）。若要修：fixture 挂载时传 onApply，或 spec 改断言 sr-process-btn 完成态，工作量 XS。注意该组件在产品 UI 无挂载点（仅 fixture 驱动），是否保留覆盖可由产品定。

## 4. 不确定清单（只报告，交给用户决策）

### 4.1 codec-compare-export:4

codec-compare **模式 tab、入队逻辑、核心算法**（buildCodecCompareJobs/SSIM/PSNR/推荐）全部存活，但**预设选择 UI 与结果展示 UI 在整个代码库无任何组件消费**。用户无法从界面选择预设（入队会抛 selectAtLeastTwo）。
需要用户判断：这是**计划中的功能、UI 尚未接线**（→ 保留 spec，后续接 UI 后转绿），还是**已放弃的功能、只剩残留逻辑**（→ 连同 spec 一起清理）？

### 4.2 export-pipeline:4 / publish-pipeline:4

同上模式：pipeline 模式 tab + runPipeline runner（含拓扑排序、publish 节点、SMTP 邮件 mock 链路）存活，但**节点编辑器 UI 与节点状态/发布日志 UI 无任何组件消费**。
需要用户判断：导出流水线/发布流水线是否仍在产品路线上？若在，UI 接线是独立任务；若不在，这 2 个 spec 与残留 runner 逻辑一并列入清理。

### 4.3 决策所需信息

- codec-compare、export-pipeline、publish-pipeline 三项在 roadmap.md 中的状态（计划中/搁置/放弃）；
- 本地协同编辑（local coediting）是否为协作功能的最终形态，是否需要 E2E 覆盖（决定 collaboration ×7 的去留）。

## 5. 验证

- typecheck：`bun run typecheck` exit 0。
- `bunx playwright test --list`：543 → 533（批次 A）→ 527（批次 B）→ 522（批次 C），每步差值与删除用例数精确一致，无发现错误。
- 批次 C 后 plugin-marketplace 剩余 6 用例实跑：失败签名与删除前一致（旧 testid 等待超时），无新错误类型。
- 删除后全量（workers=2，24.1m）：**454 passed / 68 failed（522 池）**。
  - 通过数不变（454），失败 89 → 68，恰好 -21；
  - 按用例名归一化逐条差分：新出现失败 **0**，消失失败恰好 **21**（即被删用例）；
  - plugin-marketplace 保留的 6 个改名类用例因文件删减行号位移（226→118 等），失败签名逐条不变；
  - 未出现 "file not found" 或任何新错误类型。

## 6. 与提示词假设的差异（如实报告）

1. 提示词假设"52 个移除类失败用例"，本轮实测候选为 **53**（构成差异见 §0.4），且**其中仅 21 个经得起"确认移除"口径**——08-08 审计把大量"testid 不存在"的用例归入移除簇，但逐例核实后多数是**改名/结构重构**（功能存活）。本轮已全部纠正分类。
2. `export.spec:105` 在 08-06 审计中的定性（batch-paths 移除）对当前 spec 已不完全适用：该测试现为定时导出用例，失败点经 fillBatchPaths helper 仍落在已移除的 batch-paths 控件，本质是改名链（§3.2），不是"定时导出功能被移除"。
3. `collaboration-permissions:4` 本轮通过（08-08 审计时失败），未纳入处理。
4. 提示词列举的簇名中 "batch-paths" 独立簇不存在对应可删 spec（color-management-export 与 export.spec:105 经核实均为误判）；"color-grading-audio" 经核实为结构重构误判。两者均未删。

## 7. 续篇：Push 与改名类修复执行记录（2026-08-09 下午）

### 7.1 任务一：删除 commit 的 push —— 走 PR（main 有分支保护）

`gh api repos/.../branches/main/protection` 实测：`required_pull_request_reviews=true`、`enforce_admins=true`、必需检查 `rust`。**main 不允许直接 push**，按规则改走 PR：

- 分支 `fix/114-removal-cluster-spec-cleanup`（= dd2cba1a，含 c72f6bff/be71b4ca/dd2cba1a 三个删除提交），PR **#119**：https://github.com/a137460387/open-factory/pull/119
- 本轮只开 PR 不合并（按指示）。

### 7.2 任务二/三：改名类修复（§3.3-§3.7 逐项执行，5 个 commit）

映射表执行前已逐项与当前组件代码复核——全部一致（含映射表未列的 `cg-effect-type → content-gen-effect-type`，现场补齐）。

| commit | 内容 | 转绿用例（修复前均失败） |
|---|---|---|
| `ed3a4888` | AI 三面板 spec testid 整体改名（assist-editing-\*/content-gen-\*/quality-\*，含 dubbing tab → content-gen-tab-tts） | assist-editing:4、content-generation:4、quality-assessment:4 |
| `78f91400` | video-restoration-export 容器断言（video-restoration-section/quality-enhancement-section，已无 testid）替换为实际操作控件的可见等待 | video-restoration-export:4/:23 |
| `3dac58ff` | color-grading-audio beforeEach 删除 `summary:has-text(调色)` 点击（Section 已静态常开），文件 7/7 全绿 | color-grading-audio:26/:33/:41 |
| `c91b7f0f` | super-resolution fixture（install-mocks.ts setupSuperResolutionPreviewFixture）补传 no-op onApply——sr-apply-btn 为条件渲染 | super-resolution:4 |
| `15c66a11` | 输出路径改名链：color-management-export ×3 处 fill 与 fillBatchPaths helper 由 export-batch-paths → export-output-path | color-management-export:4/:24/:45、export.spec:105 |

合计 **13 个失败用例转绿**。全程只改 spec 与 e2e fixture（install-mocks.ts 为 e2e 基础设施，非产品代码），未碰产品代码/playwright.config.ts/CI。

### 7.3 验证

- 每类修复后即跑对应子集确认转绿（见各 commit message）；
- 合并子集（7 个改动文件 17 用例）：17 passed，无新失败；
- export.spec 全文实跑核对：export.spec:3/:79/:133 失败签名逐条不变（仍为 `export-max-concurrent-select` selectOption 超时，见 §7.4 说明）；
- typecheck exit 0；
- 删除后全量基线 454/68 → 本轮修复后全量（workers=2，23.2m）：**467 passed / 55 failed（522 池）**；
  - 按用例名归一化差分（对比 89 失败基线）：新出现失败 **0**，消失 **34** = 上轮删除 21 + 本轮转绿 13，逐条吻合，无意外变化；
  - 原始日志 `docs/evidence/e2e-baseline-2026-08-09-after-rename-fixes-w2.log`。

### 7.4 多路径用例（export.spec:3/:79/:133）为何本轮未转路径模式

现场核实与提示词假设的差异：这 3 个用例当前**失败点在 fillBatchPaths 之前**——`setMaxConcurrent` 操作的 `export-max-concurrent-select` 位于 export 步（ExportProgress.tsx:86），spec 在 config 步操作，selectOption 先超时。这是审计 §2 分类中的"导出向导步骤导航类"（非改名类）。version-batch 迁移本身为 M 工作量且依赖切步修复先行，故顺延到步骤导航簇处理轮，本轮仅在 helper JSDoc 注明。versioned-batch-export:4、nested-sequence-export:67 同理（分别卡在 export-max-concurrent-select / export-sequence-batch-row）。

### 7.5 本轮明确未处理清单（避免后续误以为已全部搞定）

**重写类（未动，需先产品确认再重写）**：
- collaboration ×7（:14/:28/:45/:69/:107/:128/:174）——需按"本地协同编辑"新形态重写，前提是确认该形态为最终形态（§3.1），工作量 M-L；
- smart-rough-cut ×3（:4/:35/:62）——需按 orchestrator 流程重写（§3.5），工作量 M。

**3 个不确定项（用户明确表示暂不知道 roadmap，保持现状，不删不修）**：
- codec-compare-export:4（预设/结果 UI 未接线，§4.1）；
- export-pipeline:4、publish-pipeline:4（节点编辑/日志 UI 未接线，§4.2）。

**其它既有簇（本轮范围外，维持原分类）**：
- 步骤导航类：export.spec:3/:79/:133、versioned-batch-export:4、nested-sequence-export:67、timecode-project-settings 等；
- 插件市场改名类 6 例（plugin-marketplace :118/:144/:166/:181/:208/:232 新行号，§2.4）；
- 值断言/时间线语义类、面板长尾类等（见 08-08 审计 §2）。

## 8. 续篇二：#119 合并与改名修复 PR #120（2026-08-09 晚）

### 8.1 #119 合并（merge commit）

- 合并前 CI：rust **pass**（保护规则必需项）；frontend fail = `bun audit --audit-level=high` 依赖漏洞（undici GHSA-4cwx-7wf7-3272、fast-uri GHSA-7p8r-x3mc-p8w7、brace-expansion GHSA-rgw5-rvv9-x895、nanoid 等——失败步骤与失败类别与历轮核实的预存问题一致；具体 advisory 清单随时间累积变化，lockfile 未动、与本 PR 纯删 spec 的 diff 无关）；e2e fail = 两次尝试均 "Timeout of 1200000ms hit"（与历轮预存签名逐字一致）；main 最近 4 次 CI run 全 failure，佐证仓库级预存。
- 合并方式：**merge commit**（不 squash）——3 个 commit 分属 3 个独立功能簇删除，保留各自可单独 revert 的历史形态（与 #117 先例一致）。
- 合并 commit：**36d4302a**。验证：3 个删除 commit 均在 origin/main 历史；multi-device-sync/team-management spec 已不在 origin/main 树；plugin-marketplace.spec.ts 保留（剩 6 用例）。

### 8.2 改名修复 PR #120

- 5 个改名 commit rebase 到 36d4302a：`git diff dd2cba1a origin/main` = 0 行（merge 未改内容）→ `git rebase --onto` **零冲突**；rebase 前后树差异 0 行。
- 新 hash：40c2ac72（AI 三面板）/4efbd41d（video-restoration）/93df2a84（color-grading-audio）/689c2df0（super-resolution fixture）/f8355019（导出路径链），分支 `fix/114-rename-drift-spec-cleanup`。
- **PR #120**：https://github.com/a137460387/open-factory/pull/120 —— 本轮只开不合并。改动面 8 文件（spec×6 + export-dialog.page.ts helper + install-mocks.ts fixture），与 #119 删除的 3 个文件零重叠（实测确认）。
- CI 快照：见轮末报告（rust 预期 pass，frontend/e2e 预期同预存失败）。

### 8.3 累计数字

446/97（#118 后）→ 454/89（08-09 删除前实测）→ 454/68（#119 删除 21）→ **467/55**（本 PR 13 转绿；合并操作本身不改内容，数字不因合并变化）。本地全量日志：`docs/evidence/e2e-baseline-2026-08-09-after-rename-fixes-w2.log`。

### 8.4 #120 合并与收尾（2026-08-09 深夜）

- 合并前 CI：rust **pass**（5m4s）；frontend fail = `bun audit` 预存（与 #119 逐条一致）；e2e fail = 2× "Timeout of 1200000ms hit"（41m24s，与 #119 逐字一致）。无新性质失败。
- 合并方式：**merge commit**（与 #119 先例一致，5 个独立改名修复保留各自可 revert 性）。合并 commit：**2a031c21**。验证：5 个改名 commit 全部在 origin/main 历史。
- 合并后验证：本地 main fast-forward 至 2a031c21；typecheck exit 0；5 类改名涉及的 7 个 spec 文件 17 用例 + export.spec scheduled 用例在最新 main 上全部绿（唯一失败的 ai-quality-assessment:4 为它簇预存，非本系列范围）。
- 分支清理（内容级验证后删除）：
  - fix/114-removal-cluster-spec-cleanup（dd2cba1a）：拓扑祖先 ✓、tip 与 main 差异恰为 #120 的 8 文件改名改动（无内容丢失）✓、其删除的文件在 main 不存在 ✓ → `git branch -d` 删除；
  - fix/114-rename-drift-spec-cleanup（f8355019）：拓扑祖先 ✓、tip 与 main 树差异 0 行 ✓ → 删除。
  - 远程 head 分支（origin/fix/114-removal-cluster-spec-cleanup、origin/fix/114-rename-drift-spec-cleanup）按本系列一贯做法保留（与 origin/114-pr2-core 等已合并 PR 分支同样处理）。
- 至此 issue #114 系列与衍生清理全部收尾：main = 2a031c21，e2e 基线 467/55（522 池）。
5. 全程未 push（3 个本地 commit），未碰产品代码/playwright.config.ts/CI。

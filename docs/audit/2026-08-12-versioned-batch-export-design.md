# versioned-batch-export:4 —— 调研与设计方案

日期：2026-08-12
状态：调研 + 设计方案（本轮零代码改动）
关联：issue #114 剩余唯一失败项

---

## 1. 用例行为规格提取（versioned-batch-export.spec.ts:4，39 行全文）

### 交互/断言序列（精确到步骤与所在 UI 区域）

| # | spec 行为 | 依赖元素 | 元素所在（拆分后） |
|---|---|---|---|
| 1 | `holdExportGate()` | mock 门控（导出任务挂起在 running） | install-mocks |
| 2 | 导入媒体 + 加入时间线 | import-media-button / add-to-timeline | 常规 |
| 3 | `openExportDialog()` | 导出对话框（落在 **config 步**） | ExportDialog shell |
| 4 | 点击 `export-mode-version-batch-tab` | mode tab | ExportConfig（config 步）✓ 现存 |
| 5 | `export-max-concurrent-select`.selectOption('2') | 队列并发数下拉 | **ExportProgress（export 步）** ← 首个卡点 |
| 6 | `export-version-output-template`.fill('C:/Exports/{platform}-{language}.mp4') | 输出模板输入 | ExportVersionBatchSection（未挂载） |
| 7 | `export-version-row` count 2 | 版本行 | ExportVersionBatchSection（未挂载） |
| 8 | `export-version-output-preview` nth(0)/(1) 含 YouTube-zh/TikTok-zh | 行内路径预览 | ExportVersionBatchSection（未挂载） |
| 9 | 点击 `export-enqueue-button` | 入队（shell footer，任何步骤可见） | ExportDialog shell ✓ |
| 10 | task status[0]/[1] = 'running'（15s 超时） | `export-queue-list` 内 `export-task-status` | **ExportProgress（export 步）** |
| 11 | `releaseAllExportGates()` | mock 释放 | install-mocks |
| 12 | task status[0]/[1] = 'success' | 同 #10 | 同 #10 |
| 13 | `export-version-report-row` count 2 | 报告表 | VersionedBatchReportTable（渲染于 ExportVersionBatchSection 内） |
| 14 | `export-version-report` 含 '1920 x 1080' 与 '1080 x 1920' | 报告表分辨率列 | 同 #13 |
| 15 | `export-version-report-size`.first() 含 '4.0 KB' | 报告表大小列 | 同 #13 |
| 16 | `getExportRunCalls`：两个输出路径的 settings 分别为 1920×1080 / 1080×1920 | mock 记录的导出调用 | install-mocks（后端） |
| 17 | `getFileExists` 两个输出文件 | mock 文件 | install-mocks（后端） |

### 跨步序列的精确细节

用例**没有任何显式步骤导航**，但其断言序列隐含了这样的步骤轨迹：
- **#4-#8 在 config 步**（mode tab、模板、版本行）——但 **#5 的 max-concurrent 控件拆分后位于 export 步**，夹在两个 config 步操作之间（#4 之后、#6 之前）；
- **#9 入队后**：warmup 自动切步把对话框带到 export 步，#10/#12 的 task status 断言恰好在 export 步成立；
- **#13-#15 的报告表**渲染在 ExportVersionBatchSection 内（config 步内容）——与 #10/#12 又跨回一步。

即：**config →（#5 需要 export 步控件）→ config → 入队 → export（task status）→（#13 需要 config 步报告）**，单靠"入队后停在某一步"无法同时满足全部断言；拆分前单视图下所有区域同屏，不存在此问题。

### 默认数据与 mock 吻合度（全部核实）

- 默认两行版本（useExportState:60-89）：YouTube/zh 1920×1080（web-1080p）+ TikTok/zh 1080×1920（tiktok），恰为 spec 期望的两行与分辨率；
- 模板 `{platform}-{language}` 展开为 `C:/Exports/YouTube-zh.mp4`/`C:/Exports/TikTok-zh.mp4`（createVersionedExportJobs，editor-core，有单测）；
- mock getFileStat 默认尺寸 4096 → `formatBytes` = '4.0 KB'，与 #15 断言吻合；
- gate 机制（holdExportGate/releaseAllExportGates/waitForExportGate）使任务先挂 'running'、释放后 'success'，与 #10/#12 吻合。

## 2. 现有代码调研结论

### 组件层（存在、完整、从未渲染）

- `ExportVersionBatchSection.tsx`（285 行）：含 spec 全部 testid（version-batch-tab/output-template/row/output-preview/enabled/name-input/platform-input/language-input/range-*/preset-select/width-input/height-input/watermark-select/add/remove/template-export/import），内部在 `versionedBatchReportRows.length > 0` 时渲染 `VersionedBatchReportTable`；
- `VersionedBatchReportTable.tsx`（57 行）：export-version-report/report-row/report-size/report-elapsed，渲染 versionName/platform+language/分辨率/fileSize/duration/elapsed/status；
- 两组件目前仅被类型导入引用，**从未被 JSX 渲染**——与已修复 4 项同根因（bd315fd6 丢失 version-batch 分支 JSX；拆分前该分支为 bd315fd6^:2843-3071 约 228 行内联 JSX）。

### 状态层（全部存活）

useExportState：`versionedBatchTemplate`（:137）、`versionedBatchRows`（:140，默认两行）、`latestVersionedBatchId`（:143）、`versionedBatchFileSizes`（:144）、`versionedBatchReportRows`（:357-360，由 tasks+batchId+fileSizes 派生）；文件尺寸 effect（:560-596）监听 latestVersionedBatchId 的成功任务并 getFileStat 回填。

### 入队逻辑（存活且报告链在入队时接通）

useExportActions.addToQueue 的 version-batch 分支（:741-755）：`buildVersionedBatchJobs()` →（内部 :550-565 生成 batchId、`setLatestVersionedBatchId(batchId)`、`setVersionedBatchFileSizes({})`，报告链由此接通）→ preflight 检查（issues 时切 export 步并 return）→ `warmupSelectedJobs` → `enqueueSelectedJobs` → return（**成功路径不切步**；当前实际的切步来自 warmupSelectedJobs 的自动切步，version-batch 未在排除名单）。

### 结论

与已修复 4 项完全同构：**后端/状态/mock 全部存活，仅 UI 挂载断裂**；额外多出跨步结构问题（下节）。

## 3. `export-max-concurrent-select` 位置差异核实

- **拆分前**：位于单视图对话框的队列区头部（bd315fd6^:3449），与 mode 分支同屏常驻可见；
- **拆分后**：位于 ExportProgress.tsx:86（队列区头部，组件未动），但 ExportProgress 只在 **export 步**渲染；
- **影响面核实**（grep 全部 e2e）：
  - 仅 `versioned-batch-export.spec.ts:13` 需要在 config 步语境下使用它——**这是 version-batch 独有的问题**；
  - `export.spec.ts`（single 模式）3 处使用，但 PR #121 已在每处前加 `export-step-export` 测试侧切步适配（:15/:90 注释明确记录了这一拆分影响），现稳定通过；
  - **已修复 4 项（codec-compare-export/export-pipeline/publish-pipeline/nested-sequence-export:67）的 spec 均不使用该控件**——不受此问题影响，无需额外处理。

## 4. 跨步问题解法候选对比

### 方案 A：version-batch 单视图还原（对齐拆分前 + 对齐 pipeline/codec-compare 处理模式）

- **做法**：① ExportConfig mode 三目链加 version-batch 分支，渲染 `<ExportVersionBatchSection>` + `<ExportProgress>`（队列区随模式内容同屏，还原拆分前布局）；② `warmupSelectedJobs` 的自动切步排除条件加入 `'version-batch'`（该模式入队后停留 config 步，warmup 进度面板经 ExportProgress 在 config 步可见）。
- **断言满足路径**：#5 max-concurrent（config 步队列区内）✓ → #6-#8 ✓ → 入队不切步 → #10/#12 task status（config 步队列区内）✓ → #13-#15 报告（版本区内）✓。全程零步骤导航，与 spec 隐含轨迹一致。
- **权衡**：＋改动最小（2 文件约 35 行）、无 UI 复制、与拆分前行为一致、与已修复 pipeline/codec-compare 的处理模式一致；－version-batch 的交互流与其他模式的"入队后自动进 export 步"不一致（但该模式自拆分后从未工作过，无既有用户习惯可言）。
- **对其他模式影响**：切步排除是模式等值条件追加，pipeline/codec-compare/single/sequence-batch 零变化；ExportProgress 仅在 version-batch 模式的 config 步渲染，其他步骤/模式不受影响。nested-sequence-export 依赖的切步行为（sequence-batch）不变。

### 方案 B：保持步骤架构，双步可达（控件/报告跨步复制）

- **做法**：① version-batch 分支挂载 `<ExportVersionBatchSection>`；② 在版本区（config 步）增加一个 max-concurrent 控件（绑定同一 `maxConcurrent`/`setExportQueueMaxConcurrent`，两控件同步）；③ export 步（ExportProgress 内，按 `exportMode === 'version-batch'` 门控）追加渲染 VersionedBatchReportTable；④ 保留 warmup 自动切步。
- **断言满足路径**：#5（config 步版本区控件）✓ → #6-#8 ✓ → 入队切 export 步 → #10/#12 ✓ → #13-#15（export 步报告表）✓。
- **权衡**：＋保持"入队后进 export 步"的统一步骤流；－UI 复制（max-concurrent 两处、报告表两步都可能呈现）、改动面最大（3 文件约 55 行）、ExportProgress 被所有模式的 export 步共用，新增内容必须严格门控否则波及其他模式的 export 步渲染。
- **对其他模式影响**：门控得当则无影响，但 ExportProgress 是共用组件，回归面大于方案 A。

### 方案 C：测试侧步骤导航（export.spec/PR #121 先例）

- **做法**：产品侧仅挂载 `<ExportVersionBatchSection>`（version-batch 分支）；spec 内加约 3-4 处 `export-step-*` 导航点击（#5 前切 export、#6 前切回 config、#13 前切回 config）。断言逻辑一字不动。
- **权衡**：＋产品改动最小（1 处挂载）；－修改 spec 交互序列，与本系列后续"spec 是行为规格"的处理原则相悖（但同仓库确有 PR #121 先例，且该先例处理的是同一拆分造成的同一问题）；－spec 轨迹变成 config→export→config→(入队自动)export→config，导航点击与自动切步交织，可读性差。
- **对其他模式影响**：无（不改共享产品逻辑）。

### 候选对比小结

| | 改动量 | UI 复制 | 动 spec | 共用组件回归面 | 与拆分前行为一致性 |
|---|---|---|---|---|---|
| A 单视图还原 | 小（2 文件 ~35 行） | 无 | 否 | 低 | 一致 |
| B 双步可达 | 中（3 文件 ~55 行） | 有 | 否 | 中（ExportProgress 共用） | 不一致 |
| C 测试侧导航 | 小（1 挂载 + spec 3-4 行） | 无 | **是** | 低 | 不一致 |

## 5. 逐条用例对照表（以方案 A 为例）

| spec 断言 | 方案 A 满足方式 |
|---|---|
| #4 mode tab 可点 | 已存在，不变 |
| #5 max-concurrent selectOption('2') | ExportProgress 随 version-batch 分支渲染于 config 步，控件可见 |
| #6 模板 fill | ExportVersionBatchSection 挂载 |
| #7 version-row count 2 | 默认 DEFAULT_VERSIONED_BATCH_ROWS 两行（已核实吻合） |
| #8 output-preview YouTube-zh/TikTok-zh | createVersionedExportJobs 模板展开（已核实吻合） |
| #9 入队 | shell footer，不变；buildVersionedBatchJobs 接通报告链 |
| #10 running×2（gate 挂起） | 停留 config 步，队列区（ExportProgress）内 task-status 可见；gate mock 挂起 |
| #12 success×2（gate 释放） | 同上，释放后任务成功 |
| #13 report-row count 2 | tasks+batchId 派生 versionedBatchReportRows，报告表渲染于版本区 |
| #14 分辨率 1920 x 1080 / 1080 x 1920 | 报告表分辨率列（行数据来自 job settings） |
| #15 size '4.0 KB' | getFileStat mock 默认 4096 + formatBytes（已核实吻合） |
| #16 runCalls settings 1920×1080/1080×1920 | 后端既有（exportRunCalls 记录 settings） |
| #17 两文件存在 | runExport mock 写文件（后端既有） |

方案 B/C 的逐条满足路径见第 4 节。

## 6. 预估改动范围（按方案）

- **方案 A**：`ExportConfig.tsx`（三目链 +1 分支：ExportVersionBatchSection + ExportProgress，约 +30 行，props 全部已在 state/actions 中）；`useExportActions.ts` warmupSelectedJobs 排除条件 +1 个模式（1 行）。共 2 文件。无需新增依赖、不动 editor-core。
- **方案 B**：`ExportConfig.tsx`（+1 分支）、`ExportVersionBatchSection.tsx`（+max-concurrent 控件）、`ExportProgress.tsx`（+门控报告表）。共 3 文件。
- **方案 C**：`ExportConfig.tsx`（+1 分支）+ `versioned-batch-export.spec.ts`（+3-4 行导航）。共 2 文件（含测试）。

三方案均需随后验证：4 个已转绿用例 + single 模式相关用例（export.spec 等）无回归。

## 7. 需要用户决策的开放问题

1. **解法选择**：方案 A（单视图还原，对齐拆分前与 pipeline/codec-compare 处理模式）/ 方案 B（保持步骤架构，双步可达）/ 方案 C（测试侧导航，PR #121 先例）？
2. 若选方案 A：version-batch 入队后停留 config 步（warmup 进度在 config 步队列区可见）——这一与其他模式不同的交互形态是否接受？
3. 若选方案 C：是否接受修改 spec 交互序列（断言不动，仅加导航点击）？注意这与本系列后续"spec 是行为规格、产品适配 spec"的处理原则相反，但与 PR #121 先例一致。
4. preflight 拦截路径（version-batch 分支 issues 时切 export 步）在测试用例覆盖之外，三方案均保持现状不专门处理——是否认可？

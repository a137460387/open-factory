# export.spec:3 / :81 专项诊断 —— 多路径批量入队"半成品未接线"，转交决策

日期：2026-08-11
范围锁定：仅 `apps/desktop/e2e/export.spec.ts:3`（builds a multitrack FFmpeg plan...）与 `:81`（runs export queue with two concurrent tasks...）。未触碰 media-rating:4、data-subtitles:32。未改 playwright.config.ts / CI workflow。

---

## 第一步：PR #131 合并结果

- 合并 commit：**f124431f**（`Merge pull request #131 from a137460387/fix/114-layout-settings-race`），为当前 main HEAD。
- 内容：layoutSettingsTouched 竞态修复（effbe353 + 2c381bf5）。

## 第二步：诊断

### 2.1 复现（两例失败签名一致）

原始输出：`docs/evidence/2026-08-11-export-spec-3-81-before.log`（`bunx playwright test export.spec.ts:3 export.spec.ts:81 --workers=2`，exit=1，2 failed）。

两例失败点完全相同——`expectTaskStatus(1, ...)` 等待第二个任务状态元素超时（该文件 L19-L25 附近）：

```
Error: expect(locator).toHaveAttribute(expected) failed
Locator: getByTestId('export-queue-list').getByTestId('export-task-status').nth(1)
Error: element(s) not found
at ExportDialogPage.expectTaskStatus (e2e/pages/export-dialog.page.ts:93:45)
```

即：**入队后只有 1 个任务，nth(1) 永远不出现**。

### 2.2 探针实证（最小复现）

原始输出：`docs/evidence/2026-08-11-export-batch-probe.log`。探针（用后即删）走与 :3 相同前置：填 2 个路径 → 切 export 步 → setMaxConcurrent('1') → enqueue → 数任务：

```
EXPORT_PROBE {
 "batchTextareaExists": 0,
 "beforeFill": "",
 "afterFill": "C:/Exports/probe-a.mp4 C:/Exports/probe-b.mp4",
 "taskCount": 1,
 "statuses": ["导出中"]
}
```

三个关键事实：
1. `export-batch-paths` textarea 在当前 UI 中不存在（count=0）；
2. 多行路径被填进单行 `export-output-path` input，换行被压成空格，成为一个畸形单路径；
3. 入队只产生 **1 个任务**（taskCount=1），与两例失败签名吻合。

门控机制本身正常（holdExportGate 下任务 0 稳定"导出中"）——排除任务池饿死/重渲染屏障等时序事故。

### 2.3 根因链（全部经 git 史与当前代码核实）

1. **拆分前**（`bd315fd6^:apps/desktop/src/export/ExportDialog.tsx`）两个控件并存：
   - L2103 单路径 `export-output-path` input（绑定 `outputPath`）；
   - L3254-3262 `export-batch-paths` **textarea**（绑定 `batchOutputPaths`，label `t.batchPaths`），位于非 stem 分支，i18n 文案"可选：每行一个输出路径"（`apps/desktop/src/i18n/strings.ts:4702-4703`、`en-overrides.ts:3986-3987` 至今仍存活）。
2. **拆分提交 `bd315fd6`（feat: 拆分 ExportDialog 组件）丢失了 textarea**。`git log --all -S "export-batch-paths"` 显示该 testid 自初始提交 `b93c8e8a` 存在，在 `bd315fd6` 消失，此后无任何提交再触碰——与同一次拆分丢失 codec-compare/pipeline/blend 是同一事故模式。
3. **后端接线全部存活，仅 UI 缺失**：
   - `useExportState.ts:136` `useState('')` 创建 `batchOutputPaths`，`:663` 返回；
   - `useExportActions.ts:174` 解构、`:825-832` 入队逻辑存活：`batchOutputPaths` 按换行拆分多路径，空则回退单 `outputPath`；
   - `ExportConfig.tsx:69-70` 甚至**解构了 `batchOutputPaths`/`setBatchOutputPaths` 但没有任何 JSX 使用**——接线做了一半的直接痕迹。
4. **改名轮把测试 helper 对准了坏掉的单路径 input**：`f8355019`（issue #114 改名链修复，test-only）把 `fillBatchPaths` 从已消失的 `export-batch-paths` 改填 `export-output-path`，并留下注释"多路径批量需走 version-batch/sequence-batch"。该注释记录了 2026-08-09 轮的方向（见下），但迁移动作本身从未执行。

### 2.4 是否同根因

**是，同一根因。** 证据：两例都经 `fillBatchPaths(多路径)` → `enqueue()` 这一条产品路径，失败签名逐字相同（nth(1) not found），探针对该路径的实证是确定性的 1 任务（非 flaky）。:81 的并发语义（maxConcurrent=2、让位启动第三个）在第一个任务都入不了队的情况下不可观测，但目前**无证据**表明其下还有第二个独立缺陷。

### 2.5 机制归类

不属于三类已确认事故模式（重渲染屏障/任务池饿死/程序化设置被异步加载覆盖）——行为确定、无时序成分。也不是 mock/fixture 配置问题或测试工具缺陷。归类为：**拆分重构丢失 UI 接线（半成品未接线）**，与 2026-08-09 审计 §4.1/§4.2 对 codec-compare、export-pipeline 的"不确定（半成品接线）"同桶。

## 定性：设计未决的产品问题 → 转交决策，本轮不强行修

依据：
- 提示词明确将"半成品未接线"列为需产品判断、不强行修的类别；
- 2026-08-09 审计先例：同类半成品（codec-compare/pipeline/publish-pipeline）用户明确"保持现状，不删不修"，待 roadmap 确认；
- 本例存在两条**互相竞争且有据可查**的修复方向，选择本身即产品决策：
  - 方向一（恢复）：`bd315fd6` 前 textarea 与单路径 input 并存，i18n/state/入队逻辑全存活，roadmap.md:28 "batch queueing" 标记为已交付 `[x]`——支持"事故丢失应恢复"；
  - 方向二（弃用迁移）：2026-08-09 审计 L181 已决定"version-batch 迁移（M 工作量，依赖切步修复先行）"，顺延后一直未执行；version-batch/sequence-batch 模式确实存在（`useExportActions.ts:741/756`、`ExportVersionBatchSection.tsx:58`、`SequenceBatchSection.tsx:40`）——支持"textarea 已被模式化批量取代"。

### 供决策的三个选项

| 选项 | 动作 | 代价/风险 |
|---|---|---|
| A 恢复 textarea | 在 `ExportConfig.tsx` 渲染拆分前的 textarea（约 10 行 JSX，绑定已解构的 `batchOutputPaths`），page object `fillBatchPaths` 回填 `export-batch-paths` | 与 2026-08-09 记录的迁移方向相悖；复活与 version-batch 竞争的机制 |
| B 迁移到 version-batch | 按 2026-08-09 既定方向把 :3/:81 改为 version-batch 机制入队 | M 工作量；依赖 versioned-batch-export 自身先转绿；:3 的"第二个输出路径"断言需重新设计，测试意图改变 |
| C 放弃多路径 | 单路径多次 enqueue 重写两例，删除孤儿 `batchOutputPaths` state 与死分支 | 移除 roadmap 标记已交付的批量入队能力；:3 的 retry→任务1 流转断言需重构 |

## 本轮动作清单

- 合并 PR #131 → f124431f（唯一落库变更）；
- 诊断、复现、探针实证，原始输出落盘 `docs/evidence/2026-08-11-export-spec-3-81-before.log`、`2026-08-11-export-batch-probe.log`；
- 探针文件 `zz-export-probe.spec.ts` 已删除；工作区无任何已跟踪文件改动；
- 未 push、未开 PR、无修复 commit（转交决策）。

## 与提示词假设的差异

1. 提示词预留"两个独立根因各一次 commit"或"同根因一次 commit"两种走向；实际结论是第三种——**同根因，但该根因属设计未决，按规则不产生修复 commit**。
2. :3 的表面身份是"FFmpeg plan 构建断言"，但它从未跑到 plan 断言（L28-36）——在 L20 `expectTaskStatus(1,'pending')` 即失败，plan 覆盖随红条一起失效。修好入队前置后该断言才真正接受检验。
3. `fillBatchPaths` 中"已下线"注释并非产品决策记录，而是 f8355019（test-only 改名轮）写下的方向备注，其依据是 2026-08-09 审计的顺延决定，迁移动作从未执行。

---

## 补记（2026-08-11 下午）：决策 A 落地

用户拍板方向 A（恢复 textarea，不迁移 version-batch、不放弃多路径）。实施与验证：

1. **ExportConfig.tsx**：Priority 段前接回拆分前原样 textarea（label `t.batchPaths`、placeholder `t.batchPlaceholder`、testid `export-batch-paths`、受控绑定 `batchOutputPaths/setBatchOutputPaths`），gate 为 `exportMode === 'single'`——与拆分前三目链（pipeline/codec-compare/version-batch/sequence-batch/stem 各有显式分支）的 else 分支逐字等价；enqueue 侧同样只有 single 到达 batchOutputPaths 拆分分支（useExportActions.ts 现 L825 区域），双侧一致。
2. **fillBatchPaths helper**：回填 `export-batch-paths`（f8355019 的误导向撤销），JSDoc 更新。
3. **单测**：`useExportActions.batch-paths.test.tsx`（4 例：多行拆分入队 3 任务、CRLF/空行/trim、空回退单路径、outputPath 同步首路径）+ `ExportConfig.batch-paths.test.tsx`（2 例：single 受控绑定与回写、stem 不渲染）。测试基建踩坑两处已留注释：tauri-bridge mock 必须显式枚举导出（Proxy 工厂缺 ownKeys 被判无导出、get 返回 truthy 'then' 伪装 thenable 致 await import 永久挂起）；vitest 未开 globals 需显式 `cleanup()`。
4. **实证**（`docs/evidence/2026-08-11-export-batch-probe-after.log`）：3 路径 → taskCount=3（导出中/等待中/等待中，maxConcurrent=1），探针用后即删。
5. **e2e**：export.spec:3/:81 转绿（`2026-08-11-export-spec-3-81-after.log`）；export.spec.ts 精确 9/9 绿（`2026-08-11-export-spec-exact.log`）。子串匹配带入的半成品簇 3 红项（codec-compare-export:4 / nested-sequence-export:67 / versioned-batch-export:4）经 stash A/B 对照确认为既有红项、与本次改动无关（三者均不用 fillBatchPaths，且失败点与 2026-08-09 审计记录逐字一致），2026-08-09"维持现状"决定继续有效。
6. **回归面**：export 目录单测 19 文件 254 例全绿；typecheck / build 通过。

# Phase 5 结构性死代码调研报告（只读）

**日期**：2026-08-16
**性质**：只读调研，未删除/未修改任何代码
**范围**：此前搁置的三大类死代码（store barrel 重导出 / 组件导出 / 公共 API barrel）
**基线**：main @ c5dbb365
**决策要求**：本文档只列事实与选项，**不做最终选择**，等待裁决

---

## 0. 执行摘要

| 类别 | 用户口径（约数） | 本次实测 | 结论一句话 |
|------|-----------------|---------|-----------|
| 一、Store barrel 重导出 | ~260 | **266 项**（11 文件） | 全部为"拆分后无人经 barrel 消费的重导出 + 从未被任何路径消费的 selector hooks"；222 项全仓零消费（含测试） |
| 二、组件 prop/子组件导出 | ~250 | **288 项**（components/ 下 32 文件；剔除 lazyComponents.ts 42 项后为 246） | **0 例 knip 误判**（全量验证，非抽样）；"父组件相对路径引用所以 knip 看不到"的假设不成立；实为死重导出/多余 export/重复定义/真死代码四种混合 |
| 三、公共 API barrel | ~120 | **56 项**（desktop 侧 9 个 barrel 文件：tauri-bridge 7 个子模块 37 + observability/index 12 + video-gen/index 7）+ editor-core 等包内 141 项 + examples 7 项。另注：lazyComponents.ts 42 项按路径归类别二（components 桶），若按题目归入本类口径，则为 10 个文件合计 98 项，两个口径不混用 | barrel 均有存活消费者但被标记项零消费；**npm 上不存在 @open-factory scope 任何包，无外部消费者**；examples/plugins 是 knip CJS 盲区，不可删 |

**总量对账**：当前 knip 报告 **627 个未使用导出 + 165 个未使用类型 = 792 项**（103 个文件）。
此前 phase-1 执行日志中"保留未处理 ~630 项"对应的是**导出项口径**（当前 627，基本一致），
类型项（165）当时未计入口径。2026-07-20 的旧报告为 425 项导出，此后 store 拆分（H4/H5）、
Inspector 拆分、tauri-bridge 拆分等重构**新增**了大量兼容重导出层，是数字增长的主因（详见 §1.4/§2.4/§3.4）。

**分桶构成**：792 项按路径分桶 = 类别一 store 266 + 类别二 components 288（含 lazyComponents.ts 42）+ 类别三 desktop barrel 58（tauri-bridge 37 + observability 13 + video-gen 8，其中含 2 个非 barrel 源模块 video-gen-store.ts / observability/logger.ts 各 1 项）+ packages 141（editor-core 132 + cli 5 + creator-dashboard 3 + api-gateway 1）+ examples 7 + **other-desktop 残留桶 32**。
其中 other-desktop 残留桶是 18 个路径不在三大类范围内的 apps/desktop 零散文件（export/、ai-style-engine/、hooks/、lib/、settings/ 等；最大为 ai-style-engine/style-model-manager.ts 4 项、export/export-utils.tsx 3 项、hooks/useVideoGeneration.ts 3 项），**不属于三大类中任何一类，本次调研未对它裁决**，完整清单见 `docs/evidence/phase5-buckets-2026-08-16.txt` 末段。

**交叉验证方法**（不依赖 knip 单一信号）：
1. knip 6.24.0 重跑两次（文本 + JSON reporter），原始输出落盘（见附录）
2. 自研全仓导入扫描器（`tmp/phase5-*.cjs`，解析 ESM 命名导入，含多行 import、`@/` 别名、`@open-factory/*` 包名及子路径解析），**包含 knip 排除的 `__tests__`/`*.test.*`/e2e 文件**，对每项独立分类
3. 动态 `import().then(m => m.X)` 成员访问模式专项扫描（105 个名字，与被标记项交集已逐一人工核对）
4. CJS `require()` + 解构模式专项核对（examples/plugins）
5. 关键符号逐个 grep 溯源（定义点 vs 导入点 vs 同文件内部使用）
6. npm registry 直接查询发布状态

---

## 1. 类别一：Store barrel 重导出（266 项）

### 1.1 精确数字与文件分布

knip 标记 11 个 store 文件共 266 项（evidence: `docs/evidence/knip-json-2026-08-16.txt`，`issues[]` 中 `file` 匹配 `apps/desktop/src/store/*.ts` 的条目；文本版 `docs/evidence/knip-2026-08-16.txt` 第 1 行起）：

| 文件 | exports | types | 合计 | 文件性质 |
|------|---------|-------|------|---------|
| editorFeatureStore.ts | 108 | 0 | **108** | 兼容 barrel（重导出 4 个子 store，自有 useEditorFeatureStore） |
| editorUIStore.ts | 18 | 1 | **19** | 兼容 barrel（重导出 panel/dialog/toolbar/modal + dialog-state） |
| mediaFeatureStore.ts | 36 | 1 | 37 | 子 store（H5 拆分产物） |
| aiFeatureStore.ts | 25 | 1 | 26 | 子 store |
| timelineFeatureStore.ts | 23 | 1 | 24 | 子 store |
| exportFeatureStore.ts | 12 | 1 | 13 | 子 store |
| mixerStore.ts | 13 | 1 | 14 | 独立 store（非 barrel，selector hooks 无人采用） |
| dialogStore.ts | 5 | 2 | 7 | 子 store（处于 dialog-state→dialogStore→toolbar/modal→editorUIStore 重导出链中） |
| toolbarStore.ts | 4 | 3 | 7 | 链中节点（自身也重导出 dialogStore 的符号） |
| modalStore.ts | 4 | 3 | 7 | 链中节点（同上） |
| panelStore.ts | 2 | 2 | 4 | 子 store |
| **合计** | | | **266** | |

### 1.2 逐子 store 消费者矩阵（核心交叉验证）

自研扫描器结果（evidence: `docs/evidence/phase5-store-analysis-2026-08-16.txt` 全文、`docs/evidence/phase5-store-final-2026-08-16.txt`）：

**谁在从 barrel 导入？**
- `editorFeatureStore.ts` 有 21 条导入语句（20 生产 + 1 测试），**全部只导入 1 个符号：`useEditorFeatureStore`**（barrel 自有的组合 hook，未被标记）
- `editorUIStore.ts` 有 28 条导入语句，只导入 `useEditorUIStore`（×27）和 `EditorUIState`（×1），均为 barrel 自有导出
- **没有任何文件通过 barrel 路径导入任何被标记的重导出符号** —— 108 + 19 = 127 项 barrel 重导出全部零 barrel 消费者

**谁在从子 store 直接导入？（H4.5/H5.4 迁移的实际进度）**

| 子 store | 生产消费者 | 测试消费者 |
|---------|-----------|-----------|
| aiFeatureStore | AnalysisDialogs.tsx（1 个符号：useSetSpeakerDiarizationResult） | editorFeatureStore.test.ts（useAIFeatureStore） |
| timelineFeatureStore | AnalysisDialogs.tsx（5 个 op-recording setter） | editorFeatureStore.test.ts（useTimelineFeatureStore） |
| mediaFeatureStore | AnalysisDialogs.tsx（2 个 spectrum 符号） | editorFeatureStore.test.ts（useMediaFeatureStore） |
| exportFeatureStore | **无** | editorFeatureStore.test.ts（useExportFeatureStore） |
| panelStore | ShellLeftPanel.tsx、ShellRightPanel.tsx（7 个符号） | editorUIStore.test.ts |
| dialogStore | **无** | editorUIStore.test.ts（useDialogStore、dialogBooleanSelector） |
| toolbarStore / modalStore | **无** | editorUIStore.test.ts |

即：迁移计划（2026-08-01-next-phase-plan.md 的 H4.5/H5.4）只完成了约 3 个生产文件，21+27 个旧消费者仍挂在组合 hook 上。

**266 项的三分类**（evidence: `docs/evidence/phase5-buckets-2026-08-16.txt` 第 1-5 行）：

| 分类 | 项数 | 含义 |
|------|------|------|
| 全仓零消费（含测试） | **222** | 符号在任何模块的任何 import 语句中都不出现 |
| 生产消费于其他路径 | 33 | 如 usePanelStore 等：符号经子 store 直连被生产代码使用，仅 barrel 层的死重导出被标记 |
| 仅测试消费于其他路径 | 11 | 如 useExportFeatureStore：只有 editorFeatureStore.test.ts 经子 store 导入 |

**去重**：222 项零消费项按符号名去重后为 **115 个唯一死符号**。同一符号经多层重导出链被计 2-4 次（例：`DIALOG_KEYS` 同时在 dialogStore、toolbarStore、modalStore、editorUIStore 四处被标记；`useColorAnalysisBusy` 同时在 editorFeatureStore 和 mediaFeatureStore 被标记）。

### 1.3 死因定性

这 266 项**不是历史遗留垃圾，而是"为未完成的迁移预留的 API 面"**：
- barrel 重导出（127 项）：H4/H5 拆分时按计划保留的向后兼容层（拆分方案明确要求"保留旧 Store 的 re-export 直到所有引用迁移完成"）
- 子 store selector hooks（~100 项）：拆分时设计的目标 API（`useProfilerRecording` 等），但消费者迁移从未发生，这些 hooks 从诞生起就零消费
- mixerStore 14 项：独立 store 的 selector helpers，同样零采用

### 1.4 与 7/20 旧报告的差异

7/20 报告（`docs/audit/knip-raw-2026-07-20.txt`）中 store 类仅零星几项；当前 editorFeatureStore.ts 一家就有 108 项。原因：Sprint 1 的 store 拆分（2026-08-01~08-14 完成 H4.1-H4.4/H5.1-H5.3）在 7/20 之后创建了 barrel + 子 store 结构，同步产生了这批"拆分即死"的重导出。

### 1.5 处理方向选项（不做选择）

**方案 A：保留现状，接受技术债**
- 工作量：0
- 风险：无直接风险；knip 噪音持续存在（266 项约占全仓标记项 1/3），后续审计信噪比下降；每次重构 store 还会新增同类项
- 破坏性：无
- 附注：可通过 knip 的 `ignoreExportsInFiles` / `@public` 标注把这批文件标记为"有意公共面"，换取干净的报告，但等于正式承认该 API 面永远保留

**方案 B：完成迁移后废弃 barrel（与 H4.5/H5.4 合并执行）**
- 内容：先把 21（feature）+ 27（UI）个组合 hook 消费者迁到子 store 直连，再删除 barrel 的重导出行；组合 hook `useEditorFeatureStore`/`useEditorUIStore` 本身是否保留可再议（它们未被标记、有真实消费者）
- 工作量：大——48 个文件的消费者迁移（多数是 EditorShell hooks 系列大文件），是原计划 H4.5/H5.4 的全部工作量，估 5-8 人日；其中把 `useEditorFeatureStore(s => s.x)` 选择器用法改写为子 store selector 时需逐个核对状态归属
- 风险：~~中~~ **低（已下调，订正依据见下）**——~~状态归属易错（组合 store 与子 store 是两份独立状态副本？经查组合 store 在 editorFeatureStore.ts:337 自建全套 state，与子 store **不共享实例**，迁移时若漏改会出现双状态源 bug，此点需在迁移方案中特别处理）~~
  > **【已订正 2026-08-16】**上述"双状态源"判断**错误**，被阶段 1a 验证证伪（commit `d1120899`，`apps/desktop/src/store/storeMigrationSafety.test.ts` 14/14 通过）：8 个 H4/H5 子 store **均不自建 zustand store**，它们只 re-export 组合 hook 并在同一实例上提供 selector hooks（佐证：全仓 `from 'zustand'` 的 20 个文件中无任何子 store；现有 editorFeatureStore.test.ts / editorUIStore.test.ts 亦早有 hook 同一性断言）。因此消费者在组合 hook 与子 store 直连之间混用/漏改**不会产生状态分歧**，只影响导入路径一致性。原判断错误根因：调研时只读了 editorFeatureStore.ts:337 的 `create()`，未读子 store 文件内容。风险据此由"中"下调为"低"：剩余风险仅为机械迁移中的导入路径/标识符改名笔误，typecheck 可在编译期完全捕获；唯一潜在行为差异来源（模块加载顺序副作用）经查不存在（store 模块为纯状态定义）。
- 破坏性：对仓库内部是重构（typecheck 可兜底）；**对外部无破坏**（store 属 apps/desktop 内部，无包发布，见 §3.3）
- 收益顺带：222 项零消费符号中有 ~100 项子 store selector hooks 若确认不作为迁移目标 API，可直接删除，不必等迁移

**方案 C：混合/分批（不动消费者，只动导出）**
- C1（低风险批）：删除"零消费且非迁移目标"的项——222 项中的子 store selector hooks 与重复链中层（toolbar/modal 对 dialogStore 符号的重导出），保留 barrel 对子 store 主 hook 的重导出
- 工作量：1-2 人日（机械删导出 + typecheck + 5219 测试回归）
- 风险：低；但会**收窄迁移目标 API**——若之后做方案 B，消费者只能直连子 store，不能再经 barrel 取这些 selector（需确认这正是期望方向）
- 破坏性：仓库内部无（零消费项删除不改变任何行为）；外部无
- C2（仅清点不动手）：先为 266 项补 knip ignore 标注 + 在 next-phase-plan 中把"barrel 退役"列为 H4.5/H5.4 的显式验收项，推迟到迁移批次一起做

---

## 2. 类别二：组件 prop / 子组件导出（288 项，其中 lazyComponents.ts 42 项归入类别三讨论）

### 2.1 精确数字

components/ 子树共 32 个文件 288 项（evidence: `docs/evidence/phase5-component-analysis-2026-08-16.txt`）。Top 文件：

| 文件 | 项数 |
|------|------|
| Inspector/InspectorEditors.tsx | 64 |
| lazyComponents.ts（归类别三） | 42 |
| Inspector/CurveEditors.tsx | 39 |
| Inspector/KeyframeCurveEditor.tsx | 25 |
| Timeline/TimelineParts.tsx | 23 |
| Timeline/TimelineClipComponents.tsx | 15 |
| Inspector/ColorEditors.tsx | 12 |
| PreviewCanvas/types.ts | 8 |
| Inspector/RichTextEditor.tsx | 8 |
| Inspector/EffectEditors.tsx | 7 |
| 其余 22 个文件 | 45 |

### 2.2 全量分类（非抽样）

对全部 288 项按"真实消费状态"分类（evidence 同上，末尾 TOTALS）：

| 分类 | 项数 | 说明 |
|------|------|------|
| **生产代码从被标记模块导入（knip 误判）** | **0** | 全量验证，一例都没有 |
| 测试从被标记模块导入 | 0 | |
| 符号在别处被生产消费（重导出/重复定义，活的是另一份） | 34 | |
| 符号仅被测试在别处消费 | 10 | |
| 全仓零导入、但同文件内部在用（多余 export 关键字） | 160 | |
| 全仓零导入、同文件也没用（真死代码/死重导出行） | 84 | |

### 2.3 抽样深挖（8 个文件）

**① InspectorEditors.tsx（64 项）** —— 与 store barrel 完全同构的兼容层
- 文件头第 8-14 行是 7 条 `export {...} from './SubtitleEditors'/'./CurveEditors'/...` 向后兼容重导出（注释原文 "Re-export extracted components for backward compatibility"）
- 64 项中 **62 项是死重导出**（evidence: `docs/evidence/phase5-component-analysis-2026-08-16.txt` 对该文件段），另有 **2 项是本地重复定义**（`formatKeyframeProperty`/`formatKeyframeValue` 同时定义于 KeyframeCurveEditor.tsx:908 附近，生产消费者 MotionPanel.tsx:6 从后者导入）
- barrel 本身活着：EffectPanel/Inspector/AudioPanel/MotionGraphicPanel 等 8+ 文件仍从它导入**未被标记**的符号（Section、AnimatedField、CurveEditor 等）

**② CurveEditors.tsx（39）与 ③ KeyframeCurveEditor.tsx（25）** —— 整组工具函数双份拷贝
- 两文件被标记的名单几乎相同（getSpeedCurveFrames、drawKeyframeCurveCanvas、roundFinite、clampUnit……），即**同一套曲线编辑辅助函数在两个文件里各有一份定义**
- 其中绝大多数两份都死（如 `getCurveEditorFrames` 全仓零导入）；个别一份活：`SpeedCurveEditor` 的活副本在 CurveEditors（经 InspectorEditors barrel 被 SpeedPanel 消费），KeyframeCurveEditor 里的副本死
- `formatKeyframeProperty` 存在**三份**（CurveEditors:629、InspectorEditors:248、KeyframeCurveEditor:908）

**④ TimelineParts.tsx（23）** —— 纯 facade barrel
- 文件头注释 "Facade: re-exports from sub-modules to preserve existing import paths"；被标记项全部是 facade 重导出行，实际消费者（如 TimelineTrackComponents.tsx）已直连 timeline-parts-types / TimelineClipComponents

**⑤ TimelineClipComponents.tsx（15）** —— 纯"多余 export 关键字"
- 15 项（envelopePointX、getClipToneClass、VideoThumbnailStrip 等）全部在同文件内部使用，只是导出无人要

**⑥ ColorEditors.tsx（12）** —— 混合：9 项同文件在用；`hsvToRgb` 等色域换算函数与 CurveEditors 重复定义，且 LutEditorDialog.tsx 里还有第三份**未导出的本地副本**（实际在用的那份）

**⑦ RichTextEditor.tsx（8）** —— 全部同文件内部使用的富文本序列化辅助函数

**⑧ EffectEditors.tsx（7）** —— 三种模式并存：`TextField`/`ColorField` 等经直连被 MotionGraphicPanel 消费（未标记）；`TextAreaField`/`RangeField`/`ExpressionNumberField` 与 InspectorFields.tsx 的同名导出重复且死的是本文件这份；其余 4 项同文件在用

### 2.4 对"knip 跟踪不到但实际有消费者"假设的回答

**该假设在当前代码库不成立**。全量（非抽样）验证 288 项，生产代码从被标记模块导入的数量为 **0**。7/20 旧报告时代 InspectorEditors.tsx 尚是单体文件、其导出确实被父组件引用；此后 Inspector 拆分把消费者改为直连子模块 + barrel 兼容层，格局已变。旧结论（"knip 误判多"）针对的是 7/3 grep 误报事件，与本次无关。

真实存在的 knip 盲区只有两处，且都不在本类：
1. **CJS `module.exports` + `require` 解构**（examples/plugins，见 §3.5）
2. 动态 `import().then(m => m.X)`（本项目 105 处，专项扫描后确认与被标记项的交集全部是 lazyComponents.ts 内部对**目标模块**的引用，不构成对 lazyComponents 自身导出的消费，evidence: `docs/evidence/phase5-dynamic-import-check-2026-08-16.txt`）

模式普遍性结论：**"每个文件情况不同、但可枚举为四种固定子模式"**（死重导出 / 多余 export / 重复定义 / 真死代码），不存在需要逐文件人工判断的不可归约复杂性。四种子模式的全仓精确分布见 `docs/evidence/phase5-master-classify-2026-08-16.txt`（792 项全量）。

### 2.5 处理方向选项（不做选择）

**方案 A：保留现状**
- 工作量 0；风险：Inspector/曲线工具的多份拷贝意味着修 bug 需同步多处（`normalizeHexColor` 在 editor-core 内也已有三份并在 index.ts:20 留有已知消歧注释）；破坏性无

**方案 B：按子模式分四批清理**
- B1 死重导出行（~105 项，InspectorEditors 62 + TimelineParts 23 + 其余）：删行，工作量 0.5 人日，风险极低（typecheck 兜底）
- B2 多余 export 关键字（160 项）：去掉 `export`，代码保留，工作量 0.5-1 人日，风险极低；注意其中同文件也在用的测试不可访问性变化（目前本来也没测试经这些路径导入）
- B3 重复定义收敛（~60 项）：删死副本、活副本归一到一处（如曲线工具函数统一放 KeyframeCurveEditor 或独立 utils），工作量 2-3 人日，风险中——需逐个 diff 两份实现确认无行为分歧（本次抽查 CurveEditors/KeyframeCurveEditor 两份实现未做逐行 diff）
- B4 真死代码（84 项中的本地定义部分）：删除定义，工作量 1 人日，风险低但需逐个复核（本报告的"零引用"判定基于导入语句 + 词频，已尽力排除误判，删除前仍应逐个 grep 复核——符合审计规范第 2 条）
- 破坏性：全部为仓库内部重构，typecheck + 5219 单测 + E2E 可兜底；无外部破坏（见 §3.3）

**方案 C：只做 B1+B2（纯机械批），B3/B4 挂起**
- 工作量 1-1.5 人日即可消掉 ~265 项标记；B3/B4 留待 Inspector 拆分（Sprint 2 H6/H7）时顺势处理，避免两次动同一批文件

---

## 3. 类别三：公共 API barrel

### 3.1 精确数字与口径修正

用户口径 ~120 项实为混合估算。本次精确拆分（evidence: `docs/evidence/phase5-buckets-2026-08-16.txt`）：

| 子类 | 文件数 | 项数 | 说明 |
|------|--------|------|------|
| desktop 公共 barrel：lazyComponents.ts | 1 | 42 | 被 Shell* 本地 lazy 定义取代的中心注册表 |
| desktop 公共 barrel：tauri-bridge/ 7 个子模块 | 7 | 37 | types 15、audio-visual-analysis 7、ai-db 6、fs 3、export 3、media 2、window 1 |
| desktop 公共 barrel：observability/index.ts | 1 | 12 | |
| desktop 公共 barrel：video-gen/index.ts | 1 | 7 | |
| （附带）video-gen-store.ts、observability/logger.ts 两个源模块 | 2 | 2 | 非 barrel，同文件讨论 |
| packages/（editor-core 132 + cli 5 + creator-dashboard 3 + api-gateway 1） | 28 | 141 | editor-core 公共面可达但零消费的导出/类型 |
| examples/plugins | 3 | 7 | **knip CJS 盲区，不可删** |

### 3.2 逐 barrel 消费者验证

**lazyComponents.ts（42 项）**：唯一消费者 EditorShell.tsx:22-27 只导入 5 个 wrapper（ComplexityScorePanel、AutoAudioSyncDialog、CommandPalette、GestureTutorialOverlay、RoughCutComparePanel）。其余 42 个 wrapper 常量对应的组件已由 ShellRightPanel.tsx:18-40、ShellMainArea.tsx:16-20 等 layout 模块**各自本地定义 lazy()**。即该文件是"被放弃的中心化方案"，42 项是整个死 wrapper（连带其内部 import 路径），不是组件本身死。

**tauri-bridge/（37 项）**：tauri-bridge.ts barrel 以 `export *` 重导出全部 9 个子模块（tauri-bridge.ts:1-9），故这些导出理论上经由 barrel 对全部业务代码可见，但经任何路径（barrel 或直连）都零导入。逐文件：
- fs.ts：readFileHeaderBytes、isEncryptedProjectFile、authorizePaths —— 零消费
- ai-db.ts：upsertMediaAsset、deleteMediaAsset、autoTagAsset、addManualTag、removeManualTag、setHwDecodeSettings —— 零消费
- export.ts：writeSmtpPassword、getCacheDir、removeCacheFile —— 零消费
- media.ts：detectGlitches、detectFfmpeg —— 零消费
- window.ts：listenRenderPreviewCacheProgress —— 零消费
- types.ts：15 个 interface（MediaVideoStreamInfo、GlitchItem、PrivacyDetectionBox 等）—— 零消费
- audio-visual-analysis.ts：7 个 interface；其中 SpectrumFrame/OnsetEvent 与 editor-core audio-rhythm-analysis 的同名类型**重复定义**（生产消费的是 editor-core 那份）
- ⚠️ 附带发现：这些 TS 包装函数对应的 Rust 命令是否仍在 `src-tauri` 注册/使用未在本次范围内核查，删除 TS 层前应核对（审计规范第 2 条）

**observability/index.ts（12 项）**：唯一消费者 main.tsx:4 只导入 errorReporter、metrics（均未被标记）。被标记的 Logger/logger/ErrorReporter 类/MetricsCollector 类/PerformanceTracker 类及 7 个 transport 类型，要么零消费、要么只被同目录测试经**直连子模块路径**消费（error-reporter.test.ts 等 4 个测试文件）。

**video-gen/index.ts（7 项）**：唯一生产消费者 VideoGenerationPanel.tsx:17 经 barrel 导入的符号未被标记；被标记 7 项中 6 项经直连（video-gen-store/video-gen-runner）被生产和测试消费，仅 `VideoGenTaskStatus` 类型全仓零消费。

**editor-core（132 项）**：两种性质——
- project-converter.ts 39 项：ffmpeg-builder 拆分时**保留在原文件的常量/函数副本**，活副本在 settings-normalize.ts/utils.ts（如 SETPTS_EXPRESSION_LIMIT：settings-normalize.ts:66 活、project-converter.ts:136 死；normalizeHexColor 有三份：settings-normalize.ts:189、project-converter.ts:743、audio-visualization.ts:336，index.ts:20 已有已知消歧注释）
- 其余 93 项（scene-understanding 17、smart-editing 12、node-editor-types 10、llm-orchestrator 7、inference-engine 4、collaboration 系列 9 等）：**面向未建成功能的类型/接口预留**（场景理解、节点编辑器、LLM 编排、WebRTC 协作……），全仓（含 apps/desktop、packages、examples、tools、scripts）零导入

**packages/cli、creator-dashboard、api-gateway（9 项）**：各自内部的零消费类型/函数。

### 3.3 外部消费者核实（published package 可能性）

- 根 package.json：`"private": true`，workspaces 应用型 monorepo
- `@open-factory/editor-core`、`@open-factory/plugin-sdk`：`"private": true` → npm 禁止发布
- npm registry 实测：`@open-factory/editor-core` 与 `@open-factory/cli` 均 **404**（2026-08-16 查询），scope 内无已发布包
- cli/creator-dashboard/api-gateway 未标 private，但从未发布，且无 publish 相关 CI
- 残余可能性：第三方经 **GitHub git URL 直接依赖**本仓库理论可行，无法完全排除；但 README/文档未宣传包消费方式，风险可忽略。**结论：所有被标记项均无仓库外消费者，删除不构成对外 breaking change**

### 3.4 examples/plugins（7 项）——knip 盲区，不可删

三个示例插件均为 CJS（`module.exports = { manifest, hooks }`），由插件运行时（plugin-loader.ts:169 createWorkerPluginRuntime，worker 动态加载）消费；且每个插件有同目录 `index.test.js` 通过 `require('./index')` + 解构消费部分导出（如 subtitle-translator/index.test.js:50 解构 translateText；social-export/index.test.js:19 测试 getPlatformPresets）。这 7 项属于"导出供测试/运行时"的活代码，**必须从清理清单排除并加入 knip ignore**。

### 3.5 处理方向选项（不做选择）

> **裁决记录（2026-08-16）**：**方案 A 已采纳**——本类全部保留，不做任何代码改动。
> 配套措施：knip.json 已通过 `ignoreIssues` 覆盖本类三类文件（desktop barrel / packages / examples），
> knip 报告中本类 206 项已归零（验证：792 − 206 = 586 项剩余，evidence: `docs/evidence/knip-after-cat3-ignore-2026-08-16.txt`）。
> 注意：ignore 范围按目录 glob 生效，这些目录下**未来新增**的死导出也不会再被报告，如需收紧为精确文件清单可另行调整。

**方案 A：全部保留为"预留公共 API"**【已裁决采纳】
- 工作量 0；风险：editor-core 的 94 项未用类型持续膨胀公共面、拖累 tree-shaking 与类型检查；破坏性无
- plugin-sdk 本身 0 项被标记——**插件生态的契约面是干净的**，本类清理不影响插件生态的稳定性

**方案 B：分级删除**
- B1 desktop barrel 死项（98 项 = lazyComponents 42 个死 wrapper + tauri-bridge 37 项零消费函数 + observability/index 12 + video-gen/index 7；若剔除 lazyComponents 则为 56 项）：工作量 1 人日；风险低（typecheck + 单测兜底）；tauri-bridge 部分需先核对 Rust 命令注册情况
- B2 editor-core 重复副本（~39 项 project-converter + audio-visualization 重复 normalizeHexColor）：与 §2.5-B3 合并处理
- B3 editor-core 预留类型（93 项）：删除 = 放弃对应未建成功能的类型脚手架（scene-understanding、node-editor 等均关联 roadmap 未实现项）；git 历史可随时找回。风险：若这些功能列入近期 roadmap（需对照 docs/roadmap.md 裁决），删除后重建有成本；若不在 roadmap，保留只是噪音。破坏性：无（无外部消费者）
- examples 7 项：**不删**，加 knip ignore

**方案 C：不删但显式标注**
- 用 knip 的 `@public` JSDoc 标签或 `ignoreExportsInFiles` 把"有意保留的预留面"（editor-core 预留类型、tauri-bridge 预留包装）标注出来，使报告归零、保留意图显式化。工作量 0.5-1 人日；风险无；代价是这套标注需要随 roadmap 演进维护

---

## 4. 横切发现（供裁决参考）

1. **重复定义是三类共同底色**：Inspector 曲线工具（2-3 份）、色彩换算（3 份）、ffmpeg-builder 常量/函数（2-3 份）、tauri-bridge 类型 vs editor-core 类型（2 份）。即使不做任何"死代码清理"，仅重复收敛就值得单独立项；反过来，只删导出不收敛重复，问题只解决一半
2. **重构模式缺陷**：每次大文件拆分（store/Inspector/ffmpeg-builder/tauri-bridge）都产生"兼容重导出层 + 消费者只迁一半 + 工具函数复制而非引用"三件套。若不改进拆分流程（拆分即迁消费者、工具函数归一），本次清理后下一轮拆分会再生产同类 200+ 项
3. **knip 可信度**：本次 792 项中，除 examples/plugins 7 项 CJS 盲区外，**未发现任何 knip 误报**；7/3 事件中的大面积误报来自 grep 而非 knip。建议后续把 knip 纳入 CI（roadmap 已有此待办）并固化为 dead-code 门禁
4. ~~**组合 store 与子 store 是独立状态实例**（editorFeatureStore.ts:337 自建全套 state），这是方案 B 迁移时最大的正确性风险点~~ **【已订正 2026-08-16，原判断错误】**：8 个子 store 均不自建实例，与组合 store 共享同一 zustand store，已由阶段 1a 测试证伪（commit `d1120899`），方案 B 迁移无状态分歧风险，风险等级已由"中"下调为"低"（详见 §1.5 订正说明）

## 5. 建议的裁决问题清单（仅供提问，不预设答案）

1. 三类各选哪个方案（A/B/C 或组合）？
2. 子 store selector hooks（~100 项零消费）是"迁移目标 API"还是"废弃设计"？这决定类别一走 B 还是 C1
3. editor-core 预留类型（94 项）对应的 功能是否仍在 roadmap？决定去留
4. examples/plugins 7 项加 knip ignore 是否随本次一并处理？
5. 重复定义收敛是否单独立项（横切发现 1）？

---

## 附录：证据文件清单

| 文件 | 内容 |
|------|------|
| `docs/evidence/knip-2026-08-16.txt` | knip 6.24.0 默认报告原始输出（794 行，标题行 "Unused exports (627)"） |
| `docs/evidence/knip-json-2026-08-16.txt` | knip JSON 原始输出（机器可读，103 文件全量） |
| `docs/evidence/knip-json-2026-08-16.stderr.txt` | knip 运行 stderr |
| `docs/evidence/phase5-store-analysis-2026-08-16.txt` | 类别一：barrel/子 store 导入语句全量清单与重导出重叠分析 |
| `docs/evidence/phase5-store-final-2026-08-16.txt` | 类别一：逐文件"零导入复核"（222/266 的来源） |
| `docs/evidence/phase5-component-analysis-2026-08-16.txt` | 类别二：32 文件 288 项全量分类明细 |
| `docs/evidence/phase5-master-classify-2026-08-16.txt` | 全仓 792 项主分类表（重导出? × 消费状态 × 同文件使用） |
| `docs/evidence/phase5-cat3-analysis-2026-08-16.txt` | 类别三：逐文件逐符号消费者溯源（含包名导入解析） |
| `docs/evidence/phase5-buckets-2026-08-16.txt` | 最终分桶统计（本文所有汇总数字的直接来源） |
| `docs/evidence/phase5-dynamic-import-check-2026-08-16.txt` | 动态 import 成员访问盲区专项核查 |

分析脚本（新建于 tmp/，未改动任何现有文件）：`tmp/phase5-store-analysis.cjs`、`tmp/phase5-store-overlap.cjs`、`tmp/phase5-store-final.cjs`、`tmp/phase5-component-analysis.cjs`、`tmp/phase5-master-classify.cjs`、`tmp/phase5-symbol-trace.cjs`、`tmp/phase5-cat3-analysis.cjs`、`tmp/phase5-buckets.cjs`、`tmp/phase5-dynamic-import-check.cjs`

**核查声明**：本报告所有数字均由上述证据文件直接生成，未使用约数；792 = 627 exports + 165 types = 分桶和（266+288+58+141+7+32）已对账一致。

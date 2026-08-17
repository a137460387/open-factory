# Phase 5 执行日志（结构性死代码处理）

> 开始时间：2026-08-16
> 基线：main @ c5dbb365（PR #145 合并后）
> 调研文档：`docs/audit/phase5-structural-cleanup-research.md`
> 上游日志：`docs/audit/phase1-4-execution-log.md`

---

## 总裁决（2026-08-16 用户裁决）

| 工作线 | 裁决 | 执行状态 |
|--------|------|---------|
| 类别三：公共 API barrel（141+58+7 项） | 方案 A 全部保留 + knip ignoreIssues 静默 | ✅ 完成（8fa6dc75） |
| 类别一：store barrel 重导出（266 项） | 方案 B：1a 验证 → 1b 迁移 → 1c 删死重导出 | ✅ 完结（见下） |
| other-desktop 残留桶（32 项） | 同等严格交叉验证后只删真死代码 | ✅ 完成（b1571f25） |
| 类别二：组件 prop 导出（288 项） | 方案 B 四批全处理 | ⏸ 待用户指令启动 |

---

## 类别一（store barrel）全过程记录

### 背景（调研结论，2026-08-16 上午）

- knip 标记 11 个 store 文件 266 项：两个兼容 barrel（editorFeatureStore 108 项、editorUIStore 19 项死重导出）+ 子 store 零消费 selector hooks
- 交叉验证：222 项全仓零消费（含测试），44 项符号经直连路径存活；barrel 的全部消费者只导入组合 hook（useEditorFeatureStore ×21 / useEditorUIStore ×27）
- 消费者迁移（原计划 H4.5/H5.4）此前仅完成约 3 个生产文件

### 阶段 1a：双状态源风险验证 —— 判断被证伪（d1120899）

**原始风险假设**（调研文档初稿 §1.5/§4.4）："组合 store 与子 store 是两份独立状态副本，迁移漏改会出现双状态源 bug"，风险评级"中"。

**验证过程**：
1. 按用户指令先写专项测试再迁移
2. 读取子 store 文件后发现：**8 个 H4/H5 子 store 均不自建 zustand store**，只 re-export 组合 hook 并在同一实例上提供 selector hooks（佐证：全仓 `from 'zustand'` 的 20 个文件中无任何子 store）
3. 新增 `apps/desktop/src/store/storeMigrationSafety.test.ts`（14 测试）：8 个 hook 引用同一性 + feature/UI 两侧双向"经 A 写入、经 B 读取可见" + 跨别名状态快照同一对象 —— 14/14 通过
4. 该测试同时是 1b 迁移的回归护栏：任何子 store 未来改为自建实例会立即失败

**错误根因与纠正**：调研时只读了 editorFeatureStore.ts:337 的 `create()` 即下结论，未读子 store 文件内容。风险评级据证据由"中"下调为"低"（剩余风险仅为导入路径/标识符笔误，typecheck 编译期可完全捕获）。错误论断以删除线 + 【已订正】标注保留在调研文档中（5c0f6fa1），保持可追溯。

### 阶段 1b：消费者迁移（3cac231e + b174bf8f）

- **基数修正**：原"48 个文件"系高估（含子 store 自身与测试）。权威清单：feature 16 + UI 24 = 40 条导入，去重后 26 个文件（14 文件同时消费两个 barrel）
- 批次 1（feature，16 文件）：按域计数自动选择目标子 store（OperationRecording→timeline×59、StoreSubscriptions→media×74 等），2 处平局按语义裁定
- 批次 2（UI，24 文件）：21 个→dialogStore，App.tsx 与 ViewSettingsCallbacks→panelStore；含 e2e/install-mocks.ts 与 EditorShell.integration.test.ts
- 两批均为纯重命名迁移（133/133、219/219 行对称变更），codemod 内置冲突断言
- 验证：批次 1 跑 22 文件 224 测试；批次 2 跑 33 文件 357 测试；typecheck 两批通过
- 排除项（未迁移）：4 个 feature 子 store + dialogStore/panelStore 自身（barrel 机制组成部分）、3 个 barrel 自测试（测试对象就是 barrel）

**1b 遗留发现（未处理，待裁决）**：15 个测试文件的 `vi.mock('../../store/editorUIStore'|'../../store/editorFeatureStore')` 仍打在旧 barrel 路径上，迁移后不再拦截生产导入（测试仍全部通过，unhandled rejection 经 A/B 对照证实为存量；但 mock 失效使这些测试实际跑真实 store 链路，测试意图弱化）。清单见 `docs/evidence/`（grep `vi.mock.*store/editor`）。

### 阶段 1c：删除 127 项死重导出行（本 commit）

1. **删除前复核**：重跑 knip 确认 108 + 19 = 127 项仍为零消费；专项扫描器验证 127 项无任何"从 barrel 路径导入"的消费者，3 个 barrel 自测试仅导入保留符号（evidence: `docs/evidence/phase5-1c-pre-delete-verify-2026-08-16.txt`）
2. **删除**：
   - editorFeatureStore.ts：移除全部 4 个子 store 重导出块（108 项），保留组合 hook 与 EditorFeatureState
   - editorUIStore.ts：移除重导出段（19 项），仅保留仍有消费的 `DialogKey` 类型重导出（knip 未标记项，不在删除授权内）
   - 两文件头部注释同步更新（不再自称 barrel re-export entry point）
3. **数字对账**：knip 总量 586 → 449，diff 精确核对 = barrel 恰好 127 项 + other-desktop 11 项（b1571f25 的 9 授权 + 2 连带）+ 新增 1 项（markActiveTasksAsFailed，1b 删除 hook 的已预判连带，留待下轮处理）
4. **完整验证**：typecheck ✓；全量单测 625 文件 / 11234 通过（3 skipped，0 失败）✓；全量 e2e 结果见汇报
5. **保留物**（用户裁决）：3 个 barrel 自测试、组合 hook 本身（useEditorFeatureStore/useEditorUIStore）、6 个 store 文件的 re-export 链未动

---

## 类别二（组件 prop 导出，288 项）全过程记录（2026-08-16 晚）

### 前置：vi.mock 路径修复（fdcf1f43）

1b 迁移后 15 个 hooks 测试文件的 `vi.mock` 仍打在旧 barrel 路径上（拦截失效、测试意图弱化）。修复：
- 13 个文件：mock 路径改到生产代码实际导入的子 store（dialogStore/panelStore/aiFeatureStore/mediaFeatureStore/timelineFeatureStore）+ 符号重命名；结构断言 63 对 mock/import 路径全对齐
- 2 个文件（FloatingDialogsCallbacks/PanelCallbacks）：生产文件无任何 store 运行时依赖，barrel mock 为纯残留 → 删除
- 拦截生效验证：Profiler 测试破坏 selector mock → 测试立即失败（行为学证明生产读的是 mock）；Effects/Interactions 用例不触及 store 调用路径（用例窄，结构对齐保证拦截）
- 验证：hooks 套件 20 文件 187 测试全过；typecheck 过
- codemod 中途暴露 CRLF 行尾坑与 PanelCallbacks 的 editorStore mock（范围外，未动）

### B1：死重导出行（5023cbd4）

- 文档预估 ~105 项实测为 **86 项**（预估把非 components/ 的重导出项计入，如实修正）
- 3 文件：InspectorEditors（62）、TimelineParts（23）、EmotionCurveChart（1）；整删 4 条语句 + 修剪 6 条
- 验证：420 组件/store 测试过；knip 449→363（−86 精确对账）

### B2：多余 export 关键字（fea9323d）

- 词频复核后实际处理 **136 项**（原估 160：其中 66 项 ownfile-unused 转 B4、lazyComponents 42 项转 B4）
- 24 文件；含 PreviewCanvas/types.ts 的无 from 本地类型导出句整删
- **两次事故与修复**（如实记录）：
  1. prefix 正则误伤 `export type { X };` 形态 → TS2457，人工修复 + 全仓排查无同类
  2. 首次 commit 因 `prettier --write` glob 把 components/ 全部 130 文件重排（+8820 行无关改动，违反"禁止全仓 format"）→ reset 重做，剥离为 24 个语义文件
- 验证：typecheck（真实退出码）+ 265 组件测试；knip 363→227（−136，集合级 diff 全部来自预期文件、无新增）

### B3：重复定义收敛（1a3434c8）

- **逐行 diff 结论（用户停止点核查）**：8 对死副本 vs 活副本全部语义等价（5 对逐行相同、3 对仅差 export 前缀、TextAreaField 仅差声明形式）；CurveEditors↔KeyframeCurveEditor 26 个同名定义中 25 个逐行等价、clampUnit 逐字相同、KeyframeCurveEditor 组件唯一差异是一条注释语言（非行为分歧，收敛保留中文注释版）→ **无行为分歧，未触发停止**
- 执行：删 8 个死副本（InspectorEditors 2 / EffectEditors 3 / ColorEditors 3）；KeyframeCurveEditor.tsx 以 TS AST 精确删除 25 个重复定义改为从 CurveEditors 导入（948→约 400 行）；CurveEditors 25 个共享符号恢复导出
- **事故与修复**：首次用括号平衡启发式删除导致语法损坏（clampUnit 单行 const 块判定吞并后续函数）→ 回滚两文件，改用 TypeScript AST API 精确定位后成功
- 验证：typecheck + 265 测试；净删 759 行；knip 227→219

### B4：真死代码（5ab20070）

- 58 项逐项复核（**复核器自身两次翻车均被识别并修正**：Windows cmd 下 shell grep 路径失效产生全 DEAD 假象 → 改 Node 原生遍历；纯标识符匹配对 lazyComponents 产生 48 个假 KEEP → 结合 knip 模块级信号 + EditorShell 消费清单 + 人工查证逐一澄清为路径字符串/同名私有副本碰撞）
- 删除：lazyComponents 42 个死 wrapper、2 个 default 导出行、8 个常量、AudioWaveformDisplay/HighlightOverlay 等组件、曲线色彩轮 3 个死副本、SpeedCurveEditor 死副本等
- 附带发现：`drawColorWheel` 存在 **4 份私有副本**（ColorEditors/ProfessionalColorGradingPanel/LutEditorDialog 三份活 + CurveEditors 一份死已删），三份活副本的归一留作后续
- **该判断后续被更正（见下节）**：实际为 2 份等价 + 1 份同名异功能，非三份重复
- 验证：typecheck + 265 测试；knip 219→162，**components/ 桶 288→0**

### 类别二总账

B1 86 + B2 136 + B3 8 + B4 58 = **288 项，与调研清单精确闭合**。

### 最终完整验证（1c 同规格，2026-08-16）

- typecheck：exit 0（真实退出码）
- 全量单测：625 文件 / **11234 通过**（3 skipped，0 失败；2 个 unhandled errors 为已 A/B 定性的存量错误路径 rejection）
- 全量 e2e：**522 通过**（31.2 分钟，exit 0；证据 `docs/evidence/phase5-cat2-e2e-2026-08-16.txt`）
- knip 终值：**162 项**（类别二开始前 449 → 162；components/ 桶归零；剩余为类别三已裁决保留范围外的新死代码候选，如 markActiveTasksAsFailed）

---

## 其他工作线摘要

| Commit | 内容 |
|--------|------|
| b1e2434a | docs: 修正调研文档 4 处数字口径缺陷 + editor-core 132 笔误 |
| 8fa6dc75 | chore: 类别三方案 A 采纳；knip.json `ignoreIssues` 静默 206 项（验证 792−206=586） |
| b1571f25 | chore: other-desktop 残留桶 32 项交叉验证，删除 9 项真死代码（净删 372 行）；2 项"有消费者"判定更正为扫描器名字碰撞假阳性 |
| 5c0f6fa1 | docs: 订正被证伪的双状态源论断（删除线保留原文） |

---

### 色彩轮"3 份副本"的误判与更正（2026-08-17，用户裁决 B）

B4 汇报曾把 drawColorWheel 归为"3 份活私有副本"。逐行 diff（证据 `docs/evidence/phase5-tail1-diff-2026-08-17.txt`）更正：**同名不等于重复**——

- **ColorEditors ↔ LutEditor 两份语义等价**：drawColorWheel/wheelPointToOffsets 逐行相同；eventToUnitPoint 仅 if/三元风格差异；hsvToRgb 仅变量名差异（t vs tt）；另含内部依赖 clampSigned/wheelOffsetsToPoint
- **ProfessionalColorGradingPanel 是同名异功能独立实现**：双轴 r/b 模型（无 g 通道，返回 Partial）、HSL 色相扇区绘制（非 HSV 像素级 ImageData）、y 轴取反且无长度归一化、React.PointerEvent 签名——三个函数均与另两份行为不同

**误判根因**：B4 复核用纯标识符匹配（同名即算副本）未做逐行验证。本项目第三次同类教训（ASRState/StyleSummary 名字碰撞、lazyComponents 假 KEEP、本次），方法论结论：**同名符号必须逐行 diff 后才能定性为重复**。

**处理（裁决 B，一个 commit）**：
1. 等价两份归一到 `apps/desktop/src/lib/color-wheel.ts`（单一来源：导出 drawColorWheel/eventToUnitPoint/wheelPointToOffsets，私有 hsvToRgb/clampSigned/wheelOffsetsToPoint），ColorEditors 与 LutEditor 改为导入
2. ProfessionalColorGradingPanel 三函数纯改名消歧（行为零改动）：drawColorWheel→drawHslWheel、wheelPointToOffsets→biaxialPointToOffsets、eventToUnitPoint→eventToBiaxialPoint（定义+调用点各 x2，无遗漏）
3. 验证：typecheck ✓ + 265 组件测试 ✓

---

## 待用户裁决的遗留项

1. ~~15 个测试文件的 barrel 路径 vi.mock 脱靶~~（已修复，fdcf1f43）
2. **markActiveTasksAsFailed**：useVideoGeneration hook 删除后成为新死代码（knip 已标记）
3. ~~类别二（288 项）四批清理~~（已完成）
4. 组合 hook（useEditorFeatureStore/useEditorUIStore）已无外部消费者，是否最终退役另行裁决
5. ~~drawColorWheel 3 份活副本归一~~（已完成，见「色彩轮误判与更正」节）

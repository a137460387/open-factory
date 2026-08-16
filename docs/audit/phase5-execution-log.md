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

## 其他工作线摘要

| Commit | 内容 |
|--------|------|
| b1e2434a | docs: 修正调研文档 4 处数字口径缺陷 + editor-core 132 笔误 |
| 8fa6dc75 | chore: 类别三方案 A 采纳；knip.json `ignoreIssues` 静默 206 项（验证 792−206=586） |
| b1571f25 | chore: other-desktop 残留桶 32 项交叉验证，删除 9 项真死代码（净删 372 行）；2 项"有消费者"判定更正为扫描器名字碰撞假阳性 |
| 5c0f6fa1 | docs: 订正被证伪的双状态源论断（删除线保留原文） |

---

## 待用户裁决的遗留项

1. **15 个测试文件的 barrel 路径 vi.mock 脱靶**（1b 连带发现，见上）
2. **markActiveTasksAsFailed**：useVideoGeneration hook 删除后成为新死代码（knip 已标记）
3. **类别二（288 项）四批清理**：等启动指令
4. 组合 hook（useEditorFeatureStore/useEditorUIStore）已无外部消费者，是否最终退役另行裁决

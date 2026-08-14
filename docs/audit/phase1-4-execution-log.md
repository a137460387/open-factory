# 阶段一至四执行日志

> 开始时间：2026-08-13
> 基线：main @ 4b411705（PR #138 合并后）
> knip 基线：113 文件，827 项（656 exports + 171 types）
> 原始 knip JSON：docs/evidence/knip-2026-08-13-post-PR138.json

---

## 阶段一：死代码导出清理

### 总体策略
- 交叉验证方法：knip 信号 + 全仓 grep 搜索导出名，排除自身 export 声明，仅保留真实 import/调用引用
- 排除规则：同文件内自用（仅 export 多余）、有测试消费者、有跨文件消费者、公共 API barrel
- 不处理三大类：store barrel 重导出（~260 项）、组件 prop 导出（~250 项）、公共 API barrel（~120 项）

### 批次 A：非 desktop 包
- **Commit**: f3da3cd6
- **候选**: 10 文件，23 项
- **确认死代码**: 7 项 / 5 文件
- **排除**: 16 项（7 项有测试消费者，9 项同文件内自用仅 export 多余）
- **验证**: typecheck 全量通过，plugin-market 17/17 passed，api-gateway 43/43 passed
- **删除明细**: formatRelativeDate(plugin-market), StdinOptions/addStdinOptions(cli), generateRefreshToken(api-gateway), canAccessResource(api-gateway), formatRelativeTime/seededColor(creator-dashboard)

### 批次 B：apps/desktop 1-2 项小文件
- **Commit**: 401d9430
- **候选**: 15 文件，20 项（排除组件/tauri-bridge/UI/i18n 后）
- **确认死代码**: 4 项 / 4 文件
- **排除**: 16 项（modelManager 被 ai-generator 使用，VersionWatermarkMode/VersionRangeMode 被 ExportVersionBatchSection 使用，ASRState 被 useSubtitleWorkflow 使用，其余 12 项同文件内自用）
- **删除明细**: formatExportRangeSummary(pipelineHelpers), readMediaHealthAutoShowEnabled(mediaHealthDashboard), readAutosaveIntervalSeconds(projectFiles), aiScheduler(priority-scheduler)

### 批次 C：apps/desktop 3-7 项中等文件
- **Commit**: feaa5bf1
- **候选**: 5 文件，22 项（排除组件/tauri-bridge/UI/store 后）
- **确认死代码**: 10 项 / 3 文件
- **排除**: 12 项（runProxyGenerationWarmup/waitForExportTasks/runCompletionAction 被 useExportActions 使用，useVideoGeneration 被 video-gen-runner 使用，StyleSummary 被 editor-core 使用，其余 6 项同文件内自用）
- **删除明细**: createHardwareDecodeManager/detectHardwareCapabilities/isBackendAvailable(hw-decode-manager), findMatchingCluster/createDefaultStorage(style-model-manager), saveGenerationEntry/getGenerationHistory/getGenerationEntry/deleteGenerationEntry/clearGenerationHistory(generation-history-db)

### 批次 D：packages/editor-core 类型/接口
- **Commit**: a20d1e92
- **候选**: 21 文件，53 项
- **确认死代码**: 14 项 / 4 文件
- **排除**: 39 项（大部分有跨文件消费者或同文件内自用）
- **删除明细**: ClipTrimParams/ClipSplitParams/ColorCorrectParams/SpeedChangeParams/VolumeAdjustParams(macro-types), createMacroStorage/getMacroStorage(macro-storage), createWorkflowExecutor(workflow-executor), createTemplateBlob/downloadTemplate/importTemplateFromFile/initTemplateLibrary/exportUserTemplates/importUserTemplatesBundle(template-io)

### 阶段一总计
- **删除**: 35 项 / 16 文件
- **Commits**: f3da3cd6, 401d9430, feaa5bf1, a20d1e92
- **保留未处理**: ~630 项（store barrel ~260 + 组件 prop ~250 + 公共 API ~120）

---

## 阶段二：低覆盖率文件清单

## 阶段二：低覆盖率文件清单

- 聚焦 useEditorShell* 编排层 0% 覆盖文件
- 识别 12 个文件，约 4,198 行
- 按被依赖广度、变更频率、代码行数排序为 P0-P3 四级
- 详细报告：docs/audit/phase2-coverage-priority.md

## 阶段三：React 18/19 依赖分裂调研

- plugin-market 单独锁 React 18（使用 Next.js 15，升级到 19 可行性高）
- 56 个重复版本中，7 个需要统一（react、react-dom、@types/react、@types/react-dom、scheduler、tailwindcss、vite），其余为无害传递依赖
- 推荐方案 A：统一到 React 19（0.5-1 天工作量）
- 详细报告：docs/audit/phase3-react-version-research.md

## 阶段四：云端包群存废 + 端点边界调研

- 9 个云端包，929 文件，约 280K 行，与 desktop 零耦合
- 硬编码端点：更新器（已可配置）、AI 供应商目录（15 个 URL，部分可配置）、导出预设同步（不可配置）
- 详细报告：docs/audit/phase4-cloud-and-endpoints.md
- **状态：等待维护者裁决**

---

## 阶段一至四完整总结

### Commits（阶段一，本地未 push）

| Commit | 批次 | 内容 |
|--------|------|------|
| 1d65b4a0 | — | docs: add audit trail files (untracked backlog) |
| f3da3cd6 | A | chore: remove dead code batch A - non-desktop packages (7 exports) |
| 401d9430 | B | chore: remove dead code batch B - apps/desktop small files (4 exports) |
| feaa5bf1 | C | chore: remove dead code batch C - apps/desktop medium files (10 exports) |
| a20d1e92 | D | chore: remove dead code batch D - editor-core types/exports (14 exports) |

### 阶段一删除统计

- 总计删除：35 项 / 16 文件
- 仍保留未处理：~630 项（store barrel ~260 + 组件 prop ~250 + 公共 API ~120）

### 产出文件

- docs/audit/phase1-4-execution-log.md（本文件）
- docs/audit/phase2-coverage-priority.md
- docs/audit/phase3-react-version-research.md
- docs/audit/phase4-cloud-and-endpoints.md
- docs/evidence/knip-2026-08-13-post-PR138.json
- docs/evidence/knip-2026-08-13-post-PR138-stderr.txt

### 待用户裁决

1. 阶段四 #10：云端包群存废（选项 A/B/C）
2. 阶段四 #11：端点边界执行力度（选项 A/B/C）
3. 阶段一 commit 是否 push 到远程
4. 阶段二是否开始补测试（当前仅产出清单，未写测试代码）
5. 阶段三是否执行 React 19 统一

---

## 任务 2：P0 测试（useEditorShell）

### P0-1：useEditorShellOrchestrator
- **Commit**: e51f0d79
- **测试**: 2 tests passed（smoke + unique refs）
- **覆盖提升**: 0% → 基本 smoke 覆盖（函数返回结构 + 回调唯一性）

### P0-2：useEditorShellCallbacks
- **Commit**: f5765321
- **测试**: 3 tests passed（useProjectHealthCallbacks 回调函数存在性 + setter 调用 + UI 状态触发）
- **覆盖提升**: 0% → 基本 smoke 覆盖（核心回调验证）

---

## 任务 3：React 19 统一

- **Commit**: 72ef2ab5
- **变更**: plugin-market react/react-dom 18.3.0 → 19.1.0, @types/react 18.3.0 → 19.1.8
- **验证**: typecheck 全量通过，plugin-market 17/17 tests passed
- **docs/developer**: 未升级（Docusaurus 3.7 兼容性风险，与主应用无关）

---

## 任务 4：AI 供应商 URL 配置化（#11 方案 B）

- **Commit**: db4cb8a1
- **变更**: 15 个硬编码 baseUrl 从 ai-service.ts 提取到 ai/ai-providers.ts
- **行为不变**: BUILT_IN_PROVIDER_PRESETS 仍从 ai-service.ts 导出，类型 re-export 保持兼容
- **验证**: typecheck 全量通过，AI 测试文件兼容（import 路径不变）

---

## 任务 5：云端包群迁移方案（#10 方案 C）

- **产出**: docs/audit/phase4-migration-plan.md
- **内容**: 6 个包迁移步骤、git 历史保留方案、workspace 引用处理、3.5 天工作量预估
- **状态**: 仅方案文档，未执行任何迁移操作

---

## 最终总结

### 全部 Commits（按时间序）

| Commit | 说明 |
|--------|------|
| 1d65b4a0 | docs: add audit trail files |
| f3da3cd6 | chore: dead code batch A (7 exports) |
| 401d9430 | chore: dead code batch B (4 exports) |
| feaa5bf1 | chore: dead code batch C (10 exports) |
| a20d1e92 | chore: dead code batch D (14 exports) |
| e51f0d79 | test: P0-1 orchestrator smoke test |
| f5765321 | test: P0-2 callbacks smoke test |
| 72ef2ab5 | deps: React 19 unification |
| db4cb8a1 | refactor: AI provider URLs to config |

### 产出文件

- docs/audit/phase1-4-execution-log.md
- docs/audit/phase2-coverage-priority.md
- docs/audit/phase3-react-version-research.md
- docs/audit/phase4-cloud-and-endpoints.md
- docs/audit/phase4-migration-plan.md
- packages/editor-core/src/ai/ai-providers.ts
- apps/desktop/src/hooks/__tests__/useEditorShellOrchestrator.test.ts
- apps/desktop/src/hooks/__tests__/useEditorShellCallbacks.test.ts

### 待 CI 核对

PR #139 正在运行 CI，核对标准：rust pass + frontend 仅已知 fast-uri + e2e 仅已知 flaky。
---

## 最终收尾

- **PR #139 已合并**: merge commit `a9fc15a0`（2026-08-13）
- **远程分支**: `chore/phase1-dead-code-cleanup` 已通过 gh 自动删除
- **本地分支**: 已删除，当前在 `main`

### 本轮任务完成状态

| 任务 | 状态 | 说明 |
|------|------|------|
| 阶段一 死代码清理 | ✅ 已合并 | 35 项 / 16 文件，4 批次，PR #139 |
| 阶段二 P0 测试 | ✅ 已完成 | P0-1/P0-2 已写入，P1-P3 未处理 |
| 阶段三 React 19 | ✅ 已合并 | 仅 plugin-market 升级 |
| #11 端点配置化 | ✅ 已合并 | ai-providers.ts 提取 |
| #10 迁移方案 | ✅ 已产出 | 仅文档，未执行迁移 |
| 其他待裁决 | ⏳ 等待 | store barrel(~260) + 组件prop(~250) + 公共API(~120) 未处理 |
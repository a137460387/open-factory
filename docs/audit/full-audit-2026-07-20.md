# Open-Factory 全量审计报告

**审计日期**: 2026-07-20  
**项目版本**: v4.41.0  
**审计范围**: 全量源码（apps/desktop, packages/editor-core, packages/plugin-sdk）

---

## 1. 项目概览

| 指标 | 数值 |
|------|------|
| 源文件总数 | 1,566 |
| 总代码行数 | ~143,115 (含注释/空行) |
| 测试文件 | 421 |
| 测试用例 | 6,995 |
| 技术栈 | React + TypeScript + Tauri + Bun |
| 包管理 | Bun workspaces (monorepo) |

---

## 2. TypeScript 类型检查

**结果: PASS**

`tsc -b` 编译通过，零错误。

---

## 3. 单元测试与覆盖率

**结果: PASS**

| 指标 | 数值 | 阈值 | 状态 |
|------|------|------|------|
| 测试文件 | 421 passed | - | OK |
| 测试用例 | 6,995 passed | - | OK |
| Lines | 91.31% | 80% | OK |
| Functions | 86.78% | 80% | OK |
| Branches | 93.65% | 80% | OK |
| Statements | 91.31% | 80% | OK |

### 低覆盖率模块（<80%）

| 模块 | 覆盖率 |
|------|--------|
| src/collaboration | 51.49% |
| src/sync | 68.64% |
| src/ai | 79.41% |

**证据**: `docs/audit/test-raw-2026-07-20.txt`

---

## 4. 死代码扫描 (knip)

**结果: WARN — 425 个未使用导出，77 个未使用类型**

### 未使用导出分布（Top 文件）

| 文件 | 未使用导出数 |
|------|-------------|
| `InspectorEditors.tsx` | ~60+ |
| `editorFeatureStore.ts` | ~80+ |
| `aiFeatureStore.ts` | ~20+ |
| `dialogStore.ts` | ~5+ |
| `editor-core` 各模块 | ~200+ |

### 未使用文件（knip 报告）

knip 报告约 18 个文件整体未被引用（worker 文件、store 文件等），可能是：
- 测试专用 mock 文件
- 动态导入未被静态分析捕获
- 确实是死代码

**证据**: `docs/audit/knip-raw-2026-07-20.txt`

---

## 5. 安全审计

### 5.1 依赖漏洞

**结果: PASS**

`bun audit` 报告零漏洞。

### 5.2 硬编码密钥扫描

**结果: PASS**

未发现硬编码的 API key、secret、password 或 token。所有密码相关代码均为：
- WebDAV 密码通过 `readWebdavPassword()` 动态读取
- 项目加密密码为用户输入（UI 表单）
- `maxTokens` 为 LLM 调用参数，非敏感信息

### 5.3 XSS 风险

**结果: PASS (已修复)**

发现 2 处 `dangerouslySetInnerHTML`，均已使用 `DOMPurify.sanitize()` 处理：
- `InspectorEditors.tsx:2040` — 富文本编辑器预览
- `ProjectDocumentationPanel.tsx:96` — Markdown 渲染预览

### 5.4 环境变量使用

**结果: PASS**

仅使用 `import.meta.env.DEV` 和 `import.meta.env.VITE_E2E`，为 Vite 标准用法，无敏感信息泄露风险。

---

## 6. 代码质量

### 6.1 格式化

**结果: FAIL**

`prettier --check` 报告 **155 个文件**存在格式问题。需执行 `bun run format` 修复。

### 6.2 大文件（>500 行）

| 行数 | 文件 |
|------|------|
| 11,564 | `apps/desktop/src/i18n/strings.ts` |
| 8,331 | `apps/desktop/src/e2e/install-mocks.ts` |
| 7,180 | `packages/editor-core/src/commands/timeline-commands.ts` |
| 5,526 | `apps/desktop/src/settings/SettingsDialog.tsx` |
| 5,144 | `apps/desktop/src/export/ExportDialog.tsx` |
| 4,125 | `apps/desktop/src/components/MediaBin/MediaBin.tsx` |
| 3,647 | `apps/desktop/src/components/Inspector/InspectorEditors.tsx` |
| 3,509 | `apps/desktop/src/components/Timeline/useTimelineHandlers.ts` |
| 3,338 | `apps/desktop/src/components/PreviewCanvas/PreviewCanvas.tsx` |
| 3,236 | `apps/desktop/src/components/Inspector/ClipInspectorBody.tsx` |

共 **25 个文件**超过 500 行，其中 10 个超过 3000 行。

### 6.3 空 catch 块

发现 **196 处** `} catch {` 空 catch 块（无 error 参数），错误被静默吞掉。

对比：带错误参数的 catch 块有 **464 处**。

### 6.4 `any` 类型使用

发现 **129 处** `any` 类型使用（`as any`、`: any`、`<any>`）。

### 6.5 TypeScript 抑制指令

发现 **1 处** `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`。

### 6.6 TODO/FIXME

发现 **0 处** TODO/FIXME 注释（代码中无遗留标记）。

---

## 7. 综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | A | tsc 零错误 |
| 测试覆盖 | A- | 整体 91%，3 个模块低于 80% |
| 依赖安全 | A | 零漏洞 |
| 代码卫生 | C+ | 425 未使用导出，196 空 catch，129 any |
| 格式一致性 | B- | 155 文件未格式化 |
| 文件组织 | C | 25 文件超 500 行，10 文件超 3000 行 |
| XSS 防护 | A | DOMPurify 全覆盖 |

**总体评级: B+**

---

## 8. 建议修复优先级

### P0 — 立即修复
1. **运行 `bun run format`** 修复 155 个文件的格式问题

### P1 — 短期修复
2. **补充 collaboration/sync 模块测试**，覆盖率从 51%/68% 提升至 80%+
3. **清理空 catch 块**，至少记录错误日志（196 处）
4. **清理未使用导出**，分批处理 425 个死代码项

### P2 — 中期优化
5. **拆分超大文件**，InspectorEditors.tsx (3647行)、ExportDialog.tsx (5144行) 等
6. **减少 any 类型**，129 处逐步替换为具体类型
7. **审查 knip 报告的 18 个未使用文件**，确认是否可删除

### P3 — 长期改进
8. **i18n/strings.ts (11564行)** 考虑按语言拆分
9. **timeline-commands.ts (7180行)** 考虑按命令类别拆分模块

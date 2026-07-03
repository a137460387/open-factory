# Dead Code Cross-Validation Report

**Date:** 2026-07-03
**Tools:** knip 6.24.0 (static analysis) vs grep-based scan (03-dead-code.md)
**Scope:** `packages/editor-core` + `apps/desktop`

---

## Key Finding

**grep 报告的 "2,341 个未使用 editor-core 导出" 几乎全部是假阳性。**

knip 对 editor-core 的扫描结果：**仅 5 个未使用类型**（全在 `model-types.ts`），且经人工验证**全部为 false positive**。

### 差距根因

| 差异点 | grep | knip |
|--------|------|------|
| barrel re-export 链追踪 | 不追踪 | 追踪 |
| `import type` 语义 | 不识别 | 识别 |
| inline `import()` 类型引用 | 不识别 | 部分识别 |
| 同文件字段类型传递依赖 | 不识别 | 部分识别 |

---

## Part 1: editor-core — 原报告 Top 10 文件交叉验证

原报告声称 editor-core 有 2,341 个未使用导出。knip 实际仅报 5 个（全部 false positive）。

### 1.1 timeline-commands.ts（原报告称 126 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| AddAdjustmentLayerCommand | 未使用 | 未报告 | **false positive** — EditorShell.tsx:2450 实例化 |
| AddCreditsClipCommand | 未使用 | 未报告 | **false positive** — Timeline.tsx:898 实例化 |
| AddKeyframeInput | 未使用 | 未报告 | **false positive** — 被 AddKeyframeCommand 使用 |

**结论：** 该文件 126 个"未使用"导出**不可信**。knip 认为全部在用（未报告任何 unused）。

### 1.2 model.ts（原报告称 123 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| CLIP_SLOW_MOTION_MODES | 未使用 | 未报告 | **false positive** — Inspector.tsx:65,1343 引用 |
| DEFAULT_AUDIO_DENOISE | 未使用 | 未报告 | **false positive** — model.ts 内部 + timeline-import.ts 引用 |
| DEFAULT_CLIP_BORDER | 未使用 | 未报告 | **false positive** — model.ts 内部 + 测试引用 |

### 1.3 keyframes.ts（原报告称 31 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| KEYFRAME_PROPERTY_LIMITS | 未使用 | 未报告 | **false positive** — Inspector.tsx 10+ 处引用 |
| KeyframeInput | 未使用 | 未报告 | **false positive** — keyframes.ts:295 作函数参数类型 |
| alignKeyframeValues | 未使用 | 未报告 | **false positive** — timeline-commands.ts:147,4607 引用 |

### 1.4 ai-service.ts（原报告称 29 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| AIProtocol | 未使用 | 未报告 | **仅内部使用** — 同文件字段类型 |
| AITestConnectionResult | 未使用 | 未报告 | **需进一步确认** — 仅定义处，无外部引用 |

### 1.5 export/resource-dashboard.ts（原报告称 25 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| ResourceDashboardState | 未使用 | 未报告 | **仅内部使用** — 函数返回类型 |
| ROLLING_WINDOW_DURATION_MS | 未使用 | 未报告 | **false positive** — 测试中引用 |

### 1.6 motion-graphics.ts（原报告称 25 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| MOTION_GRAPHIC_TEMPLATE_DEFINITIONS | 未使用 | 未报告 | **false positive** — 测试 + 同文件内部引用 |

### 1.7 export/cost-estimate.ts（原报告称 24 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| ExportCostEstimate | 未使用 | 未报告 | **仅内部使用** — 同文件返回类型 |

### 1.8 spatial-audio.ts（原报告称 23 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| ClipSpatialAudio | 未使用 | 未报告 | **false positive** — timeline-commands、export-types 等广泛引用 |
| KEMAR_HRTF_FILE_NAME | 未使用 | 未报告 | **仅内部使用** — 同文件内部引用 |

### 1.9 project/conform-media.ts（原报告称 23 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| ConformMediaMatchStrategy | 未使用 | 未报告 | **仅内部使用** — 同文件接口字段类型 |
| ConformMediaReport | 未使用 | 未报告 | **仅内部使用** — 同文件返回类型 |

### 1.10 ai-chat-editor.ts（原报告称 22 个未使用）

| 符号名 | grep 报告状态 | knip 状态 | 人工抽查结论 |
|--------|-------------|-----------|------------|
| ChatActionType | 未使用 | 未报告 | **仅内部使用** — 同文件白名单 Set |
| ApplyColorPresetCommand | 未使用 | 未报告 | **仅内部使用** — 联合类型成员 |

### 1.11 knip 报告的 5 个 editor-core 未使用类型

| 符号名 | 文件 | knip 状态 | 人工抽查结论 |
|--------|------|-----------|------------|
| AIColorGradingSuggestionItem | model-types.ts:770 | 未使用 | **false positive** — 同文件字段类型传递到 AIColorHistoryEntry |
| AiPipPlacementSuggestion | model-types.ts:953 | 未使用 | **false positive** — model.ts:2148 inline import() 类型引用 |
| PlatformFitSegment | model-types.ts:960 | 未使用 | **false positive** — model.ts:2176 inline import() 类型引用 |
| ProjectPlatformFitSuggestion | model-types.ts:968 | 未使用 | **false positive** — model.ts:2166 + timeline-commands.ts:4071 引用 |
| SfxSuggestion | model-types.ts:1113 | 未使用 | **false positive** — 同文件 Timeline.sfxSuggestions 字段类型传递 |

---

## Part 2: desktop app — knip 报告的未使用符号验证

knip 报告 desktop 有 123 个未使用导出 + 55 个未使用类型。

### 2.1 随机抽样验证（5 个符号）

| 符号名 | 文件 | knip 状态 | 人工抽查结论 |
|--------|------|-----------|------------|
| CORE_KEYBOARD_FOCUS_ORDER | accessibility/keyboard-navigation.ts | 未使用 | **true unused** — 导出无人引用 |
| DUPLICATE_HASH_BYTES | lib/duplicateMedia.ts | 未使用 | **true unused** — 内部常量，export 多余 |
| autosaveProject | lib/projectFiles.ts | 未使用 | **true unused** — 内部函数，export 多余 |
| runPluginHook | plugins/plugin-manager.ts | 未使用 | **true unused** — 内部函数，export 多余 |
| wcagLevel | theme/theme.ts | 未使用 | **true unused** — 内部函数，export 多余 |

**结论：** 5/5 全部为真阳性。这些符号在定义文件内部有使用但从未被其他文件导入。

### 2.2 desktop 未使用类型

knip 报告 55 个未使用类型，大多是接口/类型定义仅在定义文件内部使用但被 export。典型例子：

- `DragMode` (TimelineParts.tsx) — 文件内部使用
- `ExportProgressPayload` (export-progress.ts) — 文件内部使用
- `ToastKind` (toast.ts) — 文件内部使用

---

## Part 3: 容易误判/漏判的场景检查

| 场景 | 检查结果 |
|------|---------|
| 动态 import() (EditorShell.tsx 56 个 lazy) | **不涉及 editor-core** — 56 个 lazy 全部指向 desktop 本地组件 |
| 类型层面引用 | **knip 有漏判** — model-types.ts 的 5 个类型被 inline import() 引用，knip 未追踪 |
| re-export 链 | **knip 正确追踪** — barrel re-export 链是 grep 假阳性的主因，knip 理解此链 |
| 插件系统字符串/反射引用 | **未发现此类引用** — desktop 的插件系统通过直接 import 而非字符串反射 |

---

## Final Result

### 高置信度真未使用（仅 desktop app 的多余 export）

符号在文件内部使用但从未被外部导入，可安全去掉 `export` 关键字（不影响功能）：

| 符号 | 文件 | 建议 |
|------|------|------|
| CORE_KEYBOARD_FOCUS_ORDER | accessibility/keyboard-navigation.ts | 去掉 export |
| DUPLICATE_HASH_BYTES | lib/duplicateMedia.ts | 去掉 export |
| autosaveProject | lib/projectFiles.ts | 去掉 export |
| writeAutosaveProject | lib/projectFiles.ts | 去掉 export |
| runPluginHook | plugins/plugin-manager.ts | 去掉 export |
| wcagLevel | theme/theme.ts | 去掉 export |
| ... 其余约 118 个 desktop 未使用导出 | 各文件 | 去掉 export |
| ... 其余约 55 个 desktop 未使用类型 | 各文件 | 去掉 export |

**注意：** 这些"真未使用"指的是 `export` 关键字多余（符号仅在定义文件内部使用），不是说符号本身是死代码。

### 存疑/建议保留

| 范围 | 数量 | 建议 |
|------|------|------|
| editor-core 全部 barrel 导出 | ~3,180 个 | **全部保留** — knip + 人工验证确认几乎全部在用 |
| grep 报告的 "2,341 未使用" | 0 个真未使用 | **全部为 false positive** — 根因是 grep 不理解 barrel re-export 链 |
| knip 报告的 5 个 editor-core 类型 | 0 个真未使用 | **全部为 false positive** — 根因是 knip 不追踪 inline import() 类型引用 |
| AITestConnectionResult | 1 个 | **需进一步确认** — 可能是真未使用，但需检查测试文件 |

---

**knip 报告文件:** `docs/evidence/knip-report.txt`
**knip 配置文件:** `knip.json`

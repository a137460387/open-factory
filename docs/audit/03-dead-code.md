# Dead Code Detection Report

**Date:** 2026-07-03
**Updated:** 2026-07-03 (knip cross-validation + cleanup)
**Scope:** `apps/desktop/src` and `packages/`
**Methodology:** Automated grep-based analysis → cross-validated with knip 6.24.0

---

## Executive Summary

| Category | Severity | Count | Description |
|----------|----------|-------|-------------|
| Unused Barrel Exports (grep) | ~~CRITICAL~~ → **已撤销** | ~~2,341~~ → 0 | grep 假阳性，见 [交叉验证报告](./03-dead-code-cross-validation.md) |
| Desktop 多余 export（knip + 人工确认） | LOW | ~178 | 123 导出 + 55 类型仅内部使用，export 多余，已清理 |
| Internal-Only Files | HIGH | 6 | Files not in barrel but used internally (may need documentation) |
| Commented-Out Code | MEDIUM | 0 | No dead code found in comments |

**Key Findings:**

1. **grep 报告的 "2,341 未使用 editor-core 导出" 全部为假阳性。** knip 交叉验证 + 人工抽样确认 editor-core barrel 导出几乎全部在用。根因是 grep 无法追踪 barrel re-export 链和 `import type` 语义。详见 [03-dead-code-cross-validation.md](./03-dead-code-cross-validation.md)。

2. **仅 desktop app 存在真正多余的 export 关键字。** knip 检出 123 个未使用导出 + 55 个未使用类型，人工验证 5/5 全部为真阳性。这些符号在定义文件内部使用但从未被外部导入，已在 3 个 batch commit 中清理 `export` 关键字（代码本身保留）。

> **⚠️ 原始 grep 分析的准确性警告（已解决）**
>
> 原始 grep 分析存在严重假阳性。子代理在验证阶段发现以下样本均为误报：
>
> - `AddAdjustmentLayerCommand` — 报告标记"未使用"，但实际在 `EditorShell.tsx:32450` 有引用
> - `AddCreditsClipCommand` — 报告标记"未使用"，但实际在 `Timeline.tsx:4898` 有引用
> - `KEYFRAME_PROPERTY_LIMITS` — 报告标记"未使用"，但实际在 `Inspector.tsx` 多处引用
> - `CLIP_SLOW_MOTION_MODES` — 报告标记"未使用"，但实际在 `Inspector.tsx:64,1342` 有引用
>
> **根因：** grep 无法追踪 barrel re-export 链和 `import type` 语义。knip 等工具能正确追踪这些链路。
>
> **已通过 knip 交叉验证解决：** 详见 [03-dead-code-cross-validation.md](./03-dead-code-cross-validation.md)。

---

## Category 1: Unreferenced Files

**Result: 0 files**

All `.ts/.tsx/.vue` files in the scope are referenced via:
- Static imports in desktop app
- `lazy()` dynamic imports in `apps/desktop/src/components/EditorShell.tsx` (56+ lazy-loaded components)

No action required.

---

## Category 2: Unused Barrel Exports — grep 报告（已证伪）

> **⚠️ 本节数据已被 knip 交叉验证推翻，仅保留作为审计历史记录。**

### 原始 grep 分析

| Metric | Value |
|--------|-------|
| Source | `packages/editor-core/src/index.ts` |
| Barrel modules | 235 |
| Total exported symbols | 3,180 |
| Used by desktop app | 930 (26.4%) |
| **grep 报告未使用** | **2,341 (73.6%)** |
| **knip 确认未使用** | **0 (0%)** |

### 交叉验证结论

knip 对 editor-core 的扫描结果：**仅 5 个未使用类型**（全在 `model-types.ts`），且经人工验证**全部为 false positive**（knip 未追踪 inline `import()` 类型引用）。

差距根因：

| 差异点 | grep | knip |
|--------|------|------|
| barrel re-export 链追踪 | 不追踪 | 追踪 |
| `import type` 语义 | 不识别 | 识别 |
| inline `import()` 类型引用 | 不识别 | 部分识别 |
| 同文件字段类型传递依赖 | 不识别 | 部分识别 |

### Top 10 文件原报告摘要（仅供参考）

| # | File | grep 报告 | knip 验证 |
|---|------|-----------|-----------|
| 1 | timeline-commands.ts | 126 unused | 0 unused — 全部假阳性 |
| 2 | model.ts | 123 unused | 0 unused — 全部假阳性 |
| 3 | keyframes.ts | 31 unused | 0 unused — 全部假阳性 |
| 4 | ai-service.ts | 29 unused | 0 unused — 全部假阳性 |
| 5 | resource-dashboard.ts | 25 unused | 0 unused — 全部假阳性 |
| 6 | motion-graphics.ts | 25 unused | 0 unused — 全部假阳性 |
| 7 | cost-estimate.ts | 24 unused | 0 unused — 全部假阳性 |
| 8 | spatial-audio.ts | 23 unused | 0 unused — 全部假阳性 |
| 9 | conform-media.ts | 23 unused | 0 unused — 全部假阳性 |
| 10 | ai-chat-editor.ts | 22 unused | 0 unused — 全部假阳性 |

---

## Category 3: Desktop 多余 export（knip 真阳性，已清理）

### 分析结果

| Metric | Value |
|--------|-------|
| 未使用导出 | 123 |
| 未使用类型 | 55 |
| 总计 | 178 |
| 人工抽样验证 | 5/5 全部为真阳性 |
| 清理状态 | 已完成 — 3 个 batch commit |

### 清理方式

移除 `export` 关键字（不删除代码）。符号在定义文件内部仍被使用，仅不对外暴露。

### batch commits

- `78b44b4d` — chore(cleanup): remove unused export keyword (batch 1/3) — 17 files
- `71d741ef` — chore(cleanup): remove unused export keyword (batch 2/3) — 17 files
- `3938793d` — chore(cleanup): remove unused export keyword (batch 3/3) — 17 files

### 涉及文件（51 个）

<details>
<summary>展开查看完整文件列表</summary>

1. accessibility/keyboard-navigation.ts
2. audio-sync/AutoAudioSyncDialog.tsx
3. collaboration/local-network.ts
4. components/SmartRoughCut/smart-rough-cut-state.ts
5. components/Timeline/TimelineParts.tsx
6. effects/effect-preset-library.ts
7. export/codec-compare.ts
8. export/export-presets.ts
9. export/export-progress.ts
10. export/export-queue-persistence.ts
11. export/export-queue-runner.ts
12. export/export-rules.ts
13. export/export-warmup.ts
14. export/preset-market.ts
15. export/publish-pipeline-runner.ts
16. i18n/strings.ts
17. layout/layoutSettings.ts
18. lib/duplicateMedia.ts
19. lib/fonts.ts
20. lib/frameInterpolationComparePreview.ts
21. lib/lutLibrary.ts
22. lib/preview/frame-inspector.ts
23. lib/preview/gpu-acceleration.ts
24. lib/preview/preview-performance.ts
25. lib/preview/render-cache-controller.ts
26. lib/projectArchive.ts
27. lib/projectFiles.ts
28. lib/sharePackage.ts
29. lib/subtitleStyleTemplates.ts
30. lib/subtitles.ts
31. lib/toast.ts
32. macros/clip-macros.ts
33. media/background-media-task-queue.ts
34. media/batchWatermark.ts
35. media/media-job-store.ts
36. media/mediaLibraryView.ts
37. plugins/plugin-loader.ts
38. plugins/plugin-manager.ts
39. plugins/plugin-market.ts
40. projectBatch/projectBatch.ts
41. release/projectReleases.ts
42. scripting/timeline-scripts.ts
43. settings/appSettings.ts
44. settings/localModels.ts
45. shared-library/sharedLibrary.ts
46. shortcuts/keybindings.ts
47. store/aiSettingsStore.ts
48. store/proxySettingsStore.ts
49. store/recordingSettingsStore.ts
50. theme/theme.ts
51. updater/update-settings.ts

</details>

---

## Category 4: Internal-Only Files (HIGH)

6 files in `packages/editor-core/src/` are NOT in the barrel (`index.ts`) but are imported internally.

| File | Internal Imports | Desktop Refs | Status |
|------|------------------|--------------|--------|
| export/export-queue.ts | 5 | 17 | Used internally |
| export/export-types.ts | 16 | 0 | Type definitions for export module |
| export/ffmpeg-builder.ts | 1 | 0 | Internal helper |
| export/ffmpeg-escape.ts | 4 | 0 | Internal helper |
| export/post-export-script.ts | 2 | 0 | Internal helper |
| model-types.ts | 64 | 0 | Type definitions for model |

**Assessment:** Intentionally internal modules. Should NOT be added to barrel.

**Suggested action:** Add `@internal` JSDoc comments to clarify intent.

---

## Category 5: Commented-Out Code (MEDIUM)

**Result: 0 blocks found**

Scanned all `.ts/.tsx/.vue` files. Found 251 total comment lines, ALL are descriptive comments or section dividers.

**Assessment:** Codebase is clean. No dead code in comments.

---

## Recommendations

### Completed

- [x] Cross-validate grep report with knip — confirmed 2,341 editor-core exports are false positives
- [x] Clean up desktop app's ~178 unused export keywords (123 exports + 55 types)

### Remaining

- [ ] Document unbarreled editor-core files as intentional internal modules (`@internal` JSDoc)
- [ ] Add CI check for unused exports (knip)
- [ ] Periodic review of barrel surface area

---

**Report generated:** 2026-07-03
**Cross-validation:** [03-dead-code-cross-validation.md](./03-dead-code-cross-validation.md)
**knip config:** `knip.json`
**knip evidence:** `docs/evidence/knip-report.txt`, `docs/evidence/knip-output-2026-07-03.txt`

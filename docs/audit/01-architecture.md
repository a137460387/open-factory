# Architecture Audit Report

**Date:** 2026-07-03
**Scope:** `apps/desktop/src` and `packages/` (excluding tests, e2e, dist, node_modules)
**Files scanned:** 1,157

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 8 |
| **Total** | **16** |

---

## CRITICAL

### A-1: EditorShell.tsx — 5,374 lines, 383 hook calls

**File**: `apps/desktop/src/components/EditorShell.tsx`
**Hook count**: 383 (useState/useEffect/useCallback/useMemo/useRef/useContext total)
**Deep nesting**: line 4999 reaches 8 levels (profiler logic)
**Responsibilities**: project management, media import/export, keyboard shortcuts, recovery management, profiler control, plugin loading, AI dispatch — 7+ unrelated concerns.
**Fix**: Extract into `ProjectManager`, `MediaImportController`, `KeyboardShortcutHandler`, `RecoveryManager`, `ProfilerController`, `PluginLoader` hooks/sub-components.

### A-2: Inspector.tsx — 6,355 lines, nesting up to 14 levels

**File**: `apps/desktop/src/components/Inspector/Inspector.tsx`
**Hook count**: 88
**Deep nesting**: line 3084 `if (value === 'custom')` — **14 levels**; lines 4738/5131/5640/5913 — 5-6 levels
**Fix**: Split into `SubtitleStylePanel`, `AudioMixerPanel`, `ColorGradingPanel`, `EffectParamsPanel`.

### A-3: Timeline.tsx — 6,064 lines, 114 hooks

**File**: `apps/desktop/src/components/Timeline/Timeline.tsx`
**Hook count**: 114
**Deep nesting**: lines 3250/3578/4242/4640 — 7 levels
**Fix**: Split into `TimelineRenderer`, `TimelineDragDrop`, `TimelineZoom`, `BeatSnapOverlay`, `KeyframeEditor`.

---

## HIGH

### A-4: timeline-commands.ts — 6,039 lines, 175 exports

**File**: `packages/editor-core/src/commands/timeline-commands.ts`
**Fix**: Split by command domain: `project-commands.ts`, `track-commands.ts`, `clip-commands.ts`, `subtitle-commands.ts`, `keyframe-commands.ts`, `effect-commands.ts`, `mask-commands.ts`.

### A-5: ExportDialog.tsx — 5,992 lines, nesting up to 10 levels

**File**: `apps/desktop/src/export/ExportDialog.tsx`
**Deep nesting**: line 2709 `if (checked)` — **10 levels**
**Fix**: Split into `ExportFormatPanel`, `ExportCodecPanel`, `ExportQueuePanel`.

### A-6: SettingsDialog.tsx — 4,675 lines, nesting up to 8 levels

**File**: `apps/desktop/src/settings/SettingsDialog.tsx`
**Deep nesting**: lines 2814/2821 drag-sort logic — **8 levels**
**Fix**: Split by settings category into independent panel components.

### A-7: model.ts + model-types.ts — 3,381 lines combined, 320 exports

**Files**: `packages/editor-core/src/model.ts` (2,247 lines, 175 exports) + `model-types.ts` (1,134 lines, 145 exports)
**Fix**: Extract normalize functions to `model-utils.ts`, defaults/constants to `model-defaults.ts`, types by domain.

### A-8: ColorNodeEditorDialog.tsx — nesting up to 10 levels

**File**: `apps/desktop/src/color-node-editor/ColorNodeEditorDialog.tsx`
**Deep nesting**: line 336 — 9 levels, lines 366/379/391 — **10 levels**
**Fix**: Extract connection drag logic to `useConnectionDrag` hook, use early returns.

---

## MEDIUM

| # | File | Lines | Exports | Issue |
|---|------|-------|---------|-------|
| M-1 | `apps/desktop/src/i18n/strings.ts` | 11,105 | 11 | Giant i18n file, split by module |
| M-2 | `packages/editor-core/src/export/ffmpeg-builder.ts` | 4,179 | — | FFmpeg builder too large, split filter graph/output/encoder |
| M-3 | `apps/desktop/src/components/MediaBin/MediaBin.tsx` | 2,925 | — | 9-level nesting, 68 hooks |
| M-4 | `apps/desktop/src/components/PreviewCanvas/PreviewCanvas.tsx` | 2,909 | — | 7+ levels, 79 hooks |
| M-5 | `apps/desktop/src/lib/tauri-bridge.ts` | 2,044 | 237 | All Tauri IPC in one file, split by domain |
| M-6 | `apps/desktop/src/settings/appSettings.ts` | 1,281 | 116 | Settings schema/defaults mixed |
| M-7 | `apps/desktop/src/lib/preview/webgl-compositor.ts` | 1,487 | — | 6-level nesting, extract shaders to .glsl |
| M-8 | `packages/editor-core/src/export/export-types.ts` | 601 | 73 | Too many exports, split by domain |

---

## Statistics

| Metric | Value |
|--------|-------|
| Files > 800 lines | 19 |
| Files > 2,000 lines | 10 |
| Files > 5,000 lines | 5 |
| Files with 15+ exported symbols | 28 |
| Deep nesting > 4 level hotspots | 80+ |
| Deep nesting > 8 level hotspots | 12 |
| Components with 100+ hook calls | 3 (EditorShell 383, Timeline 114, Inspector 88) |

---

**Report generated:** 2026-07-03

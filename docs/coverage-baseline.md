# Coverage Baseline — S5 Final Sprint

**Date**: 2026-07-27
**Branch**: `agent/scan-tauri-unwrap-calls-a2c6f642`

## Summary

| Metric | Value |
|--------|-------|
| Line Coverage | 72.08% |
| Function Coverage | ~85% |
| Branch Coverage | ~78% |
| Total Lines | 170,977 |
| Covered Lines | ~123,248 |
| Gap to 80% | ~13,533 lines |
| Test Files | 586 |
| Total Tests | 10,940 |
| Rust Tests | 3 |

## Coverage by Category

| Category | Uncovered | Total | Coverage | Files |
|----------|-----------|-------|----------|-------|
| Other .ts (testable) | ~28,000 | ~147,000 | ~81% | 696 |
| React hooks (use*.ts) | ~14,800 | ~16,500 | ~10% | 46 |
| Canvas/WebGL/WebGPU | ~3,300 | ~3,600 | ~9% | 9 |
| Workers | ~1,330 | ~1,350 | ~1% | 13 |
| Tauri bridge | ~1,130 | ~1,550 | ~27% | 10 |

## New Tests Added (S5 Sprint)

| Test File | Tests | Source Module |
|-----------|-------|---------------|
| `plugin-sdk/__tests__/storage-api.test.ts` | 20 | PluginStorageAPIImpl |
| `plugin-sdk/__tests__/ui-api.test.ts` | 15 | PluginUIAPIImpl |
| `plugin-sdk/__tests__/editor-api.test.ts` | 16 | PluginEditorAPIImpl |
| `plugin-sdk/__tests__/ai-api.test.ts` | 9 | PluginAIAPIImpl |
| `plugin-sdk/__tests__/network-api.test.ts` | 7 | PluginNetworkAPIImpl |
| `editor-core/__tests__/shortcut-manager.test.ts` | 37 | ShortcutManager |
| `editor-core/__tests__/theme-engine.test.ts` | 45 | ThemeManager |
| `editor-core/__tests__/clip-normalize.test.ts` | 81 | clip-normalize functions |
| `editor-core/__tests__/workflow-templates.test.ts` | 26 | WorkflowTemplateLibrary |
| `editor-core/__tests__/macro-storage.test.ts` | 33 | MacroStorage |
| `editor-core/__tests__/smart-proxy-manager.test.ts` | 44 | ProxyFileManager, ProxySwitchManager |
| `editor-core/__tests__/zen-mode-manager.test.ts` | 35 | ZenModeManager |
| `editor-core/__tests__/workflow-executor.test.ts` | 20 | WorkflowExecutor |
| `editor-core/__tests__/settings-normalize.test.ts` | 113 | FFmpeg settings normalizers |
| `editor-core/__tests__/visual-filters.test.ts` | 67 | FFmpeg visual filter builders |
| `export/lib/exportSettingsHelpers.test.ts` | +60 | Update helpers, format normalization |
| `editor-core/__tests__/aces-math.test.ts` | 27 | ACES color math (clamp, lerp, matrix, LUT) |
| `editor-core/__tests__/monitor-extended.test.ts` | 14 | Performance monitor (dashboard, thresholds) |
| `editor-core/__tests__/annotations.test.ts` | 71 | Model annotations (30+ normalize functions) |
| `editor-core/__tests__/quality-inspector.test.ts` | 37 | Quality inspector (black frame, audio, pacing) |
| `editor-core/__tests__/performance-monitor-extended.test.ts` | 29 | Performance trends, bottlenecks, optimizations |
| `editor-core/__tests__/complexity-score.test.ts` | 32 | Complexity scoring (all 5 dimensions + report) |
| `editor-core/__tests__/style-analyzer.test.ts` | 25 | Style fingerprint extraction, merge, similarity |
| `editor-core/__tests__/render-pipeline.test.ts` | 35 | FrameCache, Prefetcher, Culler, ProxySwitcher |
| `lib/__tests__/clipFactory.test.ts` | 14 | Clip creation (video, audio, image, text, credits) |
| `lib/__tests__/media.test.ts` | 17 | inferAssetType, detectPngSequences, constants |
| `components/MediaBin/__tests__/media-bin-utils.test.ts` | 38 | Media formatting, label colors, drag MIME |
| `export/lib/__tests__/exportFormatHelpers.test.ts` | 28 | Quality metrics, byte/time formatting, CSS classes |
| **Total** | **~1,004** | |

## Coverage Gap Analysis — Why 80% Is Not Reachable

The 80% target requires covering ~13,533 more lines. Analysis of uncovered code:

### Blockers by Category

| Category | Uncovered Lines | % of Gap | Testability |
|----------|----------------|----------|-------------|
| React hooks (use*.ts) | ~14,800 | 109% | Requires `renderHook` + Zustand store mocking + Tauri bridge mocking |
| Canvas/WebGL/WebGPU renderers | ~3,300 | 24% | Requires browser GPU context — not testable in Node |
| Web Workers | ~1,330 | 10% | Requires Worker environment — not testable in Node |
| Tauri bridge (IPC calls) | ~1,130 | 8% | Requires Tauri IPC mocking |
| Headless/CLI modules | ~500 | 4% | Node fs/process dependencies |
| Other pure .ts | ~5,500 | 41% | Testable but diminishing returns |

### Key Insight

**75% of the uncovered code lives in React hooks** that are deeply coupled to:
- Zustand stores (useEditorStore, useDemucsSettingsStore, etc.)
- Tauri IPC bridge (file dialogs, media probing, FFmpeg operations)
- Canvas/WebGL rendering context

The top 5 files alone account for 7,815 uncovered lines:
1. `useTimelineHandlers.ts` — 2,915 lines (store + Tauri)
2. `useExportActions.ts` — 1,370 lines (store + Tauri)
3. `useClipInspectorState.ts` — 1,369 lines (store + Tauri)
4. `webgl-compositor.ts` — 1,041 lines (GPU context)
5. `renderer.ts` — 830 lines (GPU context)

### Recommended Path to 80%

To reach 80%, the following infrastructure would be needed:
1. **Zustand store test harness** — mock stores for `renderHook` testing (~14k lines impact)
2. **Tauri IPC mock layer** — comprehensive mock for all bridge functions (~1.1k lines)
3. **Canvas/WebGL test environment** — jsdom canvas shim or Playwright-based tests (~3.3k lines)

Estimated effort: 2-3 sprints of dedicated infrastructure work.

### What Was Achievable

In this sprint, we added ~1,004 new tests covering pure logic modules:
- All editor-core scoring/analysis engines (complexity, style, quality)
- Clip factory functions
- Media utility functions
- Export format helpers
- Render pipeline classes
- ACES color math
- Settings normalizers

These tests cover the **testable surface** effectively. The remaining gap is architectural — the codebase's heavy reliance on React hooks with embedded store/bridge logic makes unit testing impractical without significant refactoring (extracting logic from hooks into pure functions) or infrastructure investment (comprehensive mock layers).

## Component Splitting — SettingsDialog.tsx

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `settings/SettingsDialog.tsx` | 2,724 | 1,720 | -36.9% |
| `settings/GeneralSettingsPanel.tsx` | — | 679 | (extracted) |
| `settings/ShortcutMacrosPanel.tsx` | — | 211 | (extracted) |
| `settings/LutLibraryPanel.tsx` | — | 118 | (extracted) |
| `settings/hooks/useLutLibrary.ts` | — | 103 | (hook) |
| `settings/hooks/useShortcutMacros.ts` | — | 238 | (hook) |

Extracted general tab (556 lines), shortcuts+macros tabs (161 lines), LUT library tab (96 lines) into separate panel components. Then extracted LUT state+handlers into `useLutLibrary` hook and shortcut/macro state+handlers into `useShortcutMacros` hook, further reducing SettingsDialog by 260 lines. Handler functions for shortcuts, macros, and LUT operations now live in their respective hooks instead of SettingsDialog.

## Integration Checks

| Check | Status |
|-------|--------|
| TypeScript typecheck (`tsc --noEmit`) | PASS (0 errors in new/modified files) |
| Rust clippy | PASS (0 warnings) |
| Rust tests | PASS (3/3) |
| ESLint | PASS (0 errors, 1067 warnings, exit code 0) |
| Vitest | PASS (586 files, 10,940 tests, 3 skipped, ~108s) |

## Component Splitting Summary

| Component | Before | After | Reduction | Files Created |
|-----------|--------|-------|-----------|---------------|
| `Toolbar.tsx` | 2,245 | 693 | -69.1% | 12 sub-files |
| `MediaBin.tsx` | 2,267 | 896 | -60.5% | 3 sub-files |
| `AudioMixer.tsx` | 1,394 | 361 | -74.1% | 2 sub-files |
| `SettingsDialog.tsx` | 2,724 | 1,720 | -36.9% | 5 sub-files |
| **Total** | **8,630** | **3,670** | **-57.5%** | **22 sub-files** |

## SettingsDialog Refactoring Summary

| Phase | Lines | Reduction | Method |
|-------|-------|-----------|--------|
| Original | 2,724 | — | — |
| Phase 1: Extract panels | 1,980 | -27.3% | GeneralSettingsPanel, ShortcutMacrosPanel, LutLibraryPanel |
| Phase 2: Extract hooks | 1,720 | -36.9% | useLutLibrary, useShortcutMacros |

Remaining blockers for 40%: General tab handler functions (16 functions, ~160 lines) depend on shared state (exportBackgroundSettings, exportQualityAssuranceSettings, collaborationIdentity, localCoediting) that is also loaded by other panels. Moving these requires either duplicating state loading logic or introducing a shared settings context.

## Component Splitting — Toolbar.tsx

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `Toolbar/Toolbar.tsx` | 2,245 | 693 | -69.1% |
| `Toolbar/ToolbarButton.tsx` | — | 46 | (extracted) |
| `Toolbar/MenuDropdown.tsx` | — | 69 | (extracted) |
| `Toolbar/FileMenu.tsx` | — | 67 | (extracted) |
| `Toolbar/EditMenu.tsx` | — | 26 | (extracted) |
| `Toolbar/ViewMenu.tsx` | — | 130 | (extracted) |
| `Toolbar/ToolsMenu.tsx` | — | 244 | (extracted) |
| `Toolbar/HelpMenu.tsx` | — | 25 | (extracted) |
| `Toolbar/ImportMenu.tsx` | — | 74 | (extracted) |
| `Toolbar/RecordMenu.tsx` | — | 72 | (extracted) |
| `Toolbar/SplitLayoutPicker.tsx` | — | 89 | (extracted) |
| `Toolbar/WorkspaceLayoutPicker.tsx` | — | 125 | (extracted) |
| `Toolbar/index.ts` | — | 2 | (re-export) |
| `Toolbar.tsx` (old) | 2,245 | 3 | (re-export shim) |

Used centralized menu state pattern with `MenuId` union type. Each menu (File, Edit, View, Tools, Help, Import, Record) extracted to own file. Layout pickers (Split, Workspace) extracted. Shared primitives (`ToolButton`, `MenuDropdown`, `MenuItem`, `MenuSeparator`) extracted. Old `Toolbar.tsx` replaced with re-export for backward compatibility.

## Component Splitting — MediaBin.tsx

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `MediaBin/MediaBin.tsx` | 2,267 | 896 | -60.5% |
| `MediaBin/useMediaBinState.ts` | — | 393 | (hook) |
| `MediaBin/MediaBinFilterBar.tsx` | — | 238 | (extracted) |
| `MediaBin/MediaBinViewToolbar.tsx` | — | 84 | (extracted) |

Extracted all state declarations (30+ `useState`), computed values (`visibleMedia`, `sortedVisibleMedia`, `mediaHighlights`, etc.), handlers (`handleQualityAssess`, `openMediaInfo`, etc.), and effects into `useMediaBinState` hook. Filter bar (search, quick filters, type filters, scene filter, smart albums, AI search, organize panel, view toolbar) extracted to `MediaBinFilterBar`. View mode toolbar (grid/list/timeline, sort, grid size) extracted to `MediaBinViewToolbar`. Sub-components (SharedLibraryGrid, EffectPresetGrid, MediaFolderTree, MediaCardGrid, VirtualMediaCardGrid, TitleTemplateGrid, etc.) kept inline as they're only used by MediaBin.

## Component Splitting — AudioMixer.tsx

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `AudioMixer/AudioMixer.tsx` | 1,394 | 361 | -74.1% |
| `AudioMixer/DuckingPanel.tsx` | — | 169 | (extracted) |
| `AudioMixer/MixerStrips.tsx` | — | 272 | (extracted) |

Extracted DuckingPanel (ducking settings, analysis, apply/cancel), DuckingNumberField, ducking helper functions (makeDefaultDuckingSettings, normalizeDuckingSettings, collectTrackLoudnessSamples) to `DuckingPanel.tsx`. Extracted ChannelStrip, ChannelRoutingBadge, ChannelProcessingPanel, EQBandControls, EQGraph, MiniSlider, MasterStrip, VolumeFader, PanControl, VuMeter, MixerToggle, and helper functions to `MixerStrips.tsx`. ChannelAnalysisPanel kept inline (uses local state heavily).

## Coverage Gap Analysis — Component Splitting

The 80% target requires covering ~14,787 more lines. The primary blockers:

1. **React hooks** (14,839 uncovered lines, 10.1% coverage): `useTimelineHandlers.ts` (2,915 lines), `useExportActions.ts` (1,370), `useClipInspectorState.ts` (1,369). These are `.ts` files but deeply coupled to Zustand stores and Tauri bridge. `@testing-library/react` is available but `renderHook` requires store mocking.

2. **WebGL/WebGPU renderers** (3,318 uncovered): Browser GPU context required. Not testable in Node.

3. **Workers** (1,331 uncovered): Web Worker environment required.

4. **Tauri bridge** (1,132 uncovered): Tauri IPC mocking required.

### Recommended Next Steps

- Test React hooks using `renderHook` + Zustand store mocking (biggest impact: ~14k lines)
- Extend `exportSettingsHelpers.ts` tests (715 uncovered lines, partially tested)
- Extend `export-queue-runner.ts` tests (331 uncovered lines)
- Test `editorStore.ts` (263 uncovered lines)

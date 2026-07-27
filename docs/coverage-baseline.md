# Coverage Baseline — S5 Final Sprint

**Date**: 2026-07-27
**Branch**: `agent/scan-tauri-unwrap-calls-a2c6f642`

## Summary

| Metric | Value |
|--------|-------|
| Line Coverage | 71.93% |
| Function Coverage | 84.96% |
| Branch Coverage | 77.98% |
| Total Lines | 170,677 |
| Covered Lines | ~122,780 |
| Gap to 80% | ~13,760 lines |
| Test Files | 581 |
| Total Tests | 10,793 |
| Rust Tests | 3 |

## Coverage by Category

| Category | Uncovered | Total | Coverage | Files |
|----------|-----------|-------|----------|-------|
| Other .ts (testable) | 28,303 | 147,642 | 80.8% | 696 |
| React hooks (use*.ts) | 14,839 | 16,510 | 10.1% | 46 |
| Canvas/WebGL/WebGPU | 3,318 | 3,634 | 8.7% | 9 |
| Workers | 1,331 | 1,346 | 1.1% | 13 |
| Tauri bridge | 1,132 | 1,545 | 26.7% | 10 |

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
| **Total** | **~826** | |

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
| TypeScript typecheck (`tsc --noEmit`) | PASS (0 errors) |
| Rust clippy | PASS (0 warnings) |
| Rust tests | PASS (3/3) |
| Vitest (all tests) | PASS (10,793 tests, 581 files) |

## SettingsDialog Refactoring Summary

| Phase | Lines | Reduction | Method |
|-------|-------|-----------|--------|
| Original | 2,724 | — | — |
| Phase 1: Extract panels | 1,980 | -27.3% | GeneralSettingsPanel, ShortcutMacrosPanel, LutLibraryPanel |
| Phase 2: Extract hooks | 1,720 | -36.9% | useLutLibrary, useShortcutMacros |

Remaining blockers for 40%: General tab handler functions (16 functions, ~160 lines) depend on shared state (exportBackgroundSettings, exportQualityAssuranceSettings, collaborationIdentity, localCoediting) that is also loaded by other panels. Moving these requires either duplicating state loading logic or introducing a shared settings context.

## Coverage Gap Analysis

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

# Coverage Baseline — S5 Final Sprint

**Date**: 2026-07-27
**Branch**: `agent/scan-tauri-unwrap-calls-a2c6f642`

## Summary

| Metric | Value |
|--------|-------|
| Line Coverage | 71.72% |
| Function Coverage | 84.84% |
| Branch Coverage | 77.92% |
| Total Lines | 170,677 |
| Covered Lines | ~122,370 |
| Gap to 80% | ~14,170 lines |
| Test Files | 576 |
| Total Tests | 10,615 |
| Rust Tests | 3 |

## Coverage by Category

| Category | Uncovered | Total | Coverage | Files |
|----------|-----------|-------|----------|-------|
| Other .ts (testable) | 28,303 | 147,642 | 80.8% | 696 |
| React hooks (use*.ts) | 14,839 | 16,510 | 10.1% | 46 |
| Canvas/WebGL/WebGPU | 3,318 | 3,634 | 8.7% | 9 |
| Workers | 1,331 | 1,346 | 1.1% | 13 |
| Tauri bridge | 1,132 | 1,545 | 26.7% | 10 |

## New Tests Added (This Session)

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
| **Total** | **~648** | |

## Integration Checks

| Check | Status |
|-------|--------|
| TypeScript typecheck (`tsc --noEmit`) | PASS (0 errors) |
| Rust clippy | PASS (0 warnings) |
| Rust tests | PASS (3/3) |
| Vitest (all tests) | PASS (10,615 tests, 576 files) |

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

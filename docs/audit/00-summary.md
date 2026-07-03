# Open-Factory Codebase Audit — Consolidated Report

**Date:** 2026-07-03
**Scope:** Full codebase (`apps/desktop/src`, `packages/editor-core`)
**Sub-reports:** [Architecture](./01-architecture.md) | [Security](./02-security.md) | [Dead Code](./03-dead-code.md) | [Performance](./04-performance.md)

---

## Overview

| Category | CRITICAL | HIGH | MEDIUM | Total |
|----------|----------|------|--------|-------|
| Architecture | 3 | 5 | 8 | 16 |
| Security | 1 | 7 | 2 | 10 |
| Dead Code | 0 | 1 | 0 | 1 |
| Performance | 2 | 8 | 5 | 15 |
| **Total** | **6** | **21** | **15** | **42** |

---

## CRITICAL Issues (6)

| # | Category | Issue | File |
|---|----------|-------|------|
| C-1 | Security | Post-export script allows arbitrary command execution | `apps/desktop/src-tauri/src/commands/ffmpeg.rs:1519-1596` |
| C-2 | Architecture | EditorShell.tsx — 5,374 lines, 383 hook calls, 7+ concerns | `apps/desktop/src/components/EditorShell.tsx` |
| C-3 | Architecture | Inspector.tsx — 6,355 lines, nesting up to 14 levels | `apps/desktop/src/components/Inspector/Inspector.tsx` |
| C-4 | Architecture | Timeline.tsx — 6,064 lines, 114 hooks | `apps/desktop/src/components/Timeline/Timeline.tsx` |
| C-5 | ~~Dead Code~~ → **已撤销** | ~~73.6% of editor-core barrel exports unused~~ — grep 假阳性 | `packages/editor-core/src/index.ts` |
| C-6 | Performance | TimelineParts.tsx sortedClips/virtualClips not memoized (hot path) | `apps/desktop/src/components/Timeline/TimelineParts.tsx:420-438` |
| C-7 | Performance | ExportDialog.tsx O(V*E*V) nested loop in JSX map | `apps/desktop/src/export/ExportDialog.tsx:386` |

### C-1 Detail: Arbitrary Command Execution (Security — CRITICAL)

Post-export script feature in `ffmpeg.rs` executes user-provided commands with `{output}` and `{project}` placeholder substitution. A malicious project name could inject shell commands. Requires: allowlist of permitted executables, shell metacharacter escaping, confirmation dialog.

### C-5 Detail: ~~Massive Over-Exporting~~ (Dead Code — **已撤销 CRITICAL**)

> **已通过 knip 交叉验证推翻。** grep 报告的 "2,341 未使用 editor-core 导出" 全部为假阳性。knip 对 editor-core 仅报 5 个未使用类型，经人工验证也全部为误报。根因：grep 无法追踪 barrel re-export 链和 `import type` 语义。详见 [交叉验证报告](./03-dead-code-cross-validation.md)。
>
> 实际清理范围：仅 desktop app 的 ~178 个多余 `export` 关键字（123 导出 + 55 类型），已在 3 个 batch commit 中完成。代码本身保留。

### C-6 & C-7 Detail: Performance Hot Paths

Timeline is the hottest re-render path. Every playback frame triggers re-render; without `useMemo`, `sortedClips` runs O(n log n) sort per frame. ExportDialog has O(V*E*V) complexity in JSX map for pipeline visualization.

---

## HIGH Issues (22)

### Security (7)

| # | Issue | File |
|---|-------|------|
| H-1 | XSS via dangerouslySetInnerHTML in TimelineTemplateDialog | `TimelineTemplateDialog.tsx:150` |
| H-2 | XSS via dangerouslySetInnerHTML in ProjectDocumentationPanel | `ProjectDocumentationPanel.tsx:82` |
| H-3 | XSS via dangerouslySetInnerHTML in Inspector rich text | `Inspector.tsx:4968` |
| H-4 | SSRF via webhook publishing (no private IP blocking) | `commands/publish.rs:103-109` |
| H-5 | WebSocket server binds 0.0.0.0 without auth | `commands/collaboration.rs:55` |
| H-6 | SMTP builder_dangerous bypasses TLS cert verification | `commands/publish.rs:84-88` |
| H-7 | User-controlled custom_headers passed without validation | `commands/ai.rs:90-93` |

### Architecture (5)

| # | Issue | File |
|---|-------|------|
| A-1 | SettingsDialog.tsx 4,675 lines | `SettingsDialog.tsx` |
| A-2 | MediaBin.tsx 2,925 lines, 68 hooks | `MediaBin.tsx` |
| A-3 | PreviewCanvas.tsx 2,909 lines, 79 hooks | `PreviewCanvas.tsx` |
| A-4 | model.ts 2,247 lines + model-types.ts 1,134 lines | `model.ts` |
| A-5 | tauri-bridge.ts 2,044 lines, 237 exports | `tauri-bridge.ts` |

### Performance (8)

| # | Issue | File |
|---|-------|------|
| P-03 | Double filter+reduce in JSX | `AIRoughCutPanel.tsx:385` |
| P-04 | Double filter+reduce in JSX | `DirectorModePanel.tsx:352` |
| P-05 | setTimeout not cleared on unmount | `Toast.tsx:26` |
| P-06 | setTimeout not cleared on unmount | `ExportDialog.tsx:5960` |
| P-07 | setTimeout not cleared on unmount | `MusicMatchPanel.tsx:112` |
| P-08 | setTimeout not cleared on unmount | `AISemanticSearchPanel.tsx:173` |
| P-09 | setTimeout not cleared on unmount | `MediaAIAnalysisDialog.tsx:140` |
| P-10 | setTimeout not cleared on unmount | `AILoudnessSuggestionSection.tsx:17` |

### Dead Code (1)

| # | Issue | File |
|---|-------|------|
| D-2 | 6 internal-only files undocumented | `packages/editor-core/src/export/` |

---

## MEDIUM Issues (12)

| # | Category | Issue |
|---|----------|-------|
| M-1 | Security | Box::leak memory leak for custom provider IDs (`ai.rs:260-267`) |
| M-2 | Security | User-controlled base_url used without validation (`ai.rs:63`) |
| M-3 | Architecture | timeline-commands.ts 6,039 lines, 175 exports |
| M-4 | Architecture | ExportDialog.tsx 5,992 lines, 10-level nesting |
| M-5 | Architecture | SettingsDialog.tsx 4,675 lines, 8-level nesting |
| M-6 | Architecture | strings.ts 11,105 lines (i18n) |
| M-7 | Architecture | strings.ts 11,105 lines (i18n) |
| M-8 | Performance | EditorShell.tsx timerRef not fully cleaned |
| M-9 | Performance | ExportDialog.tsx 5,992-line monolithic file |
| M-10 | Performance | No virtualization for large lists |
| M-11 | Performance | 15 files with <img> missing loading="lazy" |
| M-12 | Performance | 30 files with inline style={{ }} causing re-renders (78 instances) |

---

## Recommended Fix Priority

### Phase 1 — Immediate (Security + Performance Hot Paths)
1. **Sanitize dangerouslySetInnerHTML** in 3 locations (H-1, H-2, H-3) — use DOMPurify
2. **Block private IPs** in webhook URL validation (H-4)
3. **Add memoization** to TimelineParts.tsx and ExportDialog.tsx (C-6, C-7)
4. **Create `useSafeTimeout` hook** and replace 6 uncleaned setTimeout calls (P-05 to P-10)

### Phase 2 — Short-term (Architecture Splitting)
5. Split Inspector.tsx, Timeline.tsx, ExportDialog.tsx into sub-components (C-2 to C-5)
6. Split timeline-commands.ts by command category (C-4)
7. Audit and trim barrel exports in editor-core (C-6)

### Phase 3 — Medium-term (Hardening)
8. Add SSRF protection to AI base_url and custom_headers (H-7, M-1, M-2)
9. Bind WebSocket to localhost by default, add auth (H-5)
10. Default SMTP to secure mode (H-6)
11. Add image lazy loading and virtualization (M-10, M-11)

---

**Generated:** 2026-07-03

# E2E Tests

## Environment Requirement

These E2E tests **cannot run in a plain Node.js environment**. They require
the Vite dev server with `VITE_E2E=true` to load the Tauri API mock layer.

### Why

This is a Tauri v2 desktop application. Most features (file dialogs, file I/O,
FFmpeg export, media probing, etc.) call native APIs via `tauri-bridge.ts`.
In E2E mode, these calls are intercepted by an in-browser mock layer instead
of reaching the real Tauri runtime.

The call chain in `tauri-bridge.ts` is:

1. Check `window.__TAURI_MOCKS__` — if present, use the mock (E2E mode)
2. Check `isTauriRuntime()` (`window.__TAURI_INTERNALS__`) — if present,
   call the real Tauri backend via `invoke()`
3. Otherwise, throw an error

The mock layer is loaded conditionally in `src/main.tsx`:

```typescript
if (import.meta.env.VITE_E2E === 'true') {
  await import('./e2e/install-mocks');
}
```

Without `VITE_E2E=true` (i.e. in a plain Node.js test runner), the mock
layer is never loaded, `__TAURI_INTERNALS__` does not exist, and every
Tauri bridge call throws. This is expected behavior, not a bug.

## Prerequisites

```bash
# Install dependencies (from repo root or apps/desktop)
bun install

# Install Playwright browsers (Chromium only, one-time)
bunx playwright install chromium
```

## Running E2E Tests

```bash
# From repo root
bun run e2e

# From apps/desktop
cd apps/desktop && bun run e2e

# Other modes
bun run e2e:headed   # visible browser
bun run e2e:ui       # Playwright interactive UI
```

The Playwright runner automatically starts the Vite dev server on
`localhost:1420` with `VITE_E2E=true` (configured in `playwright.config.ts`).

## Architecture

```
playwright.config.ts
  └─ webServer: bun run dev -- --host localhost  (env: VITE_E2E=true)
       └─ main.tsx
            └─ VITE_E2E === 'true' → import('./e2e/install-mocks')
                 └─ window.__TAURI_MOCKS__ = { ... }  (5400+ line mock layer)
                      └─ tauri-bridge.ts checks __TAURI_MOCKS__ first
```

- `src/e2e/install-mocks.ts` — comprehensive mock for all Tauri IPC commands,
  virtual filesystem, and `window.__E2E_ACTIONS__` test helpers
- `e2e/e2e-actions.ts` — shared Playwright helpers (`waitForE2eActions`,
  `addMediaCardToTimeline`, etc.)
- `e2e/*.spec.ts` — test specs; none import Tauri APIs directly

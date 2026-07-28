# strictNullChecks Status

## Current State

`strictNullChecks` is **already enabled** globally via `"strict": true` in both:
- `packages/editor-core/tsconfig.json`
- `apps/desktop/tsconfig.json`
- Root `tsconfig.json` (compilerOptions)

## Verification

- `tsc --noEmit`: **0 errors**
- `@ts-expect-error` / `@ts-ignore` usage: **1 file** in editor-core/src
- No per-file override needed

## Conclusion

No migration work required. The codebase is already fully compliant with strictNullChecks.

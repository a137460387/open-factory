## Task 2 Report: Node Graph Execution Engine

**Status**: COMPLETE

**Commit**: `feat: add color grading node graph execution engine` (74670219)

### Files Created/Modified

| File | Action |
|------|--------|
| `packages/editor-core/src/color-grading/node-graph-engine.ts` | Created |
| `packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts` | Created |
| `packages/editor-core/src/color-grading/index.ts` | Modified (added barrel export) |

### Implementation Summary

**`NodeGraphEngine`** class with three public static methods:

1. **`topologicalSort(graph)`** - Kahn's algorithm for topological sorting. Builds an adjacency list and in-degree map from connections, then processes nodes in dependency order. Throws `'Cycle detected'` if the graph contains cycles.

2. **`execute(graph)`** - Executes the node graph:
   - Filters out disabled nodes and their connections
   - Topologically sorts enabled nodes
   - Executes each node in order (primary-wheel and primary-slider types produce GLSL uniforms and fragment snippets)
   - Merges all uniforms into `combinedUniforms`
   - Returns `GraphExecutionResult` with per-node results and combined uniforms

3. **`validateGraph(graph)`** - Validates graph structure:
   - Detects duplicate node IDs
   - Detects dangling connections (references to non-existent nodes)
   - Detects self-connections

### Deviation from Brief

- Test file placed at `packages/editor-core/__tests__/color-grading/node-graph-engine.test.ts` instead of `packages/editor-core/src/color-grading/__tests__/node-graph-engine.test.ts` because the vitest config only includes `__tests__/**/*.test.ts`.
- Import paths in test file adjusted accordingly (`../../src/color-grading/...` instead of `../...`).
- Changed error message casing from `'Duplicate'` to `'duplicate'` to match the test expectation `errors.some(e => e.includes('duplicate'))`.

### Test Results

- **Task tests**: 11/11 passed
- **Full suite**: 339 files, 4555 tests passed, 0 failures, no regressions

### Exported Types

- `NodeExecutionResult` - per-node execution output (uniforms + fragment snippets)
- `GraphExecutionResult` - full graph execution output
- `GraphValidationError` - string alias for validation errors
- `NodeGraphEngine` - the engine class itself

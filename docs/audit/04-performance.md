# Performance Audit Report - open-factory

**Scope**: `apps/desktop/src/` all `.tsx` / `.ts` files
**Date**: 2026-07-03
**Total findings**: 15 (CRITICAL x 2, HIGH x 8, MEDIUM x 5)

## Severity Definitions

| Level | Impact | Action |
|-------|--------|--------|
| CRITICAL | Direct jank on every frame, or O(n^2)+ in hot path | Fix immediately |
| HIGH | Timer/subscription leak, unnecessary re-computation in frequent path | Fix before next release |
| MEDIUM | Maintainability, missing optimization, suboptimal pattern | Plan and fix |

---

## Category 1: Missing useMemo / useCallback in Hot Paths

### CRITICAL-01: TimelineParts.tsx - unsorted clips in render body

**File**: `apps/desktop/src/components/Timeline/TimelineParts.tsx` (lines ~420-438)

**Impact**: Timeline is the hottest re-render path. Every playback frame advance triggers re-render. Without `useMemo`, `sortedClips` runs O(n log n) sort and `virtualClips` runs filter on every render.
```tsx
// Current (in render body, no memoization):
const sortedClips = [...track.clips].sort(
  (left, right) => left.start - right.start || left.id.localeCompare(right.id)
);
const virtualClips = filterTimelineVirtualClips(track.clips, virtualWindow)
  .filter((clip) => !colorFilter || getEffectiveClipColorLabel(clip, track) === colorFilter);
```

**Fix**:
```tsx
const sortedClips = useMemo(
  () => [...track.clips].sort(
    (left, right) => left.start - right.start || left.id.localeCompare(right.id)
  ),
  [track.clips]
);
const virtualClips = useMemo(
  () => filterTimelineVirtualClips(track.clips, virtualWindow)
    .filter((clip) => !colorFilter || getEffectiveClipColorLabel(clip, track) === colorFilter),
  [track.clips, virtualWindow, colorFilter, track]
);
```

---

### CRITICAL-02: ExportDialog.tsx - O(V*E*V) nested loop in JSX map

**File**: `apps/desktop/src/export/ExportDialog.tsx` (line 386)

**Impact**: For each pipeline node, iterates all edges (filter) then all nodes (find). Complexity O(V * E * V) where V = node count, E = edge count.

```tsx
{pipeline.nodes.map((node) => {
  const downstream = pipeline.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => pipeline.nodes.find((item) => item.id === edge.to)?.name ?? edge.to);
})}
```

**Fix**: Pre-compute `downstreamMap` with `useMemo`:
```tsx
const downstreamMap = useMemo(() => {
  const map = new Map<string, string[]>();
  for (const edge of pipeline.edges) {
    const targetName = pipeline.nodes.find((n) => n.id === edge.to)?.name ?? edge.to;
    const list = map.get(edge.from) ?? [];
    list.push(targetName);
    map.set(edge.from, list);
  }
  return map;
}, [pipeline.nodes, pipeline.edges]);
```

---

## Category 2: Memory Leak Risks (setTimeout without cleanup)

### HIGH-01: AIRoughCutPanel.tsx - double filter+reduce in JSX

**File**: `apps/desktop/src/components/AIRoughCut/AIRoughCutPanel.tsx` (line 385)

**Impact**: JSX text expression runs `storyboard.filter().length` and `storyboard.filter().reduce()` — two full traversals on every render.

```tsx
{t.storyboard} — {t.clipCount(storyboard.filter((s) => !s.deleted).length)} · {t.totalDuration(storyboard.filter((s) => !s.deleted).reduce((sum, s) => sum + s.duration, 0))}
```

**Fix**: Extract to `useMemo`:
```tsx
const activeStats = useMemo(() => {
  const active = storyboard.filter((s) => !s.deleted);
  return { count: active.length, totalDuration: active.reduce((sum, s) => sum + s.duration, 0) };
}, [storyboard]);
```

---

### HIGH-02: DirectorModePanel.tsx - identical double filter+reduce

**File**: `apps/desktop/src/components/DirectorMode/DirectorModePanel.tsx` (line 352)

**Impact**: Same pattern as HIGH-01.

**Fix**: Same approach — extract to `useMemo`.

---

### HIGH-03: Toast.tsx - window.setTimeout not cleared

**File**: `apps/desktop/src/components/common/Toast.tsx` (line 26)

**Impact**: `window.setTimeout` inside event handler not tracked. If component unmounts before timeout fires, `setItems` runs on unmounted component.

```tsx
useEffect(() => {
  const onToast = (event: Event) => {
    const detail = (event as CustomEvent<ToastEventDetail>).detail;
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, kind: 'info', ...detail }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4500);
  };
  window.addEventListener('open-factory-toast', onToast);
  return () => window.removeEventListener('open-factory-toast', onToast);
}, []);
```

**Fix**: Track timeout IDs and clear on unmount:
```tsx
useEffect(() => {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const onToast = (event: Event) => {
    // ...
    const timer = window.setTimeout(() => { /* ... */ }, 4500);
    timers.push(timer);
  };
  window.addEventListener('open-factory-toast', onToast);
  return () => {
    window.removeEventListener('open-factory-toast', onToast);
    timers.forEach(clearTimeout);
  };
}, []);
```

---

### HIGH-04: ExportDialog.tsx - setTimeout in ExportDiagnosticsPanel

**File**: `apps/desktop/src/export/ExportDialog.tsx` (lines 5960-5964)

**Impact**: `setTimeout` not cleared if component unmounts during 2s window.

```tsx
const handleCopy = () => {
  void navigator.clipboard.writeText(error).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
};
```

**Fix**: Use `useSafeTimeout` hook or track timer in ref and clear on unmount.

---

### HIGH-05: MusicMatchPanel.tsx - setTimeout in copyKeywords

**File**: `apps/desktop/src/components/MusicMatch/MusicMatchPanel.tsx` (line 112)

**Impact**: `setTimeout(() => setCopied(false), 2000)` not cleared.

**Fix**: Same as HIGH-04.

---

### HIGH-06: AISemanticSearchPanel.tsx - onBlur setTimeout

**File**: `apps/desktop/src/components/MediaBin/AISemanticSearchPanel.tsx` (line 173)

**Impact**: `setTimeout(() => setShowHistory(false), 200)` in onBlur — not cleared on unmount.

**Fix**: Same as HIGH-04.

---

### HIGH-07: MediaAIAnalysisDialog.tsx - setTimeout on close

**File**: `apps/desktop/src/components/MediaBin/MediaAIAnalysisDialog.tsx` (line 140)

**Impact**: `setTimeout(() => onClose(), 300)` not cleared.

**Fix**: Same as HIGH-04.

---

### HIGH-08: AILoudnessSuggestionSection.tsx - setTimeout in handleMeasure

**File**: `apps/desktop/src/export/AILoudnessSuggestionSection.tsx` (line 17)

**Impact**: `setTimeout(() => setMeasuring(false), 300)` not cleared.

```tsx
const handleMeasure = () => {
  if (existing) { setSuggestion(existing); return; }
  setMeasuring(true);
  setTimeout(() => setMeasuring(false), 300);
};
```

**Fix**: Same as HIGH-04.

---

## Category 3: Timer Cleanup Issues

### MEDIUM-01: EditorShell.tsx - timerRef not fully cleaned

**File**: `apps/desktop/src/components/EditorShell.tsx` (around line 4148)

**Impact**: `timerRef` stores timer IDs but the cleanup function does not iterate and clear all stored timers.

**Fix**: Ensure the useEffect cleanup iterates all stored timer refs and calls `clearTimeout`/`clearInterval` on each.

---

## Category 4: Other Performance Issues

### MEDIUM-02: ExportDialog.tsx - 5992-line monolithic file

**File**: `apps/desktop/src/export/ExportDialog.tsx`

**Impact**: Single file with ~6000 lines makes code splitting impossible, increases parse time, and hurts maintainability.

**Fix**: Split into sub-components: `ExportPipelineEditor`, `ExportDiagnosticsPanel`, `ExportSettingsSection`, etc.

---

### MEDIUM-03: No virtualization for large lists

**Files**: `AISceneMatchPanel.tsx`, `MediaBin.tsx`, and others rendering image/media lists.

**Impact**: Large lists render all items at once, causing slow initial paint and high memory usage.

**Fix**: Adopt `@tanstack/react-virtual` for long lists with 50+ items.

---

### MEDIUM-04: No lazy loading on images

**Files**: 15 files with `<img>` tags, none using `loading="lazy"`.

**Impact**: All images load eagerly including below-the-fold thumbnails, increasing initial page load time.

**Fix**: Add `loading="lazy"` to non-critical images (thumbnails, previews). Keep `loading="eager"` only for hero/above-fold images.

---

### MEDIUM-05: Inline style objects causing unnecessary re-renders

**Files**: 30 files with 78 instances of `style={{ }}`. Highest counts:
- `PreviewCanvas.tsx` (14 instances)
- `SettingsDialog.tsx` (8 instances)
- `MediaBin.tsx` (7 instances)

**Impact**: Each `style={{ }}` creates a new object reference on every render, defeating React.memo and shallow comparison.

**Fix**: Extract inline styles to module-level constants or use Tailwind classes instead.


---

## Positive Patterns (Correctly Optimized)

| File | Pattern | Lines |
|------|---------|-------|
| `Inspector.tsx` | filter+sort in `useMemo` | L247-251, L438-442, L3617-3623 etc |
| `EditorShell.tsx` | filter+sort in `useMemo` | L708-712, L880-884, L896-900 etc |
| `MediaBin.tsx` | filter+map in `useMemo` | L275-277 |
| `PerformanceMonitorPanel.tsx` | setInterval with cleanup | L15-21 |
| `Timeline.tsx` | Event listeners properly cleaned | L662-670, L674-676, L2436-2443 |
| `ColorScopesPanel.tsx` | Worker event listeners + termination | L27-58 |
| `SettingsDialog.tsx` | setInterval properly cleaned | L2757-2761 |
| `TutorialOverlay.tsx` | setInterval properly cleaned | L53-58 |

---

## Summary Table

| # | Severity | Category | File | Issue |
|---|----------|----------|------|-------|
| 1 | CRITICAL | Memoization | TimelineParts.tsx | sortedClips/virtualClips not memoized |
| 2 | CRITICAL | Memoization | ExportDialog.tsx | O(V*E*V) loop in JSX map |
| 3 | HIGH | Memoization | AIRoughCutPanel.tsx | Double filter+reduce in JSX |
| 4 | HIGH | Memoization | DirectorModePanel.tsx | Double filter+reduce in JSX |
| 5 | HIGH | Timer leak | Toast.tsx | setTimeout not cleared |
| 6 | HIGH | Timer leak | ExportDialog.tsx | setTimeout not cleared |
| 7 | HIGH | Timer leak | MusicMatchPanel.tsx | setTimeout not cleared |
| 8 | HIGH | Timer leak | AISemanticSearchPanel.tsx | setTimeout not cleared |
| 9 | HIGH | Timer leak | MediaAIAnalysisDialog.tsx | setTimeout not cleared |
| 10 | HIGH | Timer leak | AILoudnessSuggestionSection.tsx | setTimeout not cleared |
| 11 | MEDIUM | Timer cleanup | EditorShell.tsx | timerRef not fully cleaned |
| 12 | MEDIUM | Architecture | ExportDialog.tsx | 5992-line monolithic file |
| 13 | MEDIUM | Rendering | Multiple files | No virtualization for large lists |
| 14 | MEDIUM | Loading | 15 files | No lazy loading on images |
| 15 | MEDIUM | Rendering | 30 files (78 instances) | Inline style objects |

---

## Fix Priority

### Batch 1 (Immediate - CRITICAL)
1. Wrap `sortedClips` and `virtualClips` with `useMemo` in `TimelineParts.tsx`
2. Pre-compute `downstreamMap` in `ExportDialog.tsx` with `useMemo`

### Batch 2 (Next Release - HIGH, timer leaks)
3. Create a `useSafeTimeout` custom hook:
```tsx
function useSafeTimeout() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);
}
```
4. Replace all 6 uncleaned `setTimeout` calls with `useSafeTimeout`

### Batch 3 (HIGH, memoization)
5. Extract active storyboard stats in `AIRoughCutPanel.tsx` and `DirectorModePanel.tsx`

### Batch 4 (MEDIUM, quality)
6. Split `ExportDialog.tsx` into sub-components
7. Add `loading="lazy"` to non-critical images
8. Extract inline styles to constants or Tailwind classes
9. Evaluate `@tanstack/react-virtual` for long lists

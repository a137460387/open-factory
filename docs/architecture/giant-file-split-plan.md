# Giant File Split Plan (Phase 4.2)

## timeline-commands.ts (7181 lines)

### Proposed Split

| Module | Lines (est.) | Contents |
|--------|-------------|----------|
| `clip-commands.ts` | ~1500 | insertClip, deleteClips, splitClip, trimClip, buildSlipClip, buildSlideClipEdit, rippleDelete, sliceClip* |
| `track-commands.ts` | ~800 | addTrack, removeTrack, reorderTracks, applyTrackPatch, closeTrackGap |
| `media-commands.ts` | ~1200 | replaceMedia, mergeMedia, deleteMediaAssets, calculateReplaceMediaPatch, mergeMediaReferences |
| `keyframe-commands.ts` | ~1000 | keyframe selection, add/remove/update keyframes, easing, handle manipulation |
| `timeline-markers.ts` | ~600 | markers, notes, bookmarks, annotations, beat markers |
| `multicam-commands.ts` | ~400 | multicam clip creation, angle switching |
| `subtitle-commands.ts` | ~500 | subtitle import, generation, manipulation |
| `sequence-commands.ts` | ~400 | sequence CRUD, nested sequences |
| `color-fx-commands.ts` | ~800 | color correction, chroma key, masks, panorama, projection |
| `helpers.ts` | ~500 | assertClipsNotOnLockedTrack, findTrack, findClip, timelineHasOverlaps, etc. |

### Key Dependencies
- All modules share `Timeline`, `Track`, `Clip`, `Project` types from model-types
- `helpers.ts` is used by all other modules
- `clip-commands.ts` depends on `helpers.ts`
- `media-commands.ts` depends on `helpers.ts`

## ExportDialog.tsx (3807 lines)

### Proposed Split

| Module | Lines (est.) | Contents |
|--------|-------------|----------|
| `ExportDialog.tsx` | ~800 | Main dialog shell, state management, tabs |
| `ExportFormatPanel.tsx` | ~600 | Format selection, codec options |
| `ExportQualityPanel.tsx` | ~500 | Quality settings, bitrate, resolution |
| `ExportSubtitlePanel.tsx` | ~400 | Subtitle options, burn-in vs soft |
| `ExportAdvancedPanel.tsx` | ~500 | Advanced options, hardware encoding |
| `ExportPreviewPanel.tsx` | ~400 | Preview samples, quality comparison |
| `ExportQueuePanel.tsx` | ~400 | Queue management, batch export |
| `export-utils.ts` | ~200 | Helper functions, presets |

## ClipInspectorBody.tsx (3258 lines)

### Proposed Split

| Module | Lines (est.) | Contents |
|--------|-------------|----------|
| `ClipInspectorBody.tsx` | ~600 | Main shell, tab navigation |
| `ClipPropertiesPanel.tsx` | ~500 | Basic properties (name, duration, speed) |
| `ClipTransformPanel.tsx` | ~500 | Position, scale, rotation, anchor |
| `ClipAudioPanel.tsx` | ~400 | Volume, pan, EQ, compressor |
| `ClipColorPanel.tsx` | ~500 | Color correction, LUT, grading |
| `ClipEffectsPanel.tsx` | ~400 | Effects stack, presets |
| `ClipMotionPanel.tsx` | ~300 | Motion tracking, keyframes |

## Execution Order
1. timeline-commands.ts → extract helpers.ts first (no external API change)
2. ExportDialog.tsx → extract panels (internal refactor)
3. ClipInspectorBody.tsx → extract panels (internal refactor)

## Risk Assessment
- **LOW**: All splits are internal module reorganization, no public API changes
- **LOW**: Each split creates new files + updates imports in the original file
- **MEDIUM**: timeline-commands.ts has complex inter-function dependencies

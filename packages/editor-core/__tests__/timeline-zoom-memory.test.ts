import { describe, it, expect } from 'vitest';
import {
  buildZoomContextKey,
  resolveZoomForContext,
  saveZoomMemoryEntry,
  detectZoomEditMode,
  pruneZoomMemory,
  ZOOM_MODE_DEFAULTS,
  BASE_TIMELINE_ZOOM,
  clampTimelineZoom
} from '../src/timeline-zoom';
import type { ZoomEditMode } from '../src/model-types';

describe('buildZoomContextKey', () => {
  it('should build key from sequence id and edit mode', () => {
    expect(buildZoomContextKey('seq-1', 'editing')).toBe('seq-1:editing');
    expect(buildZoomContextKey('seq-2', 'browsing')).toBe('seq-2:browsing');
    expect(buildZoomContextKey('seq-3', 'audio')).toBe('seq-3:audio');
  });
});

describe('resolveZoomForContext', () => {
  it('should return stored zoom when memory exists', () => {
    const memory = { 'seq-1:editing': 300 };
    expect(resolveZoomForContext(memory, 'seq-1', 'editing')).toBe(clampTimelineZoom(300));
  });

  it('should return mode default when no memory exists', () => {
    expect(resolveZoomForContext(undefined, 'seq-1', 'editing')).toBe(clampTimelineZoom(ZOOM_MODE_DEFAULTS.editing));
  });

  it('should return mode default when specific key not found', () => {
    const memory = { 'seq-1:browsing': 100 };
    expect(resolveZoomForContext(memory, 'seq-1', 'editing')).toBe(clampTimelineZoom(ZOOM_MODE_DEFAULTS.editing));
  });

  it('should handle NaN values in memory gracefully', () => {
    const memory = { 'seq-1:editing': NaN };
    expect(resolveZoomForContext(memory, 'seq-1', 'editing')).toBe(clampTimelineZoom(ZOOM_MODE_DEFAULTS.editing));
  });

  it('should clamp stored zoom to valid range', () => {
    const memory = { 'seq-1:editing': 999999 };
    const result = resolveZoomForContext(memory, 'seq-1', 'editing');
    expect(result).toBeLessThanOrEqual(clampTimelineZoom(999999));
  });
});

describe('saveZoomMemoryEntry', () => {
  it('should create new memory when undefined', () => {
    const result = saveZoomMemoryEntry(undefined, 'seq-1', 'editing', 240);
    expect(result).toEqual({ 'seq-1:editing': clampTimelineZoom(240) });
  });

  it('should merge with existing memory', () => {
    const existing = { 'seq-1:browsing': 64 };
    const result = saveZoomMemoryEntry(existing, 'seq-1', 'editing', 240);
    expect(result).toEqual({ 'seq-1:browsing': 64, 'seq-1:editing': clampTimelineZoom(240) });
  });

  it('should overwrite existing entry for same key', () => {
    const existing = { 'seq-1:editing': 100 };
    const result = saveZoomMemoryEntry(existing, 'seq-1', 'editing', 300);
    expect(result['seq-1:editing']).toBe(clampTimelineZoom(300));
  });

  it('should clamp zoom value on save', () => {
    const result = saveZoomMemoryEntry(undefined, 'seq-1', 'editing', -100);
    expect(result['seq-1:editing']).toBe(clampTimelineZoom(-100));
  });
});

describe('detectZoomEditMode', () => {
  it('should detect editing mode when keyframe selected', () => {
    expect(detectZoomEditMode({ hasSelectedKeyframe: true })).toBe('editing');
  });

  it('should detect editing mode when inspector keyframe open', () => {
    expect(detectZoomEditMode({ isInspectorKeyframeOpen: true })).toBe('editing');
  });

  it('should detect audio mode when audio clip selected', () => {
    expect(detectZoomEditMode({ selectedClipType: 'audio' })).toBe('audio');
  });

  it('should default to browsing mode', () => {
    expect(detectZoomEditMode({})).toBe('browsing');
  });

  it('should prefer editing over audio when both are true', () => {
    expect(detectZoomEditMode({ hasSelectedKeyframe: true, selectedClipType: 'audio' })).toBe('editing');
  });
});

describe('pruneZoomMemory', () => {
  it('should return undefined when input is undefined', () => {
    expect(pruneZoomMemory(undefined, ['seq-1'])).toBeUndefined();
  });

  it('should remove entries for invalid sequence ids', () => {
    const memory = { 'seq-1:editing': 200, 'seq-2:browsing': 100 };
    const result = pruneZoomMemory(memory, ['seq-1']);
    expect(result).toEqual({ 'seq-1:editing': 200 });
  });

  it('should return undefined when all entries are pruned', () => {
    const memory = { 'seq-9:editing': 200 };
    expect(pruneZoomMemory(memory, ['seq-1'])).toBeUndefined();
  });

  it('should keep all entries for valid sequences', () => {
    const memory = { 'seq-1:editing': 200, 'seq-2:browsing': 100 };
    const result = pruneZoomMemory(memory, ['seq-1', 'seq-2']);
    expect(result).toEqual(memory);
  });
});

describe('nested sequence independent memory', () => {
  it('should maintain separate zoom for each sequence', () => {
    let memory = saveZoomMemoryEntry(undefined, 'seq-1', 'editing', 240);
    memory = saveZoomMemoryEntry(memory, 'seq-2', 'editing', 400);
    memory = saveZoomMemoryEntry(memory, 'seq-1', 'browsing', 64);

    expect(resolveZoomForContext(memory, 'seq-1', 'editing')).toBe(clampTimelineZoom(240));
    expect(resolveZoomForContext(memory, 'seq-2', 'editing')).toBe(clampTimelineZoom(400));
    expect(resolveZoomForContext(memory, 'seq-1', 'browsing')).toBe(clampTimelineZoom(64));
  });

  it('should restore different zoom per sequence on switch', () => {
    let memory = saveZoomMemoryEntry(undefined, 'main', 'editing', 300);
    memory = saveZoomMemoryEntry(memory, 'nested-1', 'editing', 150);

    expect(resolveZoomForContext(memory, 'main', 'editing')).toBe(clampTimelineZoom(300));
    expect(resolveZoomForContext(memory, 'nested-1', 'editing')).toBe(clampTimelineZoom(150));
  });
});

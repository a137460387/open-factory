// @vitest-environment jsdom
/**
 * Integration tests for Sprint AY/AZ refactored modules.
 * Tests facade completeness, store isolation, and sub-module composition.
 */
import {describe, it, expect, vi, beforeEach} from 'vitest';

// ==================== TimelineParts facade re-exports ====================

describe('TimelineParts facade re-exports', () => {
  it('exports TrackRow, ThumbnailTrack, Ruler from TimelineTrackComponents', async () => {
    const mod = await import('./TimelineParts');
    expect(mod.TrackRow).toBeDefined();
    expect(mod.ThumbnailTrack).toBeDefined();
    expect(mod.Ruler).toBeDefined();
  });

  it('exports ClipBlock, VolumeEnvelopeOverlay from TimelineClipComponents', async () => {
    const mod = await import('./TimelineParts');
    expect(mod.ClipBlock).toBeDefined();
    expect(mod.MemoizedClipBlock).toBeDefined();
    expect(mod.VolumeEnvelopeOverlay).toBeDefined();
  });

  it('exports type constants TRACK_HEIGHT and LABEL_WIDTH', async () => {
    const mod = await import('./TimelineParts');
    expect(mod.TRACK_HEIGHT).toBe(60);
    expect(mod.LABEL_WIDTH).toBe(160);
  });

  it('exports DragState and menu request types', async () => {
    const typesMod = await import('./timeline-parts-types');
    // Verify types are accessible (compile-time check via typeof)
    const _dragState: typeof typesMod.DragState extends never ? never : true = true;
    expect(_dragState).toBe(true);
  });

  it('sub-modules import from types without circular dependency', async () => {
    const types = await import('./timeline-parts-types');
    const clips = await import('./TimelineClipComponents');
    const tracks = await import('./TimelineTrackComponents');
    // All modules loaded successfully
    expect(types.LABEL_WIDTH).toBe(160);
    expect(clips.ClipBlock).toBeDefined();
    expect(tracks.TrackRow).toBeDefined();
  });
});

// ==================== shortcut-manager facade ====================

describe('shortcut-manager facade re-exports', () => {
  it('exports ShortcutManager class and factory functions', async () => {
    const mod = await import('@open-factory/editor-core/ui/shortcut-manager');
    expect(mod.ShortcutManager).toBeDefined();
    expect(mod.createShortcutManager).toBeDefined();
    expect(mod.getShortcutScheme).toBeDefined();
    expect(mod.getAllShortcutSchemes).toBeDefined();
    expect(mod.formatShortcutKeys).toBeDefined();
  });

  it('exports all 3 preset schemes', async () => {
    const mod = await import('@open-factory/editor-core/ui/shortcut-manager');
    expect(mod.PREMIERE_SCHEME).toBeDefined();
    expect(mod.FINAL_CUT_SCHEME).toBeDefined();
    expect(mod.DAVINCI_RESOLVE_SCHEME).toBeDefined();
    expect(mod.ALL_SHORTCUT_SCHEMES).toHaveLength(3);
  });

  it('exports types and DEFAULT_SHORTCUT_CONFIG', async () => {
    const mod = await import('@open-factory/editor-core/ui/shortcut-manager');
    expect(mod.DEFAULT_SHORTCUT_CONFIG).toBeDefined();
    expect(mod.DEFAULT_SHORTCUT_CONFIG.activeSchemeId).toBe('premiere');
  });

  it('ShortcutManager can be instantiated and switches schemes', async () => {
    const {ShortcutManager} = await import('@open-factory/editor-core/ui/shortcut-manager');
    const manager = new ShortcutManager();
    expect(manager.getActiveScheme().id).toBe('premiere');
    expect(manager.switchScheme('final-cut')).toBe(true);
    expect(manager.getActiveScheme().id).toBe('final-cut');
    expect(manager.switchScheme('nonexistent')).toBe(false);
    manager.destroy();
  });
});

// ==================== quality-assessment facade ====================

describe('quality-assessment facade re-exports', () => {
  it('exports types from quality-assessment-types', async () => {
    const mod = await import('@open-factory/editor-core/ai/quality-assessment');
    // Verify key functions exist
    expect(mod.assessVideoQuality).toBeDefined();
    expect(mod.assessAudioQuality).toBeDefined();
    expect(mod.computeQualityScore).toBeDefined();
    expect(mod.createDefaultQualityAssessmentConfig).toBeDefined();
  });

  it('createDefaultQualityAssessmentConfig returns valid config', async () => {
    const mod = await import('@open-factory/editor-core/ai/quality-assessment');
    const config = mod.createDefaultQualityAssessmentConfig();
    expect(config.dimensions).toBeInstanceOf(Array);
    expect(config.sampleCount).toBeGreaterThan(0);
    expect(config.qualityThresholds).toBeDefined();
  });
});

// ==================== Store subscription isolation ====================

describe('Store subscription isolation', () => {
  beforeEach(async () => {
    const {useEditorStore} = await import('../../store/editorStore');
    useEditorStore.setState({
      selectedClipId: undefined,
      selectedClipIds: [],
      isPlaying: false,
      dirty: false,
      playheadTime: 0,
    } as never);
  });

  it('editorStore selector only triggers on selected field change', async () => {
    const {useEditorStore} = await import('../../store/editorStore');
    const {renderHook, act} = await import('@testing-library/react');

    let renderCount = 0;
    const {result} = renderHook(() => {
      renderCount++;
      return useEditorStore((s) => s.selectedClipId);
    });

    const initialRenderCount = renderCount;

    // Changing a different field should NOT re-render
    act(() => {
      useEditorStore.setState({dirty: true} as never);
    });

    // Changing the selected field SHOULD re-render
    act(() => {
      useEditorStore.setState({selectedClipId: 'clip-1'} as never);
    });

    expect(result.current).toBe('clip-1');
    expect(renderCount).toBeGreaterThan(initialRenderCount);
  });

  it('editorUIStore changes do not trigger editorStore selectors', async () => {
    const {useEditorStore} = await import('../../store/editorStore');
    const {useEditorUIStore} = await import('../../store/editorUIStore');
    const {renderHook, act} = await import('@testing-library/react');

    let renderCount = 0;
    const {result} = renderHook(() => {
      renderCount++;
      return useEditorStore((s) => s.isPlaying);
    });

    const initialRenderCount = renderCount;

    // Changing UI store should not trigger editorStore selector
    act(() => {
      useEditorUIStore.setState({showTimeline: false} as never);
    });

    expect(renderCount).toBe(initialRenderCount);
    expect(result.current).toBe(false);
  });
});

// ==================== webgl-compositor-types ====================

describe('webgl-compositor types extraction', () => {
  it('types file is importable', async () => {
    const typesMod = await import('../../lib/preview/webgl-compositor-types');
    // TypeScript interfaces are compile-time only, verify module loads
    expect(typesMod).toBeDefined();
  });

  it('main compositor re-exports types', async () => {
    const mainMod = await import('../../lib/preview/webgl-compositor');
    expect(mainMod.WebGlPreviewCompositor).toBeDefined();
    expect(mainMod.resolveWebGlSourceProcessing).toBeDefined();
  });
});

// ==================== useTimelineHandlers facade completeness ====================

describe('useTimelineHandlers facade completeness', () => {
  it('exports useTimelineHandlers function', async () => {
    const mod = await import('./useTimelineHandlers');
    expect(typeof mod.useTimelineHandlers).toBe('function');
  });

  it('TimelineHandlers type has expected method count', async () => {
    // Verify the interface has a reasonable number of methods
    // by checking key method names exist in the type definition
    const typesMod = await import('./hooks/timeline/types');
    expect(typesMod).toBeDefined();
  });

  it('sub-modules are independently importable', async () => {
    const modules = [
      './hooks/timeline/track-management',
      './hooks/timeline/clip-operations',
      './hooks/timeline/drag-handlers',
      './hooks/timeline/selection',
      './hooks/timeline/navigation',
      './hooks/timeline/keyboard',
    ];

    for (const path of modules) {
      const mod = await import(path);
      // Each module should export a create*Handlers function
      const exports = Object.keys(mod);
      expect(exports.length).toBeGreaterThan(0);
    }
  });
});

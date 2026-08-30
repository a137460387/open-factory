// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../store/editorStore', () => ({ useEditorStore: { getState: () => ({ project: { media: [] } }) } }));

import { useEditorShellPanelCallbacks } from '../../hooks/useEditorShellPanelCallbacks';

const baseDeps = {
  importMedia: vi.fn(),
  importDropped: vi.fn(),
  openBatchTranscode: vi.fn(),
  batchGenerateCovers: vi.fn(),
  setThumbnailGeneratorAssetIds: vi.fn(),
  setGifExportAsset: vi.fn(),
  setSpectrumAsset: vi.fn(),
  scanDuplicateMedia: vi.fn(),
  addAssetToTimeline: vi.fn(),
  addVersionForMedia: vi.fn(),
  openMediaVersionCompare: vi.fn(),
  addAdjustmentLayer: vi.fn(),
  relinkMedia: vi.fn(),
  relinkAllMissing: vi.fn(),
  generateProxyForMedia: vi.fn(),
  convertVfrMediaToCfr: vi.fn(),
  setMediaMetadata: vi.fn(),
  batchUpdateMediaMetadata: vi.fn(),
  batchRenameMedia: vi.fn(),
  addTitleTemplate: vi.fn(),
  createMediaFolder: vi.fn(),
  renameMediaFolder: vi.fn(),
  deleteMediaFolder: vi.fn(),
  setMediaFolderCollapsed: vi.fn(),
  moveMediaToFolder: vi.fn(),
  applyEffectPresetToSelectedClip: vi.fn(),
  handleToggleFavorite: vi.fn(),
  handleRevealFromMediaBin: vi.fn(),
  handlePinToSession: vi.fn(),
  handleAddSubclip: vi.fn(),
  handleUpdateSubclip: vi.fn(),
  handleDeleteSubclip: vi.fn(),
  handleAddSubclipToTimeline: vi.fn(),
  projectMediaMetadata: {},
};

describe('useEditorShellPanelCallbacks', () => {
  it('returns leftPanelCallbacks', () => {
    const { result } = renderHook(() => useEditorShellPanelCallbacks(baseDeps as any));
    expect(result.current.leftPanelCallbacks).toBeDefined();
  });
});

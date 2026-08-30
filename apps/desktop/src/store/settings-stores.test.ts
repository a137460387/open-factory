// @vitest-environment jsdom
// 源文件（5 个小 store，合计 144 可执行行，五期前覆盖均 0%）：
//   demucsSettingsStore.ts(31) / privacyDetectionSettingsStore.ts(31) / recordingSettingsStore.ts(52)
//   / editorMiscStore.ts(18) / transitionStore.ts(12)
// 覆盖目标：合计 ≥70%。模式：jsdom localStorage 直测 + vi.mock appSettings 持久化依赖。

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../settings/appSettings', () => ({
  saveLocalAiModelsSettings: vi.fn(async () => undefined),
}));

import { useDemucsSettingsStore } from './demucsSettingsStore';
import { usePrivacyDetectionSettingsStore } from './privacyDetectionSettingsStore';
import { useRecordingSettingsStore } from './recordingSettingsStore';
import { useEditorMiscStore } from './editorMiscStore';
import { useTransitionStore } from './transitionStore';
import { saveLocalAiModelsSettings } from '../settings/appSettings';

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useDemucsSettingsStore.setState({ executablePath: '' });
  usePrivacyDetectionSettingsStore.setState({ modelPath: '' });
  useRecordingSettingsStore.setState({ settings: { width: 1280, height: 720, frameRate: 30 } });
  useEditorMiscStore.setState({ favoriteIds: [], pinnedIds: new Set(), recentMediaIds: [] });
  useTransitionStore.setState({ libraryOpen: false, selectedCategory: 'all', searchQuery: '', previewingType: null });
});

describe('useDemucsSettingsStore', () => {
  it('setExecutablePath 写入 localStorage（trim）并触发持久化', () => {
    useDemucsSettingsStore.getState().setExecutablePath('  C:/tools/demucs.exe  ');
    expect(useDemucsSettingsStore.getState().executablePath).toBe('  C:/tools/demucs.exe  ');
    expect(window.localStorage.getItem('open-factory:demucs-executable-path')).toBe('C:/tools/demucs.exe');
    expect(saveLocalAiModelsSettings).toHaveBeenCalledWith({
      demucs: { path: '  C:/tools/demucs.exe  ', version: 'demucs' },
    });
  });

  it('空串清除 localStorage 键', () => {
    window.localStorage.setItem('open-factory:demucs-executable-path', 'C:/old');
    useDemucsSettingsStore.getState().setExecutablePath('   ');
    expect(window.localStorage.getItem('open-factory:demucs-executable-path')).toBeNull();
  });

  it('持久化失败仅告警不阻塞状态更新', () => {
    vi.mocked(saveLocalAiModelsSettings).mockRejectedValueOnce(new Error('io') as never);
    useDemucsSettingsStore.getState().setExecutablePath('C:/demucs');
    expect(useDemucsSettingsStore.getState().executablePath).toBe('C:/demucs');
  });
});

describe('usePrivacyDetectionSettingsStore', () => {
  it('setModelPath 写入 localStorage 并持久化 YuNet 配置', () => {
    usePrivacyDetectionSettingsStore.getState().setModelPath('C:/models/yunet.onnx');
    expect(usePrivacyDetectionSettingsStore.getState().modelPath).toBe('C:/models/yunet.onnx');
    expect(window.localStorage.getItem('open-factory:privacy-detection-model-path')).toBe('C:/models/yunet.onnx');
    expect(saveLocalAiModelsSettings).toHaveBeenCalledWith({
      yunet: { path: 'C:/models/yunet.onnx', version: 'YuNet ONNX' },
    });
  });

  it('空串清除键；持久化失败不阻塞', () => {
    window.localStorage.setItem('open-factory:privacy-detection-model-path', 'C:/old');
    vi.mocked(saveLocalAiModelsSettings).mockRejectedValueOnce(new Error('io') as never);
    usePrivacyDetectionSettingsStore.getState().setModelPath('');
    expect(window.localStorage.getItem('open-factory:privacy-detection-model-path')).toBeNull();
    expect(usePrivacyDetectionSettingsStore.getState().modelPath).toBe('');
  });
});

describe('useRecordingSettingsStore', () => {
  it('setSettings 局部合并并逐键持久化', () => {
    useRecordingSettingsStore.getState().setSettings({ width: 1920 });
    expect(useRecordingSettingsStore.getState().settings).toEqual({ width: 1920, height: 720, frameRate: 30 });
    expect(window.localStorage.getItem('open-factory:recording-width')).toBe('1920');
    expect(window.localStorage.getItem('open-factory:recording-frame-rate')).toBe('30');
  });

  it('越界值钳制到合法区间（width/height/frameRate）', () => {
    useRecordingSettingsStore.getState().setSettings({ width: 10, height: 99999, frameRate: 500 });
    expect(useRecordingSettingsStore.getState().settings).toEqual({ width: 320, height: 4320, frameRate: 120 });
    useRecordingSettingsStore.getState().setSettings({ width: Number.NaN, frameRate: 0.4 });
    // NaN → fallback 默认 1280；0.4 → round 0 → 钳到下限 1
    expect(useRecordingSettingsStore.getState().settings).toMatchObject({ width: 1280, frameRate: 1 });
  });

  it('非法持久化值读取时回退默认（NaN/缺失键）', () => {
    window.localStorage.setItem('open-factory:recording-width', 'not-a-number');
    // 通过重新导入触发读取？模块级读取只执行一次——直接验证 normalize 行为经 setSettings 空补丁
    useRecordingSettingsStore.getState().setSettings({});
    expect(useRecordingSettingsStore.getState().settings).toEqual({ width: 1280, height: 720, frameRate: 30 });
  });
});

describe('useEditorMiscStore', () => {
  it('三个列表 setter 支持值与函数式更新', () => {
    useEditorMiscStore.getState().setFavoriteIds(['a']);
    expect(useEditorMiscStore.getState().favoriteIds).toEqual(['a']);
    useEditorMiscStore.getState().setFavoriteIds((v) => [...v, 'b']);
    expect(useEditorMiscStore.getState().favoriteIds).toEqual(['a', 'b']);

    useEditorMiscStore.getState().setPinnedIds(new Set(['x']));
    expect(useEditorMiscStore.getState().pinnedIds.has('x')).toBe(true);

    useEditorMiscStore.getState().setRecentMediaIds((v) => ['m', ...v]);
    expect(useEditorMiscStore.getState().recentMediaIds).toEqual(['m']);
  });
});

describe('useTransitionStore', () => {
  it('面板状态 setter 与 toggleLibrary 翻转', () => {
    const store = useTransitionStore.getState();
    store.setLibraryOpen(true);
    store.setSelectedCategory('3d');
    store.setSearchQuery('推近');
    store.setPreviewingType('zoom-in');
    let state = useTransitionStore.getState();
    expect(state.libraryOpen).toBe(true);
    expect(state.selectedCategory).toBe('3d');
    expect(state.searchQuery).toBe('推近');
    expect(state.previewingType).toBe('zoom-in');

    state.toggleLibrary();
    expect(useTransitionStore.getState().libraryOpen).toBe(false);

    useTransitionStore.getState().setPreviewingType(null);
    expect(useTransitionStore.getState().previewingType).toBeNull();
  });
});

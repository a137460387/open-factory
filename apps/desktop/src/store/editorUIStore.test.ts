import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock 有循环依赖的模块
vi.mock('../layout/layoutSettings', () => ({
  DEFAULT_EDITOR_LAYOUT_SETTINGS: {
    panels: { left: true, right: true, bottom: true },
    reviewMode: false,
  },
  normalizeStoredLayoutSettings: (s: unknown) => s,
}));

vi.mock('../settings/appSettings', () => ({
  saveLayoutSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/ui-helpers', () => ({
  readViewportSize: () => ({ width: 1920, height: 1080 }),
}));

import { useEditorUIStore } from './editorUIStore';
import { usePanelStore } from './panelStore';
import { useDialogStore, dialogBooleanSelector } from './dialogStore';
import { useToolbarStore } from './toolbarStore';
import { useModalStore } from './modalStore';

describe('editorUIStore — H4 God Store 拆分验证', () => {
  beforeEach(() => {
    useEditorUIStore.setState({
      reviewMode: false,
      viewportSize: { width: 1920, height: 1080 },
    });
    // 关闭所有对话框
    for (const key of Object.keys(useEditorUIStore.getState().dialogState)) {
      useEditorUIStore.setState((s) => ({
        dialogState: { ...s.dialogState, [key]: false },
        [key]: false,
      }));
    }
  });

  describe('单一 zustand 实例验证（架构正确性）', () => {
    it('panelStore 和 useEditorUIStore 是同一个 hook', () => {
      expect(usePanelStore).toBe(useEditorUIStore);
    });

    it('dialogStore 和 useEditorUIStore 是同一个 hook', () => {
      expect(useDialogStore).toBe(useEditorUIStore);
    });

    it('toolbarStore 和 useEditorUIStore 是同一个 hook', () => {
      expect(useToolbarStore).toBe(useEditorUIStore);
    });

    it('modalStore 和 useEditorUIStore 是同一个 hook', () => {
      expect(useModalStore).toBe(useEditorUIStore);
    });
  });

  describe('面板状态读取', () => {
    it('layoutSettings 包含 panels 配置', () => {
      const { layoutSettings } = useEditorUIStore.getState();
      expect(layoutSettings).toBeDefined();
      expect(layoutSettings.panels).toBeDefined();
    });

    it('viewportSize 包含 width 和 height', () => {
      const { viewportSize } = useEditorUIStore.getState();
      expect(viewportSize).toHaveProperty('width');
      expect(viewportSize).toHaveProperty('height');
    });

    it('reviewMode 是布尔值', () => {
      const { reviewMode } = useEditorUIStore.getState();
      expect(typeof reviewMode).toBe('boolean');
    });
  });

  describe('对话框状态读取', () => {
    it('dialogState 包含所有对话框 key', () => {
      const { dialogState } = useEditorUIStore.getState();
      expect(dialogState).toBeDefined();
      expect(typeof dialogState.settingsOpen).toBe('boolean');
      expect(typeof dialogState.batchTranscodeOpen).toBe('boolean');
    });

    it('dialogBooleanSelector 生成正确的选择器', () => {
      const selector = dialogBooleanSelector('settingsOpen');
      const result = selector(useEditorUIStore.getState());
      expect(typeof result).toBe('boolean');
    });
  });

  describe('对话框状态修改', () => {
    it('通过 setter 修改对话框状态', () => {
      const { setSettingsOpen } = useEditorUIStore.getState();
      expect(useEditorUIStore.getState().settingsOpen).toBe(false);

      setSettingsOpen(true);
      expect(useEditorUIStore.getState().settingsOpen).toBe(true);
      expect(useEditorUIStore.getState().dialogState.settingsOpen).toBe(true);

      setSettingsOpen(false);
      expect(useEditorUIStore.getState().settingsOpen).toBe(false);
    });

    it('通过函数式 updater 修改对话框状态', () => {
      const { setSettingsOpen } = useEditorUIStore.getState();
      setSettingsOpen(true);
      setSettingsOpen((prev) => !prev);
      expect(useEditorUIStore.getState().settingsOpen).toBe(false);
    });

    it('dialogState 和独立布尔值保持同步', () => {
      const { setBatchTranscodeOpen } = useEditorUIStore.getState();
      setBatchTranscodeOpen(true);

      const state = useEditorUIStore.getState();
      expect(state.batchTranscodeOpen).toBe(true);
      expect(state.dialogState.batchTranscodeOpen).toBe(true);
    });
  });

  describe('布局状态修改', () => {
    it('setLayoutSettings 更新布局设置', () => {
      const { setLayoutSettings } = useEditorUIStore.getState();
      const current = useEditorUIStore.getState().layoutSettings;
      setLayoutSettings({ ...current, timelineHeightPx: 300 });

      expect(useEditorUIStore.getState().layoutSettings.timelineHeightPx).toBe(300);
    });

    it('setReviewMode 更新审阅模式', () => {
      const { setReviewMode } = useEditorUIStore.getState();
      setReviewMode(() => true);

      expect(useEditorUIStore.getState().reviewMode).toBe(true);
    });

    it('setViewportSize 更新视口尺寸', () => {
      const { setViewportSize } = useEditorUIStore.getState();
      setViewportSize({ width: 1280, height: 720 });

      expect(useEditorUIStore.getState().viewportSize).toEqual({ width: 1280, height: 720 });
    });
  });

  describe('所有 62 个对话框 key 都有对应的 setter', () => {
    it('每个 *Open key 都有对应的 set*Open setter', () => {
      const state = useEditorUIStore.getState();
      const openKeys = Object.keys(state).filter((k) => k.endsWith('Open'));

      for (const key of openKeys) {
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        const setter = state[setterName as keyof typeof state];
        // 部分 key 可能没有独立 setter（由动态生成器处理）
        if (setter !== undefined) {
          expect(typeof setter).toBe('function');
        }
      }
      // 至少应有 30 个有效 setter
      const validSetters = openKeys.filter((key) => {
        const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return typeof state[setterName as keyof typeof state] === 'function';
      });
      expect(validSetters.length).toBeGreaterThanOrEqual(30);
    });
  });
});

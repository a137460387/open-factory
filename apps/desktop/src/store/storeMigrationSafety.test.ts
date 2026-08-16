import { describe, it, expect, beforeEach, vi } from 'vitest';

// 与 editorUIStore.test.ts 保持一致的 mock：editorUIStore 的模块级依赖
// （布局持久化 / 应用设置 / 视口读取）存在循环引用与真实 IO，测试环境需隔离。
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

import { useEditorFeatureStore } from './editorFeatureStore';
import { useAIFeatureStore } from './aiFeatureStore';
import { useExportFeatureStore } from './exportFeatureStore';
import { useTimelineFeatureStore } from './timelineFeatureStore';
import { useMediaFeatureStore } from './mediaFeatureStore';
import { useEditorUIStore } from './editorUIStore';
import { usePanelStore } from './panelStore';
import { useDialogStore } from './dialogStore';
import { useToolbarStore } from './toolbarStore';
import { useModalStore } from './modalStore';

/**
 * 阶段 1a 验证：H4/H5 子 store 与组合 store 是否共享同一 zustand 实例。
 *
 * phase5 调研文档 §1.5 曾假设「组合 store 与子 store 是两份独立状态副本，
 * 迁移漏改会出现双状态源 bug」。本测试用行为级双向读写验证该假设：
 * 所有 H4/H5 子 store 均不自建 store，只是组合 store 的 re-export +
 * selector hooks，因此全仓只存在一个 feature store 实例和一个 UI store 实例。
 *
 * 1b 消费者迁移（组合 hook → 子 store 直连）的判定标准：
 * - 本文件全部通过：消费者在两种路径之间混用/漏改，只影响导入路径一致性，
 *   不会产生状态分歧（同一实例，任一路径写入对另一路径立即可见）。
 * - 任一用例失败：说明出现了第二个 store 实例（如某个子 store 改为自建
 *   create()），必须停止迁移并重新评估状态归属。
 */
describe('store barrel 迁移安全前提（阶段 1a：双状态源风险验证）', () => {
  describe('架构不变量：8 个子 store hook 与组合 hook 是同一引用', () => {
    it('useAIFeatureStore === useEditorFeatureStore', () => {
      expect(useAIFeatureStore).toBe(useEditorFeatureStore);
    });
    it('useExportFeatureStore === useEditorFeatureStore', () => {
      expect(useExportFeatureStore).toBe(useEditorFeatureStore);
    });
    it('useTimelineFeatureStore === useEditorFeatureStore', () => {
      expect(useTimelineFeatureStore).toBe(useEditorFeatureStore);
    });
    it('useMediaFeatureStore === useEditorFeatureStore', () => {
      expect(useMediaFeatureStore).toBe(useEditorFeatureStore);
    });
    it('usePanelStore === useEditorUIStore', () => {
      expect(usePanelStore).toBe(useEditorUIStore);
    });
    it('useDialogStore === useEditorUIStore', () => {
      expect(useDialogStore).toBe(useEditorUIStore);
    });
    it('useToolbarStore === useEditorUIStore', () => {
      expect(useToolbarStore).toBe(useEditorUIStore);
    });
    it('useModalStore === useEditorUIStore', () => {
      expect(useModalStore).toBe(useEditorUIStore);
    });
  });

  describe('行为验证（feature 侧）：任一路径写入，另一路径读取可见', () => {
    beforeEach(() => {
      useEditorFeatureStore.setState({ profilerRecording: false });
    });

    it('组合 hook 写入 → 子 store 别名读取可见', () => {
      useEditorFeatureStore.getState().setProfilerRecording(true);
      expect(useAIFeatureStore.getState().profilerRecording).toBe(true);
    });

    it('子 store 别名写入 → 组合 hook 读取可见', () => {
      useAIFeatureStore.getState().setProfilerRecording(true);
      expect(useEditorFeatureStore.getState().profilerRecording).toBe(true);
    });

    it('跨子 store 别名共享同一状态快照（media 与 timeline 读取同一 state 对象）', () => {
      expect(useMediaFeatureStore.getState()).toBe(useTimelineFeatureStore.getState());
    });
  });

  describe('行为验证（UI 侧）：dialog 状态任一路径写入，另一路径读取可见', () => {
    beforeEach(() => {
      useEditorUIStore.setState((s) => ({
        settingsOpen: false,
        dialogState: { ...s.dialogState, settingsOpen: false },
      }));
    });

    it('useEditorUIStore 写入 → useDialogStore 别名读取可见', () => {
      useEditorUIStore.getState().setSettingsOpen(true);
      expect(useDialogStore.getState().settingsOpen).toBe(true);
    });

    it('useDialogStore 别名写入 → useEditorUIStore 读取可见', () => {
      useDialogStore.getState().setSettingsOpen(true);
      expect(useEditorUIStore.getState().settingsOpen).toBe(true);
    });

    it('useDialogStore 与 usePanelStore 共享同一状态快照', () => {
      expect(useDialogStore.getState()).toBe(usePanelStore.getState());
    });
  });
});

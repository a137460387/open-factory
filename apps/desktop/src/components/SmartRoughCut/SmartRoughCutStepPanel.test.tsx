// @vitest-environment jsdom
// 覆盖目标：apps/desktop/src/components/SmartRoughCut/SmartRoughCutStepPanel.tsx
// 的 M2 参数控件（ParamSlider / sensitivity segmented）与 playhead 联动渲染层。
// 策略：mock useSmartRoughCut 整体（编排逻辑已由 useSmartRoughCut.test.ts 覆盖），
// 只断言面板对 hook 契约的消费：控件渲染/禁用联动/change 透传。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { makeClip } from '../Timeline/hooks/timeline/__tests__/test-fixtures';

const mockHook = vi.fn();

vi.mock('./useSmartRoughCut', () => ({
  useSmartRoughCut: (...args: unknown[]) => mockHook(...args),
}));

import { SmartRoughCutStepPanel } from './SmartRoughCutStepPanel';

function makeHookResult(overrides: Record<string, unknown> = {}) {
  return {
    stepState: {
      steps: {
        scene: { status: 'idle' },
        silence: { status: 'idle' },
        whisper: { status: 'idle' },
        dialogue: { status: 'idle' },
        broll: { status: 'idle' },
        rhythm: { status: 'idle' },
      },
      report: {
        sceneSplits: 0,
        removedSilenceSeconds: 0,
        subtitleClips: 0,
        dialogueClips: 0,
        brollClips: 0,
        rhythmClips: 0,
      },
    },
    pendingScene: undefined,
    setPendingScene: vi.fn(),
    pendingSilence: undefined,
    setPendingSilence: vi.fn(),
    whisperAvailability: { ready: false },
    anyRunning: false,
    canRunScene: true,
    canRunSilence: true,
    canRunWhisper: false,
    canRunDialogue: true,
    canRunBroll: false,
    canRunRhythm: false,
    videoTracks: [],
    rhythmBeatTimes: [],
    brollTrackId: '',
    setBrollTrackId: vi.fn(),
    rhythmTrackId: '',
    setRhythmTrackId: vi.fn(),
    sceneThreshold: 0.3,
    setSceneThreshold: vi.fn(),
    silenceMinDb: -40,
    setSilenceMinDb: vi.fn(),
    silenceMinDuration: 0.5,
    setSilenceMinDuration: vi.fn(),
    silenceMargin: 0.1,
    setSilenceMargin: vi.fn(),
    dialogueSensitivity: 'medium' as const,
    setDialogueSensitivity: vi.fn(),
    setPlayheadTime: vi.fn(),
    speechUnderstanding: { ready: false, transcript: '', timeAlignment: [], segmentCount: 0, understanding: undefined },
    semanticSuggestions: [],
    semanticReady: false,
    runSceneDetection: vi.fn(),
    runSilenceDetection: vi.fn(),
    runWhisper: vi.fn(),
    runDialogueRoughCut: vi.fn(),
    runBrollInsert: vi.fn(),
    runRhythmAssemble: vi.fn(),
    applySceneSplit: vi.fn(),
    applySilenceRemoval: vi.fn(),
    applySemanticSuggestion: vi.fn(),
    ...overrides,
  };
}

function renderPanel(overrides: Record<string, unknown> = {}) {
  mockHook.mockReturnValue(makeHookResult(overrides));
  const clip = makeClip({ id: 'clip-1', type: 'video' }) as Clip;
  return render(<SmartRoughCutStepPanel selectedClip={clip} media={[] as MediaAsset[]} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SmartRoughCutStepPanel param controls', () => {
  it('renders scene and silence sliders with the hook-provided defaults', () => {
    renderPanel();
    const threshold = screen.getByTestId('smart-scene-threshold') as HTMLInputElement;
    expect(threshold.value).toBe('0.3');

    expect((screen.getByTestId('smart-silence-min-db') as HTMLInputElement).value).toBe('-40');
    expect((screen.getByTestId('smart-silence-min-duration') as HTMLInputElement).value).toBe('0.5');
    expect((screen.getByTestId('smart-silence-margin') as HTMLInputElement).value).toBe('0.1');
  });

  it('disables the param sliders while any step is running', () => {
    renderPanel({ anyRunning: true });
    expect((screen.getByTestId('smart-scene-threshold') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('smart-silence-min-db') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('smart-silence-min-duration') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('smart-silence-margin') as HTMLInputElement).disabled).toBe(true);
  });

  it('forwards slider changes to the hook setters', () => {
    const setSceneThreshold = vi.fn();
    renderPanel({ setSceneThreshold });

    fireEvent.change(screen.getByTestId('smart-scene-threshold'), { target: { value: '0.2' } });
    expect(setSceneThreshold).toHaveBeenCalledWith(0.2);
  });

  it('renders the dialogue sensitivity segmented control and forwards selection', () => {
    const setDialogueSensitivity = vi.fn();
    renderPanel({ setDialogueSensitivity });

    // dialogue tab 不在 basic 默认 tab，先切换
    fireEvent.click(screen.getByTestId('smart-rough-cut-tab-dialogue'));
    const group = screen.getByTestId('smart-dialogue-sensitivity');
    // 默认值 data-value 属性契约
    expect(group.getAttribute('data-value')).toBe('medium');

    fireEvent.click(screen.getByTestId('smart-dialogue-sensitivity-high'));
    expect(setDialogueSensitivity).toHaveBeenCalledWith('high');
  });

  it('disables sensitivity buttons while any step is running', () => {
    renderPanel({ anyRunning: true });
    fireEvent.click(screen.getByTestId('smart-rough-cut-tab-dialogue'));
    expect(
      screen
        .getAllByTestId(/^smart-dialogue-sensitivity-(low|medium|high)$/)
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});

// ── M3-2：语义建议列表接线（hook 返回值 → 组件 props） ──────

describe('SmartRoughCutStepPanel semantic suggestion list', () => {
  it('renders the gated hint when speechUnderstanding is not ready', () => {
    renderPanel();

    const section = screen.getByTestId('smart-semantic');
    expect(section.getAttribute('data-ready')).toBe('false');
    expect(screen.getByTestId('smart-semantic-hint')).toBeDefined();
  });

  it('renders hook-provided suggestions with ready state on the basic tab', () => {
    renderPanel({
      semanticReady: true,
      semanticSuggestions: [
        {
          id: 'semantic-0',
          timeRange: { start: 1.6, end: 2.5 },
          markerType: 'climax',
          confidence: 0.7,
          label: '高潮片段',
          reason: '重点内容',
          source: 'narrative',
        },
      ],
    });

    expect(screen.getByTestId('smart-semantic').getAttribute('data-ready')).toBe('true');
    const item = screen.getByTestId('smart-semantic-item-semantic-0');
    expect(item.getAttribute('data-climax')).toBe('true');
    expect(item.getAttribute('data-source')).toBe('narrative');
    expect(item.textContent).toContain('高潮片段');
  });

  it('forwards item hover to the hook setPlayheadTime with the range start', () => {
    const setPlayheadTime = vi.fn();
    renderPanel({
      semanticReady: true,
      semanticSuggestions: [
        {
          id: 'semantic-0',
          timeRange: { start: 1.6, end: 2.5 },
          markerType: 'climax',
          confidence: 0.7,
          label: '高潮片段',
          reason: '重点内容',
          source: 'narrative',
        },
      ],
      setPlayheadTime,
    });

    fireEvent.mouseEnter(screen.getByTestId('smart-semantic-item-semantic-0'));

    expect(setPlayheadTime).toHaveBeenCalledWith(1.6);
  });

  it('keeps the semantic list on the basic tab only', () => {
    renderPanel({
      semanticReady: true,
      semanticSuggestions: [
        {
          id: 'semantic-0',
          timeRange: { start: 0, end: 1 },
          markerType: 'opening',
          confidence: 0.8,
          label: '开场',
          reason: '开场白',
          source: 'narrative',
        },
      ],
    });

    fireEvent.click(screen.getByTestId('smart-rough-cut-tab-dialogue'));
    expect(screen.queryByTestId('smart-semantic')).toBeNull();
  });
});

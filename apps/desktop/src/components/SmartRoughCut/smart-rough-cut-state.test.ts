import { describe, expect, it } from 'vitest';
import {
  createInitialSmartRoughCutState,
  createSmartRoughCutSelection,
  getSelectedSmartRoughCutIds,
  markSmartRoughCutStepComplete,
  markSmartRoughCutStepError,
  markSmartRoughCutStepRunning,
  setAllSmartRoughCutSelection,
  toggleSmartRoughCutSelection,
} from './smart-rough-cut-state';

describe('smart rough cut state', () => {
  it('tracks independent step status and report totals', () => {
    const initial = createInitialSmartRoughCutState();

    const running = markSmartRoughCutStepRunning(initial, 'scene');
    expect(running.steps.scene.status).toBe('running');
    expect(running.steps.silence.status).toBe('idle');

    const sceneComplete = markSmartRoughCutStepComplete(running, 'scene', { sceneSplits: 3 });
    expect(sceneComplete.steps.scene.status).toBe('complete');
    expect(sceneComplete.report.sceneSplits).toBe(3);
    expect(sceneComplete.report.removedSilenceSeconds).toBe(0);

    const silenceComplete = markSmartRoughCutStepComplete(sceneComplete, 'silence', { removedSilenceSeconds: 1.25 });
    expect(silenceComplete.steps.scene.status).toBe('complete');
    expect(silenceComplete.steps.silence.status).toBe('complete');
    expect(silenceComplete.report).toMatchObject({ sceneSplits: 3, removedSilenceSeconds: 1.25, subtitleClips: 0 });
  });

  it('stores errors without resetting completed steps', () => {
    const completed = markSmartRoughCutStepComplete(createInitialSmartRoughCutState(), 'whisper', { subtitleClips: 2 });
    const failed = markSmartRoughCutStepError(completed, 'scene', 'No scene cuts');

    expect(failed.steps.whisper.status).toBe('complete');
    expect(failed.steps.scene).toEqual({ status: 'error', error: 'No scene cuts' });
    expect(failed.report.subtitleClips).toBe(2);
  });

  it('tracks selectable rough cut result items', () => {
    const initial = createSmartRoughCutSelection(['a', 'b', 'c']);
    expect(getSelectedSmartRoughCutIds(initial)).toEqual(['a', 'b', 'c']);

    const toggled = toggleSmartRoughCutSelection(initial, 'b');
    expect(getSelectedSmartRoughCutIds(toggled)).toEqual(['a', 'c']);
    expect(toggleSmartRoughCutSelection(toggled, 'missing')).toBe(toggled);

    const none = setAllSmartRoughCutSelection(toggled, false);
    expect(getSelectedSmartRoughCutIds(none)).toEqual([]);

    const all = setAllSmartRoughCutSelection(none, true);
    expect(getSelectedSmartRoughCutIds(all)).toEqual(['a', 'b', 'c']);
  });
});

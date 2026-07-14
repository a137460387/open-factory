import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import { setLanguage } from '../i18n/strings';
import type { AutomationRule } from '../settings/appSettings';
import { evaluateAutomationCondition, parseAutomationRulesJson, runAutomationRulesForMedia } from './automation-rules';

const video: MediaAsset = {
  id: 'asset-long',
  type: 'video',
  name: 'long-interview.mov',
  path: 'D:/Media/long-interview.mov',
  duration: 420,
  width: 3840,
  height: 2160,
  size: 640 * 1024 * 1024,
  mtimeMs: 1_000,
  videoCodec: 'hevc',
};

describe('automation rules', () => {
  beforeAll(() => {
    setLanguage('en');
  });

  it('matches numeric and text conditions for media fields', () => {
    expect(evaluateAutomationCondition(video, { field: 'duration', op: '>', value: 300 })).toBe(true);
    expect(evaluateAutomationCondition(video, { field: 'height', op: '<=', value: 2160 })).toBe(true);
    expect(evaluateAutomationCondition(video, { field: 'format', op: 'contains', value: 'mov' })).toBe(true);
    expect(evaluateAutomationCondition(video, { field: 'name', op: 'contains', value: 'INTERVIEW' })).toBe(true);
    expect(evaluateAutomationCondition(video, { field: 'duration', op: '<=', value: 300 })).toBe(false);
  });

  it('parses a single JSON rule into normalized rule arrays', () => {
    const parsed = parseAutomationRulesJson(
      JSON.stringify({
        trigger: 'on-import',
        conditions: [{ field: 'duration', op: '>', value: 300 }],
        actions: [{ type: 'generate-proxy' }],
      }),
    );

    expect(parsed).toEqual({
      ok: true,
      rules: [
        {
          id: 'automation-rule-1',
          enabled: true,
          trigger: 'on-import',
          conditions: [{ field: 'duration', op: '>', value: 300 }],
          actions: [{ type: 'generate-proxy' }],
        },
      ],
    });
  });

  it('executes matched automation actions through dependencies only', async () => {
    const rule: AutomationRule = {
      id: 'long-video-actions',
      enabled: true,
      trigger: 'on-import',
      conditions: [{ field: 'duration', op: '>', value: 300 }],
      actions: [
        { type: 'generate-proxy' },
        { type: 'add-tag', value: 'green' },
        { type: 'move-to-group', value: 'Long videos' },
        { type: 'send-notification' },
      ],
    };
    const dependencies = {
      enqueueProxy: vi.fn(),
      setLabel: vi.fn(),
      moveToGroup: vi.fn(),
      notify: vi.fn(),
    };

    await expect(
      runAutomationRulesForMedia([rule], { trigger: 'on-import', media: [video] }, dependencies),
    ).resolves.toEqual([
      { ruleId: 'long-video-actions', assetId: 'asset-long', action: 'generate-proxy' },
      { ruleId: 'long-video-actions', assetId: 'asset-long', action: 'add-tag' },
      { ruleId: 'long-video-actions', assetId: 'asset-long', action: 'move-to-group' },
      { ruleId: 'long-video-actions', assetId: 'asset-long', action: 'send-notification' },
    ]);
    expect(dependencies.enqueueProxy).toHaveBeenCalledWith(video);
    expect(dependencies.setLabel).toHaveBeenCalledWith('asset-long', 'green');
    expect(dependencies.moveToGroup).toHaveBeenCalledWith(video, 'Long videos');
    expect(dependencies.notify).toHaveBeenCalledWith('Automation rule triggered', 'Processed long-interview.mov.');
  });
});

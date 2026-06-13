import { describe, expect, it, vi } from 'vitest';
import type { ExportConditionRule } from '../settings/appSettings';
import { replaceExportRuleVariables, resolveCopyDestination, runExportRuleEvent } from './export-rules';

describe('export condition rules', () => {
  it('replaces date and project variables with a path-safe project segment', () => {
    expect(
      replaceExportRuleVariables('D:/Out/{date}/{project}', {
        date: new Date('2026-06-13T08:00:00.000Z'),
        projectName: 'My: Project?'
      })
    ).toBe('D:/Out/20260613/My_ Project_');
  });

  it('resolves copy destinations next to the rendered file name', () => {
    const rule: ExportConditionRule = {
      id: 'copy-success',
      enabled: true,
      trigger: 'export-success',
      action: 'copy-to-directory',
      targetDirectory: 'C:/Exports/{project}'
    };

    expect(
      resolveCopyDestination(rule, {
        type: 'export-success',
        projectName: 'Review Cut',
        task: { name: 'review.mp4', outputPath: 'D:/Renders/review.mp4' }
      })
    ).toBe('C:/Exports/Review Cut/review.mp4');
  });

  it('runs only enabled rules matching the current event trigger', async () => {
    const rules: ExportConditionRule[] = [
      {
        id: 'copy-success',
        enabled: true,
        trigger: 'export-success',
        action: 'copy-to-directory',
        targetDirectory: 'C:/Exports/{date}'
      },
      {
        id: 'failure-notification',
        enabled: true,
        trigger: 'export-failure',
        action: 'system-notification'
      },
      {
        id: 'disabled-tone',
        enabled: false,
        trigger: 'queue-complete',
        action: 'play-tone'
      },
      {
        id: 'queue-tone',
        enabled: true,
        trigger: 'queue-complete',
        action: 'play-tone'
      }
    ];
    const copyFile = vi.fn();
    const notify = vi.fn();
    const playTone = vi.fn();

    await expect(
      runExportRuleEvent(
        rules,
        { type: 'export-success', date: new Date('2026-06-13T00:00:00.000Z'), task: { name: 'out.mp4', outputPath: 'D:/Renders/out.mp4' } },
        { copyFile, notify, playTone }
      )
    ).resolves.toEqual([{ ruleId: 'copy-success', action: 'copy-to-directory', targetPath: 'C:/Exports/20260613/out.mp4' }]);
    expect(copyFile).toHaveBeenCalledWith('D:/Renders/out.mp4', 'C:/Exports/20260613/out.mp4');
    expect(notify).not.toHaveBeenCalled();
    expect(playTone).not.toHaveBeenCalled();

    await runExportRuleEvent(rules, { type: 'export-failure', task: { name: 'bad.mp4', outputPath: 'D:/Renders/bad.mp4', error: 'ffmpeg failed' } }, { copyFile, notify, playTone });
    expect(notify).toHaveBeenCalledWith('导出失败', 'ffmpeg failed');

    await runExportRuleEvent(rules, { type: 'queue-complete' }, { copyFile, notify, playTone });
    expect(playTone).toHaveBeenCalledTimes(1);
  });
});

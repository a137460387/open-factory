// 覆盖目标：packages/editor-core/src/commands/timeline/clip-smart-commands.ts
// 的 ApplyRoughCutProposalCommand（应用智能粗剪提案）。
// 锁定：source 域 → clip 本地域换算（trimStart/speed）、保留段 + 波纹删间隙、
// undo/redo 快照恢复、空段/全选拒绝、乱序与越界段归一化。
import { describe, expect, it } from 'vitest';
import { ApplyRoughCutProposalCommand, CommandManager, type RoughCutSegment } from '../src';
import { makeAccessor, makeTimeline, makeVideoClip } from './test-utils';

function segment(sourceStart: number, sourceEnd: number): RoughCutSegment {
  return {
    sourceStart,
    sourceEnd,
    duration: sourceEnd - sourceStart,
    score: 0.8,
    visualScore: 0.7,
    audioScore: 0.6,
  };
}

describe('ApplyRoughCutProposalCommand', () => {
  it('keeps proposal segments and ripples the gaps between them', () => {
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-proposal', duration: 3 })]));
    const manager = new CommandManager();
    const command = new ApplyRoughCutProposalCommand(accessor, 'clip-proposal', [
      segment(0, 1),
      segment(2, 3),
    ]);

    manager.execute(command);

    const clips = accessor.current().tracks[0].clips;
    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => [clip.start, clip.duration])).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(clips.map((clip) => clip.trimStart)).toEqual([0, 2]);
    expect(command.keptSegmentCount).toBe(2);
  });

  it('converts source-domain segments with trimStart and speed', () => {
    // trimStart=5 speed=2 duration=3 → source 窗口 [5, 11]
    // segments [6,8] [9,10] → local [0.5,1.5] [2,2.5]
    const accessor = makeAccessor(
      makeTimeline([makeVideoClip({ id: 'clip-convert', duration: 3, trimStart: 5, speed: 2 })]),
    );
    const manager = new CommandManager();

    manager.execute(
      new ApplyRoughCutProposalCommand(accessor, 'clip-convert', [segment(6, 8), segment(9, 10)]),
    );

    const clips = accessor.current().tracks[0].clips;
    expect(clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [0, 1, 6],
      [1, 0.5, 9],
    ]);
  });

  it('restores the original clip on undo and re-applies on redo', () => {
    const original = makeVideoClip({ id: 'clip-undo', duration: 3 });
    const accessor = makeAccessor(makeTimeline([original]));
    const manager = new CommandManager();

    manager.execute(new ApplyRoughCutProposalCommand(accessor, 'clip-undo', [segment(0, 1), segment(2, 3)]));
    manager.undo();
    expect(accessor.current().tracks[0].clips).toEqual([original]);

    manager.redo();
    expect(accessor.current().tracks[0].clips).toHaveLength(2);
  });

  it('rejects empty selection and full-clip selection', () => {
    const emptyAccessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-empty', duration: 3 })]));
    expect(
      () => new ApplyRoughCutProposalCommand(emptyAccessor, 'clip-empty', []).execute(),
    ).toThrow('No proposal segments');

    const fullAccessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-full', duration: 3 })]));
    expect(
      () => new ApplyRoughCutProposalCommand(fullAccessor, 'clip-full', [segment(0, 3)]).execute(),
    ).toThrow('entire clip');
  });

  it('normalizes out-of-order, overlapping, and out-of-window segments', () => {
    // 乱序 + 越界钳制（trimStart=0，窗口 [0,4]）：[5,6] 全越界被过滤；
    // [2,3.5] 与 [3,4] 重叠合并为 [2,4]
    const accessor = makeAccessor(makeTimeline([makeVideoClip({ id: 'clip-normalize', duration: 4 })]));
    const manager = new CommandManager();
    const command = new ApplyRoughCutProposalCommand(accessor, 'clip-normalize', [
      segment(2, 3.5),
      segment(5, 6),
      segment(0, 1),
      segment(3, 4),
    ]);

    manager.execute(command);

    const clips = accessor.current().tracks[0].clips;
    expect(command.keptSegmentCount).toBe(2);
    expect(clips.map((clip) => [clip.start, clip.duration, clip.trimStart])).toEqual([
      [0, 1, 0],
      [1, 2, 2],
    ]);
  });
});

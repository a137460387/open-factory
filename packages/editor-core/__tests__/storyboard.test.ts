import { describe, expect, it } from 'vitest';
import { buildStoryboardReorderStarts, getStoryboardCards, reorderStoryboardClipIds, CommandManager, DeleteClipsCommand, MoveClipsCommand } from '../src';
import { makeAccessor, makeImageClip, makeTextClip, makeTimeline, makeVideoClip } from './test-utils';

describe('storyboard', () => {
  it('sorts storyboard cards by timeline order and ignores text clips', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-b', start: 2, duration: 1 }),
      makeTextClip({ id: 'title', start: 1 }),
      makeImageClip({ id: 'clip-a', start: 0, duration: 2 })
    ]);

    expect(getStoryboardCards(timeline).map((card) => card.clip.id)).toEqual(['clip-a', 'clip-b']);
  });

  it('builds move starts that update timeline order after card sorting', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
        makeVideoClip({ id: 'clip-b', start: 2, duration: 3 }),
        makeImageClip({ id: 'clip-c', start: 5, duration: 1 })
      ])
    );
    const manager = new CommandManager();
    const currentIds = getStoryboardCards(accessor.current()).map((card) => card.clip.id);
    const nextIds = reorderStoryboardClipIds(currentIds, 'clip-c', 'clip-a');
    const starts = buildStoryboardReorderStarts(accessor.current(), nextIds);

    manager.execute(new MoveClipsCommand(accessor, starts));

    expect(accessor.current().tracks[0].clips.map((clip) => [clip.id, clip.start])).toEqual([
      ['clip-a', 1],
      ['clip-b', 3],
      ['clip-c', 0]
    ]);
  });

  it('multi-select delete removes storyboard clips and undo restores them', () => {
    const accessor = makeAccessor(
      makeTimeline([
        makeVideoClip({ id: 'clip-a', start: 0, duration: 1 }),
        makeVideoClip({ id: 'clip-b', start: 2, duration: 1 }),
        makeVideoClip({ id: 'clip-c', start: 4, duration: 1 })
      ])
    );
    const manager = new CommandManager();

    manager.execute(new DeleteClipsCommand(accessor, ['clip-a', 'clip-c']));
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-b']);

    manager.undo();
    expect(accessor.current().tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-a', 'clip-b', 'clip-c']);
  });
});

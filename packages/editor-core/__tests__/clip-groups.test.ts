import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIP_GROUP_COLOR,
  DEFAULT_CLIP_GROUP_NAME,
  calculateClipGroupMoveStarts,
  createClipGroup,
  findClipGroupForClip,
  normalizeClipGroups,
  removeClipIdsFromGroups
} from '../src';
import { makeVideoClip } from './test-utils';

describe('clip groups', () => {
  it('normalizes invalid names, colors, duplicate clips, and overlapping memberships', () => {
    const groups = normalizeClipGroups(
      [
        { id: '', name: '   ', clipIds: ['clip-a', 'clip-a', 'clip-b', 'missing'], color: 'invalid' },
        { id: 'group-overlap', name: 'Overlap', clipIds: ['clip-b', 'clip-c'], color: 'green' },
        { id: 'group-short', name: 'Short', clipIds: ['clip-d'], color: 'rose' }
      ],
      ['clip-a', 'clip-b', 'clip-c']
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      name: DEFAULT_CLIP_GROUP_NAME,
      clipIds: ['clip-a', 'clip-b'],
      color: DEFAULT_CLIP_GROUP_COLOR
    });
    expect(groups[0].id).toBeTruthy();
  });

  it('creates groups and rejects selections with fewer than two valid clips', () => {
    expect(createClipGroup({ id: 'group-a', name: 'A', clipIds: ['clip-a', 'clip-b'], color: 'cyan' }, ['clip-a', 'clip-b'])).toEqual({
      id: 'group-a',
      name: 'A',
      clipIds: ['clip-a', 'clip-b'],
      color: 'cyan'
    });

    expect(() => createClipGroup({ clipIds: ['clip-a', 'missing'] }, ['clip-a'])).toThrow('at least two clips');
  });

  it('finds clip groups and removes clip ids while dropping invalid leftovers', () => {
    const groups = [
      { id: 'group-a', name: 'A', clipIds: ['clip-a', 'clip-b'], color: 'blue' as const },
      { id: 'group-b', name: 'B', clipIds: ['clip-c', 'clip-d'], color: 'green' as const }
    ];

    expect(findClipGroupForClip(groups, 'clip-c')?.id).toBe('group-b');
    expect(findClipGroupForClip(groups, 'missing')).toBeUndefined();
    expect(removeClipIdsFromGroups(groups, ['clip-a', 'clip-c']).map((group) => group.id)).toEqual([]);
  });

  it('returns empty move maps and rejects dragged clips outside the group', () => {
    expect(calculateClipGroupMoveStarts([], ['missing'], 'missing', 1)).toEqual({});
    expect(() =>
      calculateClipGroupMoveStarts([makeVideoClip({ id: 'clip-a', start: 1 }), makeVideoClip({ id: 'clip-b', start: 2 })], ['clip-a'], 'clip-b', 4)
    ).toThrow('not part of the group');
  });
});

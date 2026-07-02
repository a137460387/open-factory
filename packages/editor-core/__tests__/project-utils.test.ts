import { describe, expect, it } from 'vitest';
import { projectUsesMediaOnTimeline } from '../src/project/project-utils';
import type { Project } from '../src/model-types';

function makeProject(tracks: Array<{ clips: Array<{ mediaId?: string }> }>): Project {
  return {
    timeline: {
      tracks: tracks.map((track) => ({
        id: 'track-1',
        type: 'video' as const,
        name: '',
        clips: track.clips.map((clip, i) => ({
          id: `clip-${i}`,
          type: 'media' as const,
          mediaId: clip.mediaId,
          startInSource: 0,
          duration: 10,
          startTime: i * 10,
        })),
      })),
    },
  } as unknown as Project;
}

describe('projectUsesMediaOnTimeline', () => {
  it('returns true when a clip references the given assetId', () => {
    const project = makeProject([{ clips: [{ mediaId: 'asset-abc' }] }]);
    expect(projectUsesMediaOnTimeline(project, 'asset-abc')).toBe(true);
  });

  it('returns false when no clip references the given assetId', () => {
    const project = makeProject([{ clips: [{ mediaId: 'asset-xyz' }] }]);
    expect(projectUsesMediaOnTimeline(project, 'asset-abc')).toBe(false);
  });
});


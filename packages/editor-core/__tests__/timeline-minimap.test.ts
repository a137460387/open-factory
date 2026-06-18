import { describe, expect, it } from 'vitest';
import {
  buildTimelineMinimapLayout,
  calculateTimelineMinimapViewportRect,
  calculateTimelineScrollLeftFromMinimapY,
  type Timeline
} from '../src';

function timeline(): Timeline {
  return {
    tracks: [
      {
        id: 'video-1',
        type: 'video',
        name: 'V1',
        color: 'blue',
        clips: [
          {
            id: 'clip-a',
            type: 'video',
            name: 'A',
            trackId: 'video-1',
            mediaId: 'media-a',
            start: 10,
            duration: 20,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
          }
        ]
      },
      {
        id: 'audio-1',
        type: 'audio',
        name: 'A1',
        color: 'green',
        clips: [
          {
            id: 'clip-b',
            type: 'audio',
            name: 'B',
            trackId: 'audio-1',
            mediaId: 'media-b',
            start: 50,
            duration: 10,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            volume: 1,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
          }
        ]
      }
    ]
  };
}

describe('timeline minimap', () => {
  it('converts timeline scroll position into a minimap viewport rectangle', () => {
    const rect = calculateTimelineMinimapViewportRect({
      scrollLeft: 1138,
      viewportWidth: 1138,
      labelWidth: 138,
      zoom: 10,
      duration: 300,
      minimapHeight: 300
    });

    expect(rect.start).toBe(100);
    expect(rect.end).toBe(200);
    expect(rect.y).toBe(100);
    expect(rect.height).toBe(100);
  });

  it('converts minimap click coordinates into a centered timeline scroll target', () => {
    expect(
      calculateTimelineScrollLeftFromMinimapY({
        y: 150,
        viewportWidth: 1138,
        labelWidth: 138,
        zoom: 10,
        duration: 300,
        minimapHeight: 300
      })
    ).toBe(1138);
  });

  it('lays out timeline markers, bookmarks, and export range edges', () => {
    const layout = buildTimelineMinimapLayout(timeline(), {
      duration: 100,
      width: 120,
      height: 200,
      markers: [{ id: 'marker-1', time: 25, label: 'Beat', color: '#f97316' }],
      bookmarks: [{ id: 'bookmark-1', time: 40, note: 'Pick' }],
      exportRanges: [{ id: 'range-1', label: 'Export', start: 10, end: 70 }]
    });

    expect(layout.tracks).toHaveLength(2);
    expect(layout.clips.find((clip) => clip.id === 'clip-a')).toMatchObject({ y: 20, height: 40 });
    expect(layout.markers.map((marker) => marker.kind)).toEqual(['export-range-start', 'export-range-end', 'marker', 'bookmark']);
    expect(layout.markers.map((marker) => marker.y)).toEqual([20, 140, 50, 80]);
  });

  it('samples large minimap clip lists to the configured limit while keeping the end points', () => {
    const clips = Array.from({ length: 12 }, (_, index) => ({
      id: `clip-${index}`,
      type: 'video' as const,
      name: `Clip ${index}`,
      trackId: 'video-1',
      mediaId: 'media-a',
      start: index,
      duration: 0.5,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      volume: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
    }));
    const layout = buildTimelineMinimapLayout(
      {
        tracks: [
          {
            id: 'video-1',
            type: 'video',
            name: 'V1',
            clips
          }
        ]
      },
      { duration: 20, height: 120, maxClips: 5 }
    );

    expect(layout.clips).toHaveLength(5);
    expect(layout.clips[0].id).toBe('clip-0');
    expect(layout.clips[layout.clips.length - 1].id).toBe('clip-11');
  });
});

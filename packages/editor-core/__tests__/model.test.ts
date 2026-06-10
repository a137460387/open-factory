import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM,
  createBaseClip,
  createDefaultTimeline,
  createId,
  createProject,
  createTimelineMarker,
  normalizeTimelineMarkers,
  serializeLegacyProject
} from '../src';
import { makeProject } from './test-utils';

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

afterEach(() => {
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  }
});

describe('model factories', () => {
  it('creates projects with default settings and editable default tracks', () => {
    const project = createProject();

    expect(project.name).toBe('Untitled Project');
    expect(project.version).toBe('0.2');
    expect(project.masterVolume).toBe(1);
    expect(project.settings).toEqual(DEFAULT_PROJECT_SETTINGS);
    expect(project.media).toEqual([]);
    expect(project.timeline.tracks.map((track) => track.type)).toEqual(['video', 'audio', 'text']);
    expect(project.timeline.tracks.every((track) => track.clips.length === 0)).toBe(true);
    expect(project.timeline.tracks.every((track) => track.pan === 0 && track.volume === 1)).toBe(true);
  });

  it('creates a default timeline with independent track ids', () => {
    const timeline = createDefaultTimeline();
    const ids = timeline.tracks.map((track) => track.id);

    expect(new Set(ids).size).toBe(3);
    expect(timeline.tracks.map((track) => track.name)).toEqual(['Video 1', 'Audio 1', 'Text 1']);
    expect(timeline.markers).toEqual([]);
  });

  it('normalizes timeline markers with bounded time, fallback label, and color', () => {
    expect(createTimelineMarker({ id: 'marker-1', time: -5, label: '  ', color: 'red' }, 10)).toEqual({
      id: 'marker-1',
      time: 0,
      label: 'Marker',
      color: '#f97316'
    });
    expect(normalizeTimelineMarkers([{ id: 'marker-b', time: 9, label: 'B', color: '#AABBCC' }, { id: 'marker-a', time: 2, label: 'A', color: '#112233' }], 5)).toEqual([
      { id: 'marker-a', time: 2, label: 'A', color: '#112233' },
      { id: 'marker-b', time: 5, label: 'B', color: '#aabbcc' }
    ]);
  });

  it('creates base clips by clamping timing values and merging transforms', () => {
    const clip = createBaseClip({
      name: 'Clamped',
      trackId: 'track-video',
      start: -1,
      duration: -2,
      trimStart: -3,
      trimEnd: 1.23456,
      transform: { ...DEFAULT_TRANSFORM, opacity: 0.25, x: 12 }
    });

    expect(clip.id).toEqual(expect.any(String));
    expect(clip.id.length).toBeGreaterThan(0);
    expect(clip.start).toBe(0);
    expect(clip.duration).toBe(0);
    expect(clip.trimStart).toBe(0);
    expect(clip.trimEnd).toBe(1.23456);
    expect(clip.transform).toEqual({ ...DEFAULT_TRANSFORM, opacity: 0.25, x: 12 });
  });

  it('serializes legacy projects without sharing nested transform objects', () => {
    const project = makeProject();
    project.timeline.markers = [{ id: 'marker-1', time: 1, label: 'Intro', color: '#f97316' }];
    const legacy = serializeLegacyProject(project);

    expect(legacy.version).toBe('0.1');
    expect(legacy.project.settings).toEqual(project.settings);
    expect(legacy.assets[0]).toEqual(project.media[0]);
    expect(legacy.timeline.markers).toEqual(project.timeline.markers);
    legacy.timeline.tracks[0].clips[0].transform.opacity = 0.1;
    legacy.timeline.markers![0].label = 'Changed';
    expect(project.timeline.tracks[0].clips[0].transform.opacity).toBe(1);
    expect(project.timeline.markers[0].label).toBe('Intro');
  });

  it('falls back to a generated id when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

    const id = createId('fallback');

    expect(id).toMatch(/^fallback-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('exports stable default constants for UI and clip factories', () => {
    expect(DEFAULT_TRANSFORM).toEqual({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    expect(DEFAULT_TEXT_STYLE).toMatchObject({ fontSize: 48, color: '#ffffff', bold: false, italic: false });
  });
});

import { describe, expect, it } from 'vitest';
import { applyCmx3600EdlImport, buildCmx3600EdlImport, matchEdlEventsToMedia, parseCmx3600Edl } from '../src';
import { makeProject } from './test-utils';

describe('timeline import', () => {
  it('parses CMX3600 EDL comments, multiple tracks, and dissolve transitions', () => {
    const parsed = parseCmx3600Edl(
      [
        'TITLE: Import Test',
        'FCM: NON-DROP FRAME',
        '',
        '001  AX       V     C        00:00:01:00 00:00:03:00 00:00:00:00 00:00:02:00',
        '* FROM CLIP NAME: Hero Shot.mov',
        '* SOURCE FILE: C:/Media/Hero Shot.mov',
        '002  AX       V     D 015    00:00:00:00 00:00:02:00 00:00:02:00 00:00:04:00',
        '* FROM CLIP NAME: B Roll Wide.mov',
        '003  AX       A     C        00:00:04:00 00:00:06:00 00:00:00:00 00:00:02:00',
        '* FROM CLIP NAME: Dialogue.wav'
      ].join('\n'),
      30
    );

    expect(parsed.title).toBe('Import Test');
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0]).toMatchObject({
      trackType: 'video',
      transition: 'cut',
      clipName: 'Hero Shot.mov',
      sourceFile: 'C:/Media/Hero Shot.mov',
      sourceStart: 1,
      recordEnd: 2
    });
    expect(parsed.events[1]).toMatchObject({ transition: 'dissolve', transitionDurationFrames: 15 });
    expect(parsed.events[2]).toMatchObject({ trackType: 'audio', clipName: 'Dialogue.wav' });
  });

  it('ignores malformed EDL lines and normalizes unknown transitions and source file URLs', () => {
    const parsed = parseCmx3600Edl(
      [
        'TITLE: Edge Cases',
        'not an event line',
        '999  AX       V     C        no-timecode-here',
        '998  AX       V     C        00:00:00:00 BAD 00:00:01:00 00:00:02:00',
        '001  AX       V     W001     00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* SOURCE FILE: file://localhost/C%3A/Media/Hero%20Shot.mov',
        '002  AX       V     C        00:00:00:00 00:00:01:00 00:00:01:00 00:00:02:00',
        '* SOURCE FILE: file:///C%ZZ/Bad.mov'
      ].join('\n')
    );

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({ transition: 'unknown', rawTransition: 'W001', sourceFile: 'C:/Media/Hero Shot.mov' });
    expect(parsed.events[1].sourceFile).toContain('%ZZ');
  });

  it('matches EDL clip names by exact, fuzzy, and missing outcomes', () => {
    const parsed = parseCmx3600Edl(
      [
        '001  AX       V     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* FROM CLIP NAME: Hero Shot.mov',
        '002  AX       V     C        00:00:00:00 00:00:01:00 00:00:01:00 00:00:02:00',
        '* FROM CLIP NAME: b roll wide',
        '003  AX       V     C        00:00:00:00 00:00:01:00 00:00:02:00 00:00:03:00',
        '* FROM CLIP NAME: Missing Clip.mov'
      ].join('\n')
    );
    const matches = matchEdlEventsToMedia(parsed.events, [
      { id: 'asset-hero', type: 'video', name: 'Hero Shot.mov', path: 'C:/Media/Hero Shot.mov', duration: 4, width: 1920, height: 1080 },
      { id: 'asset-broll', type: 'video', name: 'B-Roll Wide Camera A.mp4', path: 'C:/Media/B-Roll Wide Camera A.mp4', duration: 4, width: 1920, height: 1080 }
    ]);

    expect(matches.map((match) => [match.kind, match.asset?.id])).toEqual([
      ['exact', 'asset-hero'],
      ['fuzzy', 'asset-broll'],
      ['missing', undefined]
    ]);
  });

  it('matches audio EDL events to video assets with audio by source path', () => {
    const parsed = parseCmx3600Edl(
      [
        '001  AX       A     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* SOURCE FILE: file://localhost/C%3A/Media/Camera%20A.mov'
      ].join('\n')
    );
    const matches = matchEdlEventsToMedia(parsed.events, [
      { id: 'asset-camera-a', type: 'video', name: 'Camera A.mov', path: 'C:/Media/Camera A.mov', duration: 5, width: 1920, height: 1080, hasAudio: true },
      { id: 'asset-silent', type: 'video', name: 'Silent.mov', path: 'C:/Media/Silent.mov', duration: 5, width: 1920, height: 1080 }
    ]);

    expect(matches).toEqual([expect.objectContaining({ kind: 'exact', asset: expect.objectContaining({ id: 'asset-camera-a' }) })]);
  });

  it('builds an imported sequence and missing media placeholders', () => {
    const project = {
      ...makeProject(),
      settings: { fps: 30, width: 1280, height: 720 },
      media: [
        { id: 'asset-hero', type: 'video' as const, name: 'Hero.mov', path: 'C:/Media/Hero.mov', duration: 5, width: 1280, height: 720 },
        { id: 'media-edl-missing', type: 'video' as const, name: 'Existing Placeholder.mov', path: 'C:/Media/Existing Placeholder.mov', duration: 5, width: 1280, height: 720 }
      ]
    };
    const result = buildCmx3600EdlImport(
      project,
      [
        'TITLE: Offline Roundtrip',
        '001  AX       V     C        00:00:01:00 00:00:03:00 00:00:00:00 00:00:02:00',
        '* FROM CLIP NAME: Hero.mov',
        '002  AX       V     C        00:00:00:00 00:00:02:00 00:00:02:00 00:00:04:00',
        '* FROM CLIP NAME: Missing.mov'
      ].join('\n')
    );

    expect(result.sequence.name).toBe('EDL Offline Roundtrip');
    expect(result.matchedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.media).toEqual([expect.objectContaining({ id: 'media-edl-missing-2', name: 'Missing.mov', missing: true, type: 'video' })]);
    expect(result.sequence.timeline.tracks[0].clips).toHaveLength(2);
    expect(result.sequence.timeline.tracks[0].clips[0]).toMatchObject({ mediaId: 'asset-hero', start: 0, duration: 2, trimStart: 1 });
  });

  it('builds image and audio clips, reuses missing media, and creates adjacent dissolves', () => {
    const project = {
      ...makeProject(),
      settings: { fps: 30, width: 1280, height: 720 },
      media: [
        { id: 'asset-still', type: 'image' as const, name: 'Still.png', path: 'C:/Media/Still.png', duration: 10, width: 1280, height: 720 },
        { id: 'asset-camera', type: 'video' as const, name: 'Camera.mov', path: 'C:/Media/Camera.mov', duration: 10, width: 1280, height: 720, hasAudio: true }
      ]
    };
    const result = buildCmx3600EdlImport(
      project,
      [
        'TITLE: Mixed Clips',
        '001  AX       V     C        00:00:01:00 00:00:02:00 00:00:00:00 00:00:01:00',
        '* FROM CLIP NAME: Still.png',
        '002  AX       V     D 015    00:00:02:00 00:00:03:00 00:00:01:00 00:00:02:00',
        '* FROM CLIP NAME: Missing Repeat.mov',
        '003  AX       V     D 015    00:00:03:00 00:00:04:00 00:00:03:00 00:00:04:00',
        '* FROM CLIP NAME: Missing Repeat.mov',
        '004  AX       A     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00',
        '* FROM CLIP NAME: Camera.mov'
      ].join('\n')
    );

    const videoClips = result.sequence.timeline.tracks[0].clips;
    const audioClips = result.sequence.timeline.tracks[1].clips;
    expect(videoClips[0]).toMatchObject({ type: 'image', mediaId: 'asset-still', trimStart: 0, trimEnd: 0 });
    expect(videoClips[1].mediaId).toBe(videoClips[2].mediaId);
    expect(audioClips).toEqual([expect.objectContaining({ type: 'audio', mediaId: 'asset-camera' })]);
    expect(result.media).toHaveLength(1);
    expect(result.sequence.timeline.transitions).toEqual([
      expect.objectContaining({ type: 'dissolve', fromClipId: videoClips[0].id, toClipId: videoClips[1].id, duration: 0.5 })
    ]);
  });

  it('applies an imported EDL sequence as the active timeline', () => {
    const project = makeProject();
    const result = buildCmx3600EdlImport(
      project,
      ['TITLE: Apply Test', '001  AX       V     C        00:00:00:00 00:00:01:00 00:00:00:00 00:00:01:00', '* FROM CLIP NAME: sample.mp4'].join('\n')
    );
    const next = applyCmx3600EdlImport(project, result);

    expect(next.activeSequenceId).toBe(result.sequence.id);
    expect(next.timeline.tracks[0].clips).toHaveLength(1);
    expect(next.sequences.some((sequence) => sequence.id === result.sequence.id)).toBe(true);
  });
});

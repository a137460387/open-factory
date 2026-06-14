import { describe, expect, it } from 'vitest';
import {
  BatchImportSubtitleCommand,
  createTrack,
  detectSubtitleDataOverlaps,
  mergeOverlappingSubtitleDataCues,
  parseSubtitleDataCsv,
  parseSubtitleDataJson,
  parseSubtitleDataTimecode,
  type Timeline
} from '../src';
import { makeAccessor, makeSubtitleClip, makeTimeline } from './test-utils';

describe('subtitle data import', () => {
  it('parses CSV rows with seconds, timecodes, empty lines, and quoted text', () => {
    const cues = parseSubtitleDataCsv(
      [
        'start_time,end_time,text',
        '0.5,00:00:02.000,"Hello, subtitle"',
        '',
        '00:00:02.500,4,"Second ""quoted"" line"'
      ].join('\n')
    );

    expect(cues).toEqual([
      { start: 0.5, end: 2, text: 'Hello, subtitle', style: undefined },
      { start: 2.5, end: 4, text: 'Second "quoted" line', style: undefined }
    ]);
    expect(parseSubtitleDataTimecode('01:02:03.045')).toBe(3723.045);
  });

  it('parses JSON rows and keeps style overrides', () => {
    const cues = parseSubtitleDataJson(
      JSON.stringify([
        { start: '0', end: '1.25', text: 'JSON subtitle', style: { color: '#ff00ff', fontSize: 56, unknown: true } },
        { start: '00:00:02.000', end: '00:00:03.000', text: 'Styled', style: { bold: true, yOffset: 48 } }
      ])
    );

    expect(cues).toEqual([
      { start: 0, end: 1.25, text: 'JSON subtitle', style: { color: '#ff00ff', fontSize: 56 } },
      { start: 2, end: 3, text: 'Styled', style: { bold: true, yOffset: 48 } }
    ]);
  });

  it('detects and can merge overlapping imported subtitles without flagging boundaries', () => {
    const cues = [
      { start: 0, end: 1, text: 'A' },
      { start: 1, end: 2, text: 'B' },
      { start: 1.5, end: 3, text: 'C', style: { color: '#00ff00' } }
    ];

    expect(detectSubtitleDataOverlaps(cues)).toEqual([{ firstIndex: 1, secondIndex: 2, start: 1.5, end: 2 }]);
    expect(mergeOverlappingSubtitleDataCues(cues)).toEqual([
      { start: 0, end: 1, text: 'A', style: undefined },
      { start: 1, end: 3, text: 'B\nC', style: { color: '#00ff00' } }
    ]);
  });

  it('imports subtitle clips through a command and undoes the whole batch', () => {
    const existingTrack = createTrack({
      id: 'track-subtitle',
      type: 'subtitle',
      name: 'Current Subtitles',
      clips: [makeSubtitleClip({ id: 'old-subtitle', trackId: 'track-subtitle', text: 'Old', start: 0, duration: 1 })]
    });
    const importedTrack = createTrack({
      id: 'track-import',
      type: 'subtitle',
      name: 'Imported Data',
      clips: [
        makeSubtitleClip({ id: 'data-1', trackId: 'track-import', text: 'First', start: 1, duration: 1 }),
        makeSubtitleClip({ id: 'data-2', trackId: 'track-import', text: 'Second', start: 2.5, duration: 1 })
      ]
    });
    const timeline: Timeline = { ...makeTimeline(), tracks: [...makeTimeline().tracks, existingTrack] };
    const accessor = makeAccessor(timeline);
    const command = new BatchImportSubtitleCommand(accessor, importedTrack, { mode: 'replace-current-track', targetTrackId: 'track-subtitle' });

    command.execute();
    expect(accessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => clip.text)).toEqual(['First', 'Second']);

    command.undo();
    expect(accessor.current()).toEqual(timeline);
  });

  it('supports append and new-track import modes', () => {
    const existingTrack = createTrack({
      id: 'track-subtitle',
      type: 'subtitle',
      name: 'Current Subtitles',
      clips: [makeSubtitleClip({ id: 'old-subtitle', trackId: 'track-subtitle', text: 'Old', start: 0, duration: 1 })]
    });
    const importedTrack = createTrack({
      id: 'track-import',
      type: 'subtitle',
      name: 'Imported Data',
      clips: [makeSubtitleClip({ id: 'data-1', trackId: 'track-import', text: 'First', start: 1, duration: 1 })]
    });
    const timeline: Timeline = { ...makeTimeline(), tracks: [...makeTimeline().tracks, existingTrack] };
    const appendAccessor = makeAccessor(timeline);
    new BatchImportSubtitleCommand(appendAccessor, importedTrack, { mode: 'append', targetTrackId: 'track-subtitle' }).execute();

    expect(appendAccessor.current().tracks.find((track) => track.id === 'track-subtitle')?.clips.map((clip) => clip.trackId)).toEqual([
      'track-subtitle',
      'track-subtitle'
    ]);

    const newTrackAccessor = makeAccessor(timeline);
    new BatchImportSubtitleCommand(newTrackAccessor, importedTrack, { mode: 'new-track', targetTrackId: 'track-subtitle' }).execute();

    expect(newTrackAccessor.current().tracks.filter((track) => track.type === 'subtitle').map((track) => track.id)).toEqual(['track-subtitle', 'track-import']);
  });
});

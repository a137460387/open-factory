import { describe, expect, it } from 'vitest';
import { createNestedSequenceClip, createSequence, createTrack, exportCmx3600Edl, exportFinalCutXml, flattenTimelineForExport } from '../src';
import { makeAudioClip, makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('timeline export', () => {
  it('generates CMX3600 EDL edit lines for multiple video clips', () => {
    const project = {
      ...makeProject(),
      name: 'EDL Test',
      settings: { fps: 30, width: 1280, height: 720 },
      media: [
        { id: 'asset-a', type: 'video' as const, name: 'a.mp4', path: 'C:/Media/a.mp4', duration: 10, width: 1280, height: 720 },
        { id: 'asset-b', type: 'video' as const, name: 'b.mp4', path: 'C:/Media/b.mp4', duration: 10, width: 1280, height: 720 }
      ],
      timeline: makeTimeline([
        makeVideoClip({ id: 'clip-a', name: 'A', mediaId: 'asset-a', start: 0, duration: 2, trimStart: 1 }),
        makeVideoClip({ id: 'clip-b', name: 'B', mediaId: 'asset-b', start: 2, duration: 1.5, trimStart: 0.5 })
      ])
    };

    const edl = exportCmx3600Edl(project);

    expect(edl).toContain('TITLE: EDL Test');
    expect(edl).toContain('001  AX       V     C        00:00:01:00 00:00:03:00 00:00:00:00 00:00:02:00');
    expect(edl).toContain('002  AX       V     C        00:00:00:15 00:00:02:00 00:00:02:00 00:00:03:15');
    expect(edl.match(/^\d{3}\s+AX/gm)).toHaveLength(2);
  });

  it('generates Final Cut Pro XML sequence and clipitem structure', () => {
    const project = {
      ...makeProject(),
      name: 'FCP Test',
      settings: { fps: 24, width: 1920, height: 1080 },
      timeline: makeTimeline([makeVideoClip({ id: 'clip-video', duration: 2 }), makeAudioClip({ id: 'clip-audio', duration: 2 })])
    };

    const xml = exportFinalCutXml(project);

    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<timebase>24</timebase>');
    expect(xml).toContain('<duration>48</duration>');
    expect(xml).toContain('<video>');
    expect(xml).toContain('<audio>');
    expect(xml).toContain('<clipitem id="clipitem-1">');
    expect(xml).toContain('<pathurl>file://localhost/C%3A/Videos/sample.mp4</pathurl>');
  });

  it('escapes XML special characters in FCP XML metadata', () => {
    const project = {
      ...makeProject(),
      id: 'project-"demo"',
      name: 'A&B <Demo>',
      media: [{ id: 'asset-special', type: 'video' as const, name: 'clip & source.mov', path: 'C:/Media/A&B.mov', duration: 2, width: 1920, height: 1080 }],
      timeline: makeTimeline([makeVideoClip({ id: 'clip-special', name: 'Cut "A" <B>', mediaId: 'asset-special', duration: 2 })])
    };

    const xml = exportFinalCutXml(project);

    expect(xml).toContain('<sequence id="project-&quot;demo&quot;">');
    expect(xml).toContain('<name>A&amp;B &lt;Demo&gt;</name>');
    expect(xml).toContain('<name>Cut &quot;A&quot; &lt;B&gt;</name>');
    expect(xml).toContain('<name>clip &amp; source.mov</name>');
    expect(xml).toContain('<pathurl>file://localhost/C%3A/Media/A&amp;B.mov</pathurl>');
  });

  it('flattens nested sequence clips into parent timeline events', () => {
    const nestedTimeline = makeTimeline([makeVideoClip({ id: 'nested-source', name: 'Nested Source', start: 1, duration: 2 })]);
    const nestedClip = createNestedSequenceClip({
      id: 'clip-nested',
      type: 'nested-sequence',
      name: 'Nested Clip',
      trackId: 'track-video',
      sequenceId: 'sequence-nested',
      start: 4,
      duration: 3,
      trimStart: 0,
      trimEnd: 0
    });
    const project = {
      ...makeProject(),
      timeline: {
        tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video', clips: [nestedClip] })]
      },
      sequences: [
        createSequence({ id: 'sequence-main', name: 'Main', timeline: { tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video', clips: [nestedClip] })] } }),
        createSequence({ id: 'sequence-nested', name: 'Nested', timeline: nestedTimeline })
      ]
    };

    const events = flattenTimelineForExport(project);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      clipId: 'nested-source',
      name: 'Nested Source',
      recordStart: 5,
      recordEnd: 7
    });
  });
});

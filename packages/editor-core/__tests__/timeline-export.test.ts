import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLOR_CORRECTION,
  createDefaultColorCurves,
  createDefaultThreeWayColor,
  createNestedSequenceClip,
  createSequence,
  createTrack,
  createTransition,
  exportAaf,
  exportCmx3600Edl,
  exportFinalCutXml,
  exportOmf,
  exportProfessionalNle,
  flattenTimelineForExport
} from '../src';
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

  it('skips nested-sequence clips that reference a missing sequence', () => {
    const nestedClip = createNestedSequenceClip({
      id: 'clip-missing-seq',
      name: 'Missing Seq',
      trackId: 'track-video',
      sequenceId: 'nonexistent-sequence',
      start: 0,
      duration: 5,
      trimStart: 0,
      trimEnd: 0
    });
    const project = {
      ...makeProject(),
      timeline: makeTimeline([nestedClip])
    };

    const events = flattenTimelineForExport(project);

    expect(events).toHaveLength(0);
  });

  it('filters out nested events that do not overlap with the clip visible window', () => {
    const nestedTimeline = makeTimeline([makeVideoClip({ id: 'nested-source', name: 'Nested Source', start: 0, duration: 3 })]);
    const nestedClip = createNestedSequenceClip({
      id: 'clip-outside',
      name: 'Outside Clip',
      trackId: 'track-video',
      sequenceId: 'sequence-nested',
      start: 10,
      duration: 3,
      trimStart: 5,
      trimEnd: 0
    });
    const project = {
      ...makeProject(),
      timeline: makeTimeline([nestedClip]),
      sequences: [
        createSequence({ id: 'sequence-nested', name: 'Nested', timeline: nestedTimeline })
      ]
    };

    const events = flattenTimelineForExport(project);

    expect(events).toHaveLength(0);
  });

  it('exports AAF MobSlot timecode with SourceClip and MasterMob identifiers', () => {
    const project = {
      ...makeProject(),
      name: 'AAF Test',
      settings: { fps: 30, width: 1920, height: 1080 },
      timeline: makeTimeline([makeVideoClip({ id: 'clip-aaf', name: 'Interview A', start: 1, duration: 2, trimStart: 0.5 })])
    };

    const aaf = exportAaf(project);
    const aafCopy = exportAaf(project, { mediaMode: 'copy' });

    expect(aaf).toContain('MasterMob: AAF Test');
    expect(aaf).toContain('MobSlot 1');
    expect(aaf).toContain('SourceClip Interview A');
    expect(aaf).toContain('MobSlotTimecode 00:00:01:00 -> 00:00:03:00');
    expect(aafCopy).toContain('MediaMode: copy');
  });

  it('exports OMF 2.0 magic bytes for legacy NLE interchange', () => {
    const omf = exportOmf(makeProject());

    expect(omf.slice(0, 4)).toBe('OMFI');
    expect(omf).toContain('OMFI 2.0');
    expect(omf).toContain('MasterMob: Test Project');
  });

  it('maps FCP XML color filters and transition nodes', () => {
    const timeline = makeTimeline([
      makeVideoClip({
        id: 'clip-fcp-color',
        name: 'Color A',
        start: 0,
        duration: 2,
        colorCorrection: {
          ...DEFAULT_COLOR_CORRECTION,
          brightness: 0.2,
          saturation: 1.4,
          lutPath: 'C:/Looks/warm.cube',
          colorCurves: {
            ...createDefaultColorCurves(),
            master: [
              { x: 0, y: 0 },
              { x: 1, y: 0.9 }
            ]
          },
          threeWayColor: {
            ...createDefaultThreeWayColor(),
            gain: { r: 0.1, g: 0, b: 0, intensity: 1 }
          }
        }
      }),
      makeVideoClip({ id: 'clip-fcp-next', name: 'Color B', start: 2, duration: 2 })
    ]);
    timeline.transitions = [
      createTransition({
        id: 'transition-dissolve',
        type: 'dissolve',
        duration: 0.5,
        fromClipId: 'clip-fcp-color',
        toClipId: 'clip-fcp-next'
      })
    ];
    const project = {
      ...makeProject(),
      timeline,
      settings: { fps: 30, width: 1920, height: 1080 }
    };

    const xml = exportProfessionalNle(project, 'fcp-xml');

    expect(xml).toContain('<filter>');
    expect(xml).toContain('<name>Open Factory Color Correction</name>');
    expect(xml).toContain('<parameter><name>Brightness</name><value>0.2</value></parameter>');
    expect(xml).toContain('<parameter><name>LUT Path</name><value>C:/Looks/warm.cube</value></parameter>');
    expect(xml).toContain('<parameter><name>Color Curves</name><value>present</value></parameter>');
    expect(xml).toContain('<parameter><name>Three-Way Color</name><value>present</value></parameter>');
    expect(xml).toContain('<transitionitem id="transitionitem-1">');
    expect(xml).toContain('<name>Cross Dissolve</name>');
  });

  it('routes professional NLE export through AAF and OMF wrappers with media path replacement', () => {
    const project = {
      ...makeProject(),
      name: 'NLE Wrapper Test',
      settings: { fps: 30, width: 1920, height: 1080 },
      media: [{ id: 'asset-wrapper', type: 'video' as const, name: 'wrapper.mp4', path: 'C:/Media/wrapper.mp4', duration: 4, width: 1920, height: 1080 }],
      timeline: makeTimeline([makeVideoClip({ id: 'clip-wrapper', name: 'Wrapper Clip', mediaId: 'asset-wrapper', duration: 2 })])
    };

    const aaf = exportProfessionalNle(project, 'aaf', {
      mediaMode: 'copy',
      mediaPathMap: new Map([['C:/Media/wrapper.mp4', 'C:/Exports/media/wrapper.mp4']])
    });
    const omf = exportOmf(project, {
      mediaMode: 'copy',
      mediaPathMap: { 'C:/Media/wrapper.mp4': 'C:/Exports/media/wrapper.mp4' }
    });

    expect(aaf).toContain('MediaMode: copy');
    expect(aaf).toContain('SourcePath C:/Exports/media/wrapper.mp4');
    expect(omf).toContain('OMFI 2.0');
    expect(omf).toContain('SourcePath C:/Exports/media/wrapper.mp4');
  });
});

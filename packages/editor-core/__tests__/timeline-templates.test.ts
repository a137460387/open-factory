import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_TIMELINE_TEMPLATES,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  fillTimelineTemplatePlaceholders,
  getMissingTimelineTemplatePlaceholders,
  instantiateTimelineTemplate,
  instantiateTimelineTemplateProject,
  normalizeTimelineTemplateDefinition,
  renderTimelineTemplatePreviewSvg,
  serializeTimelineTemplate,
  type Clip,
  type Project
} from '../src';

describe('timeline templates', () => {
  it('serializes a timeline with media paths replaced by placeholders and relative clip times', () => {
    const project = makeProject();

    const template = serializeTimelineTemplate(project, { id: 'template-demo', name: 'Demo Template', createdAt: '2026-06-16T00:00:00.000Z' });

    expect(template.id).toBe('template-demo');
    expect(template.placeholders).toEqual([
      {
        id: 'placeholder-1',
        name: 'camera-a.mp4',
        assetType: 'video',
        originalPath: 'C:/Media/camera-a.mp4',
        duration: 8,
        width: 1920,
        height: 1080
      },
      {
        id: 'placeholder-2',
        name: 'voice.wav',
        assetType: 'audio',
        originalPath: 'C:/Media/voice.wav',
        duration: 8,
        width: 0,
        height: 0
      }
    ]);
    expect(template.tracks).toHaveLength(2);
    const videoClip = template.tracks[0].clips[0].clip as Extract<Clip, { type: 'video' }>;
    expect(videoClip.start).toBe(0);
    expect(videoClip.mediaId).toBe('placeholder-1');
    expect(videoClip.keyframes?.opacity?.[0].time).toBe(0.25);
    const audioClip = template.tracks[1].clips[0].clip as Extract<Clip, { type: 'audio' }>;
    expect(audioClip.start).toBe(1);
    expect(audioClip.mediaId).toBe('placeholder-2');
    expect(template.duration).toBe(8);
  });

  it('serializes only selected clips when clip ids are supplied', () => {
    const template = serializeTimelineTemplate(makeProject(), { id: 'selection', name: 'Selection', clipIds: ['clip-audio'] });

    expect(template.tracks).toHaveLength(1);
    expect(template.tracks[0].sourceTrackId).toBe('track-audio');
    expect(template.tracks[0].clips[0].clip.start).toBe(0);
    expect(template.duration).toBe(4);
  });

  it('generates a stable sanitized id when the caller does not provide one', () => {
    const template = serializeTimelineTemplate(makeProject(), { name: ' Demo Template! ' });

    expect(template.name).toBe('Demo Template!');
    expect(template.id).toMatch(/^timeline-template-demo-template-/);
  });

  it('instantiates a template into a timeline and media assets with filled placeholders', () => {
    const template = serializeTimelineTemplate(makeProject(), { id: 'template-demo', name: 'Demo Template' });

    const instance = instantiateTimelineTemplate(template, {
      'placeholder-1': { path: 'D:/New/camera-b.mp4', duration: 9, width: 1280, height: 720 },
      'placeholder-2': 'D:/New/voice-b.wav'
    });

    expect(instance.media.map((asset) => asset.path)).toEqual(['D:/New/camera-b.mp4', 'D:/New/voice-b.wav']);
    expect(instance.media[0]).toMatchObject({ type: 'video', name: 'camera-b.mp4', duration: 9, width: 1280, height: 720 });
    expect(instance.timeline.tracks).toHaveLength(2);
    const clip = instance.timeline.tracks[0].clips[0] as Extract<Clip, { type: 'video' }>;
    expect(clip.mediaId).toBe(instance.media[0].id);
    expect(clip.colorCorrection).toEqual(DEFAULT_COLOR_CORRECTION);
  });

  it('creates a new project from a timeline template', () => {
    const template = serializeTimelineTemplate(makeProject(), { id: 'template-demo', name: 'Demo Template' });

    const project = instantiateTimelineTemplateProject(template, { 'placeholder-1': 'D:/New/camera-b.mp4', 'placeholder-2': 'D:/New/voice-b.wav' });

    expect(project.name).toBe('Demo Template');
    expect(project.timeline.tracks).toHaveLength(2);
    expect(project.sequences[0].timeline).toBe(project.timeline);
    expect(project.media).toHaveLength(2);
  });

  it('fills placeholders and reports missing bindings', () => {
    const template = serializeTimelineTemplate(makeProject(), { id: 'template-demo', name: 'Demo Template' });

    expect(getMissingTimelineTemplatePlaceholders(template, { 'placeholder-1': 'D:/New/camera-b.mp4' }).map((placeholder) => placeholder.id)).toEqual(['placeholder-2']);
    expect(fillTimelineTemplatePlaceholders(template, { 'placeholder-1': 'D:/New/camera-b.mp4' })).toEqual({
      'placeholder-1': {
        path: 'D:/New/camera-b.mp4',
        name: 'camera-b.mp4',
        assetType: 'video',
        duration: 8,
        width: 1920,
        height: 1080,
        size: undefined
      }
    });
  });

  it('renders an SVG preview for track structure', () => {
    const template = serializeTimelineTemplate(makeProject(), { id: 'template-demo', name: 'Demo Template' });

    const svg = renderTimelineTemplatePreviewSvg(template);

    expect(svg).toContain('<svg');
    expect(svg).toContain('Video 1');
    expect(svg).toContain('camera-a.mp4');
  });

  it('keeps built-in timeline templates complete', () => {
    expect(BUILT_IN_TIMELINE_TEMPLATES.map((template) => template.id)).toEqual(['interview-two-camera', 'vlog-opener', 'product-showcase', 'tutorial-screen-recording']);
    for (const template of BUILT_IN_TIMELINE_TEMPLATES) {
      expect(template.schemaVersion).toBe(1);
      expect(template.name).toBeTruthy();
      expect(template.tracks.length).toBeGreaterThan(0);
      expect(template.duration).toBeGreaterThan(0);
      expect(getMissingTimelineTemplatePlaceholders(template)).toHaveLength(template.placeholders.length);
      expect(renderTimelineTemplatePreviewSvg(template)).toContain('<rect');
    }
  });

  it('normalizes template definitions and filters invalid persisted entries', () => {
    expect(normalizeTimelineTemplateDefinition(null)).toBeUndefined();
    expect(normalizeTimelineTemplateDefinition({ schemaVersion: 0, id: 'bad', name: 'Bad', placeholders: [], tracks: [] })).toBeUndefined();
    expect(normalizeTimelineTemplateDefinition({ schemaVersion: 1, id: 'bad', name: 'Bad' })).toBeUndefined();

    const normalized = normalizeTimelineTemplateDefinition({
      schemaVersion: 1,
      id: 'dirty-template',
      name: '   ',
      description: '  Imported template  ',
      duration: -4,
      placeholders: [
        null,
        { id: 'placeholder-video', name: 'Camera', assetType: 'video', duration: 5, width: 'wide', height: 720 },
        { id: 'placeholder-doc', name: 'Doc', assetType: 'document' }
      ],
      tracks: [
        null,
        {
          id: 'track-video',
          sourceTrackId: 'source-video',
          type: 'video',
          name: '   ',
          clips: [
            null,
            {
              id: 'clip-title',
              sourceClipId: 'source-title',
              mediaPlaceholderId: 42,
              clip: {
                id: 'clip-title',
                type: 'text',
                name: 'Title',
                trackId: 'track-video',
                start: 0,
                duration: 2,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                text: 'Title',
                style: {
                  fontSize: 48,
                  color: '#ffffff',
                  backgroundColor: '#000000',
                  backgroundOpacity: 0,
                  fontFamily: 'Inter',
                  bold: true,
                  italic: false
                }
              }
            },
            { id: 'clip-bad', sourceClipId: 'source-bad' }
          ]
        },
        { id: 'track-bad', sourceTrackId: 'source-bad', type: 'folder', clips: [] }
      ]
    });

    expect(normalized).toMatchObject({
      id: 'dirty-template',
      name: 'Timeline Template',
      description: 'Imported template',
      duration: 0
    });
    expect(normalized?.placeholders).toEqual([{ id: 'placeholder-video', name: 'Camera', assetType: 'video', duration: 5, width: undefined, height: 720 }]);
    expect(normalized?.tracks).toHaveLength(1);
    expect(normalized?.tracks[0]).toMatchObject({ id: 'track-video', name: 'video', clips: [{ id: 'clip-title', mediaPlaceholderId: undefined }] });
  });
});

function makeProject(): Project {
  return {
    version: '0.2',
    id: 'project-template-test',
    name: 'Timeline Template Test',
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    masterVolume: 1,
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
    media: [
      {
        id: 'media-video',
        type: 'video',
        name: 'camera-a.mp4',
        path: 'C:/Media/camera-a.mp4',
        duration: 8,
        width: 1920,
        height: 1080
      },
      {
        id: 'media-audio',
        type: 'audio',
        name: 'voice.wav',
        path: 'C:/Media/voice.wav',
        duration: 8,
        width: 0,
        height: 0
      }
    ],
    mediaFolders: [],
    mediaMetadata: {},
    annotations: [],
    reviewAnnotations: [],
    timelineNotes: [],
    bookmarks: [],
    beatMarkers: [],
    exportRanges: [],
    protectedRanges: [],
    clipGroups: [],
    speakers: [],
    documentation: {},
    timeline: {
      tracks: [
        {
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-video',
              type: 'video',
              name: 'camera-a.mp4',
              mediaId: 'media-video',
              trackId: 'track-video',
              start: 2,
              duration: 8,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              colorCorrection: DEFAULT_COLOR_CORRECTION,
              transform: DEFAULT_TRANSFORM,
              volume: 1,
              keyframes: { opacity: [{ id: 'kf-1', time: 0.25, value: 0.5, easing: 'linear' }] }
            }
          ]
        },
        {
          id: 'track-audio',
          type: 'audio',
          name: 'Audio 1',
          clips: [
            {
              id: 'clip-audio',
              type: 'audio',
              name: 'voice.wav',
              mediaId: 'media-audio',
              trackId: 'track-audio',
              start: 3,
              duration: 4,
              trimStart: 0,
              trimEnd: 0,
              speed: 1,
              colorCorrection: DEFAULT_COLOR_CORRECTION,
              transform: DEFAULT_TRANSFORM,
              volume: 1
            }
          ]
        }
      ]
    },
    sequences: [],
    activeSequenceId: 'sequence-main'
  };
}

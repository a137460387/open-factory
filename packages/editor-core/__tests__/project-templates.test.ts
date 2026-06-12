import { describe, expect, it } from 'vitest';
import { instantiateProjectTemplate, PROJECT_TEMPLATES, type ProjectTemplateId } from '../src';

describe('project templates', () => {
  it.each([
    ['vertical-short', { width: 1080, height: 1920, fps: 30, tracks: ['video', 'audio', 'text'], format: 'mp4' }],
    ['youtube-horizontal', { width: 1920, height: 1080, fps: 30, tracks: ['video', 'audio', 'text'], format: 'mp4' }],
    ['square-social', { width: 1080, height: 1080, fps: 30, tracks: ['video', 'audio', 'text'], format: 'mp4' }],
    ['podcast', { width: 1920, height: 1080, fps: 30, tracks: ['audio', 'audio'], format: 'm4a' }],
    ['cinema', { width: 3840, height: 2160, fps: 24, tracks: ['video', 'video', 'audio', 'audio', 'text'], format: 'mp4' }]
  ] as Array<[ProjectTemplateId, { width: number; height: number; fps: number; tracks: string[]; format: string }]>)(
    'instantiates %s with the expected timeline and export defaults',
    (templateId, expected) => {
      const instance = instantiateProjectTemplate(templateId, { name: `Template ${templateId}` });

      expect(instance.project.name).toBe(`Template ${templateId}`);
      expect(instance.project.settings).toEqual({ width: expected.width, height: expected.height, fps: expected.fps });
      expect(instance.project.timeline.tracks.map((track) => track.type)).toEqual(expected.tracks);
      expect(instance.project.timeline.tracks.every((track) => track.clips.length === 0)).toBe(true);
      expect(instance.project.sequences[0].timeline).toBe(instance.project.timeline);
      expect(instance.exportSettings.format).toBe(expected.format);
      expect(instance.exportSettings.fps).toBe(templateId === 'podcast' ? undefined : expected.fps);
    }
  );

  it('keeps the built-in template ids stable', () => {
    expect(PROJECT_TEMPLATES.map((template) => template.id)).toEqual(['vertical-short', 'youtube-horizontal', 'square-social', 'podcast', 'cinema']);
  });
});

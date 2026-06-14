import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  DEFAULT_SUBTITLE_STYLE,
  UpdateSubtitleStyleCommand,
  createTrack,
  normalizeSubtitleStyleTemplateStyle,
  renderSubtitleStyleTemplatePreview
} from '../src';
import { makeAccessor, makeSubtitleClip } from './test-utils';

describe('subtitle style templates', () => {
  it('defines eight complete built-in templates', () => {
    expect(BUILTIN_SUBTITLE_STYLE_TEMPLATES.map((template) => template.id)).toEqual([
      'news-lower-third',
      'cinema-white',
      'karaoke',
      'variety-bold',
      'documentary',
      'social-bold',
      'game-hud',
      'handwritten'
    ]);

    for (const template of BUILTIN_SUBTITLE_STYLE_TEMPLATES) {
      expect(template.kind).toBe('builtin');
      expect(template.name).toBeTruthy();
      expect(template.style).toEqual(
        expect.objectContaining({
          fontSize: expect.any(Number),
          color: expect.stringMatching(/^#[0-9a-f]{6}$/),
          backgroundColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
          backgroundOpacity: expect.any(Number),
          fontFamily: expect.any(String),
          bold: expect.any(Boolean),
          italic: expect.any(Boolean),
          yOffset: expect.any(Number),
          outlineColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
          outlineWidth: expect.any(Number),
          shadowColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
          shadowOffset: expect.any(Number)
        })
      );
    }
  });

  it('normalizes custom template styles against subtitle defaults', () => {
    expect(normalizeSubtitleStyleTemplateStyle({ fontSize: 999, color: 'white', backgroundOpacity: -1 })).toEqual({
      ...DEFAULT_SUBTITLE_STYLE,
      fontSize: 200,
      color: DEFAULT_SUBTITLE_STYLE.color,
      backgroundOpacity: 0,
      bold: false,
      italic: false
    });
  });

  it('renders SVG previews with a text node', () => {
    const preview = renderSubtitleStyleTemplatePreview(BUILTIN_SUBTITLE_STYLE_TEMPLATES[1]);

    expect(preview).toContain('<svg');
    expect(preview).toContain('<text');
    expect(preview).toContain('示例字幕');
  });

  it('applies a template through UpdateSubtitleStyleCommand and supports undo', () => {
    const clip = makeSubtitleClip({ id: 'subtitle-1', trackId: 'track-subtitle', style: { color: '#112233' } });
    const timeline = {
      tracks: [createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles', clips: [clip] })],
      transitions: [],
      markers: []
    };
    const accessor = makeAccessor(timeline);
    const movieWhite = BUILTIN_SUBTITLE_STYLE_TEMPLATES.find((template) => template.id === 'cinema-white')!;
    const command = new UpdateSubtitleStyleCommand(accessor, clip.id, movieWhite.style);

    command.execute();
    expect(accessor.current().tracks[0].clips[0]).toMatchObject({ style: { color: '#ffffff', outlineWidth: 2 } });

    command.undo();
    expect(accessor.current()).toEqual(timeline);
  });
});

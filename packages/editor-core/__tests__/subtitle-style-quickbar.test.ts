import { describe, it, expect } from 'vitest';
import {
  shouldShowQuickbar,
  getQuickbarTemplates,
  isStyleMatchingTemplate,
  resolveActiveTemplateId,
  applyStyleTemplateBatch,
  QUICKBAR_MAX_VISIBLE
} from '../src/subtitles/subtitle-style-quickbar';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle, type SubtitleClip } from '../src/model';
import { BUILTIN_SUBTITLE_STYLE_TEMPLATES } from '../src/subtitles/style-templates';

function makeSubtitleClip(overrides: Partial<SubtitleClip> = {}): SubtitleClip {
  return {
    id: 'sc1', name: 'sub1', trackId: 't1', start: 0, duration: 2,
    trimStart: 0, trimEnd: 0, speed: 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, gamma: 0, temperature: 0, tint: 0, vibrance: 0, hue: 0, shadows: [0,0,0], midtones: [0,0,0], highlights: [0,0,0], lift: [0,0,0], gain: [0,0,0], offset: [0,0,0] },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, anchorX: 0.5, anchorY: 0.5 },
    type: 'subtitle' as const,
    text: 'hello',
    style: { ...DEFAULT_SUBTITLE_STYLE },
    subtitleMode: 'burn-in' as const,
    ...overrides
  } as SubtitleClip;
}

describe('shouldShowQuickbar', () => {
  it('should return true when subtitle clip selected and pref enabled', () => {
    expect(shouldShowQuickbar([{ type: 'subtitle' }], true)).toBe(true);
  });
  it('should return false when pref disabled', () => {
    expect(shouldShowQuickbar([{ type: 'subtitle' }], false)).toBe(false);
  });
  it('should return false when no subtitle clips selected', () => {
    expect(shouldShowQuickbar([{ type: 'video' }], true)).toBe(false);
  });
});

describe('getQuickbarTemplates', () => {
  it('should return at most QUICKBAR_MAX_VISIBLE templates', () => {
    const templates = getQuickbarTemplates();
    expect(templates.length).toBeLessThanOrEqual(QUICKBAR_MAX_VISIBLE);
    expect(templates.length).toBeGreaterThan(0);
  });
  it('should return builtin templates', () => {
    const templates = getQuickbarTemplates();
    for (const t of templates) {
      expect(t.kind).toBe('builtin');
    }
  });
});

describe('isStyleMatchingTemplate', () => {
  it('should return true for identical styles', () => {
    const style: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE };
    expect(isStyleMatchingTemplate(style, style)).toBe(true);
  });
  it('should return false for different font sizes', () => {
    const a: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE, fontSize: 20 };
    const b: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE, fontSize: 30 };
    expect(isStyleMatchingTemplate(a, b)).toBe(false);
  });
});

describe('resolveActiveTemplateId', () => {
  it('should return null for empty clips', () => {
    expect(resolveActiveTemplateId([])).toBeNull();
  });
  it('should return null when styles differ across clips', () => {
    const c1 = makeSubtitleClip({ id: 'a', style: { ...DEFAULT_SUBTITLE_STYLE, fontSize: 20 } });
    const c2 = makeSubtitleClip({ id: 'b', style: { ...DEFAULT_SUBTITLE_STYLE, fontSize: 40 } });
    expect(resolveActiveTemplateId([c1, c2])).toBeNull();
  });
  it('should return template id when all clips match same builtin template', () => {
    const tpl = BUILTIN_SUBTITLE_STYLE_TEMPLATES[0];
    const c1 = makeSubtitleClip({ id: 'a', style: { ...tpl.style } });
    const c2 = makeSubtitleClip({ id: 'b', style: { ...tpl.style } });
    expect(resolveActiveTemplateId([c1, c2])).toBe(tpl.id);
  });
});

describe('applyStyleTemplateBatch', () => {
  it('should apply style to targeted clips only', () => {
    const tpl = BUILTIN_SUBTITLE_STYLE_TEMPLATES[1];
    const c1 = makeSubtitleClip({ id: 'a' });
    const c2 = makeSubtitleClip({ id: 'b' });
    const result = applyStyleTemplateBatch([c1, c2], tpl, new Set(['a']));
    expect(result[0].style.fontSize).toBe(tpl.style.fontSize);
    expect(result[1].style.fontSize).toBe(DEFAULT_SUBTITLE_STYLE.fontSize);
  });
  it('should handle empty target set', () => {
    const tpl = BUILTIN_SUBTITLE_STYLE_TEMPLATES[0];
    const c1 = makeSubtitleClip();
    const result = applyStyleTemplateBatch([c1], tpl, new Set());
    expect(result[0].style.fontSize).toBe(DEFAULT_SUBTITLE_STYLE.fontSize);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { parseSemanticSearchResponseSafe } from '../src/ai-semantic-search';
import { parseSceneMatchResponseSafe } from '../src/ai-scene-match';
import { parseSubtitleStyleResponseSafe } from '../src/ai-subtitle-style';
import { parseQualityAssessmentResponseSafe } from '../src/ai-quality-assessment';
import { recommendTransitionSafe } from '../src/ai-transition-recommend';
import { analyzeMotionTypeSafe } from '../src/ai-motion-type';
import { checkColorConsistencySafe } from '../src/ai-color-consistency';
import { computeTimingAdaptationSafe } from '../src/ai-dubbing-adaptation';

/**
 * Proxy that throws on any property access — used to force inner functions to
 * throw so we can exercise the catch/Safe-wrapper error path.
 */
function throwingProxy(label = 'boom') {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) {
          return () => { throw new Error(label); };
        }
        throw new Error(label);
      },
    },
  );
}

// -- semantic-search -------------------------------------------------------
describe('parseSemanticSearchResponseSafe', () => {
  it('success: returns data with error null', async () => {
    const json = { results: [{ mediaId: 'm1', score: 0.9, reason: '匹配' }] };
    const res = await parseSemanticSearchResponseSafe(json);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
  });

  it('error: catches throw and returns non-null error', async () => {
    const res = await parseSemanticSearchResponseSafe(throwingProxy());
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual([]);
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const res = await parseSemanticSearchResponseSafe(throwingProxy(), t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('uses identity translator when t omitted', async () => {
    const res = await parseSemanticSearchResponseSafe(throwingProxy());
    expect(res.error).toContain('aiModules.error');
  });
});

// -- scene-match -----------------------------------------------------------
describe('parseSceneMatchResponseSafe', () => {
  it('success: returns data with error null', async () => {
    const json = { similar: [{ mediaId: 'm1', score: 0.8, reason: '相似' }], contrast: [] };
    const res = await parseSceneMatchResponseSafe(json);
    expect(res.error).toBeNull();
    expect(res.data.similar.length).toBeGreaterThanOrEqual(1);
  });

  it('error: catches throw', async () => {
    const res = await parseSceneMatchResponseSafe(throwingProxy());
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual({ similar: [], contrast: [] });
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const res = await parseSceneMatchResponseSafe(throwingProxy(), t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const res = await parseSceneMatchResponseSafe(throwingProxy());
    expect(res.error).toContain('aiModules.error');
  });
});

// -- subtitle-style --------------------------------------------------------
describe('parseSubtitleStyleResponseSafe', () => {
  it('success: returns data with error null', async () => {
    const json = { recommended: [{ templateId: 'news', reason: '适合', confidence: 0.9 }] };
    const res = await parseSubtitleStyleResponseSafe(json);
    expect(res.error).toBeNull();
    expect(res.data.recommended.length).toBeGreaterThanOrEqual(1);
  });

  it('error: catches throw', async () => {
    const res = await parseSubtitleStyleResponseSafe(throwingProxy());
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual({ recommended: [] });
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const res = await parseSubtitleStyleResponseSafe(throwingProxy(), t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const res = await parseSubtitleStyleResponseSafe(throwingProxy());
    expect(res.error).toContain('aiModules.error');
  });
});

// -- quality-assessment ----------------------------------------------------
describe('parseQualityAssessmentResponseSafe', () => {
  it('success: returns data with error null', async () => {
    const json = { overallScore: 85, issues: [] };
    const res = await parseQualityAssessmentResponseSafe(json);
    expect(res.error).toBeNull();
    expect(res.data.overallScore).toBe(85);
  });

  it('error: catches throw', async () => {
    const res = await parseQualityAssessmentResponseSafe(throwingProxy());
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual({ overallScore: 0, issues: [] });
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const res = await parseQualityAssessmentResponseSafe(throwingProxy(), t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const res = await parseQualityAssessmentResponseSafe(throwingProxy());
    expect(res.error).toContain('aiModules.error');
  });
});

// -- transition-recommend --------------------------------------------------
describe('recommendTransitionSafe', () => {
  const clipA = { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 1 };
  const clipB = { colorHist: [0.25, 0.25, 0.25, 0.25], motionScore: 1 };

  it('success: returns data with error null', async () => {
    const res = await recommendTransitionSafe(clipA, clipB);
    expect(res.error).toBeNull();
    expect(res.data.recommended.length).toBeGreaterThanOrEqual(1);
  });

  it('error: catches throw', async () => {
    const proxy = throwingProxy();
    const res = await recommendTransitionSafe(proxy as any, proxy as any);
    expect(res.error).toBeTruthy();
    expect(res.data).toEqual({ recommended: [] });
  });

  it('localizes reasons via t()', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const res = await recommendTransitionSafe(clipA, clipB, t);
    expect(res.error).toBeNull();
    for (const r of res.data.recommended) {
      expect(r.reason).toContain('LOC:');
    }
  });

  it('identity translator when t omitted', async () => {
    const res = await recommendTransitionSafe(clipA, clipB);
    expect(res.error).toBeNull();
    for (const r of res.data.recommended) {
      expect(typeof r.reason).toBe('string');
    }
  });
});

// -- motion-type -----------------------------------------------------------
describe('analyzeMotionTypeSafe', () => {
  it('success: returns data with error null', async () => {
    const res = await analyzeMotionTypeSafe([], 32, 32);
    expect(res.error).toBeNull();
    expect(res.data.motionType.type).toBe('static');
  });

  it('error: catches throw', async () => {
    const proxy = new Proxy([] as any[], { get() { throw new Error('boom'); } });
    const res = await analyzeMotionTypeSafe(proxy, 32, 32);
    expect(res.error).toBeTruthy();
    expect(res.data.motionType.type).toBe('static');
    expect(res.data.motionType.confidence).toBe(0);
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const proxy = new Proxy([] as any[], { get() { throw new Error('boom'); } });
    const res = await analyzeMotionTypeSafe(proxy, 32, 32, 4, 4, t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const proxy = new Proxy([] as any[], { get() { throw new Error('boom'); } });
    const res = await analyzeMotionTypeSafe(proxy, 32, 32);
    expect(res.error).toContain('aiModules.error');
  });
});

// -- color-consistency -----------------------------------------------------
describe('checkColorConsistencySafe', () => {
  const validInput = {
    clipAId: 'a',
    clipBId: 'b',
    clipA: { skinToneRGB: { r: 120, g: 100, b: 80 }, whiteBalanceEstimate: 'warm' as const },
    clipB: { skinToneRGB: { r: 130, g: 110, b: 90 }, whiteBalanceEstimate: 'cool' as const },
  };

  it('success: returns data with error null', async () => {
    const res = await checkColorConsistencySafe(validInput);
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });

  it('error: catches throw', async () => {
    const proxy = throwingProxy();
    const res = await checkColorConsistencySafe(proxy as any);
    expect(res.error).toBeTruthy();
    expect(res.data).toBeNull();
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const proxy = throwingProxy();
    const res = await checkColorConsistencySafe(proxy as any, t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const proxy = throwingProxy();
    const res = await checkColorConsistencySafe(proxy as any);
    expect(res.error).toContain('aiModules.error');
  });
});

// -- dubbing-adaptation ----------------------------------------------------
describe('computeTimingAdaptationSafe', () => {
  it('success: returns data with error null', async () => {
    const res = await computeTimingAdaptationSafe(10, 11);
    expect(res.error).toBeNull();
    expect(res.data.adaptationType).toBe('none');
  });

  it('error: catches throw', async () => {
    const proxy = throwingProxy();
    const res = await computeTimingAdaptationSafe(proxy as any, 10);
    expect(res.error).toBeTruthy();
    expect(res.data.adaptationType).toBe('none');
    expect(res.data.durationDelta).toBe(0);
  });

  it('t() receives i18n key on error', async () => {
    const t = vi.fn((k: string) => `LOC:${k}`);
    const proxy = throwingProxy();
    const res = await computeTimingAdaptationSafe(proxy as any, 10, undefined, t);
    expect(t).toHaveBeenCalled();
    expect(res.error).toContain('LOC:');
  });

  it('identity translator when t omitted', async () => {
    const proxy = throwingProxy();
    const res = await computeTimingAdaptationSafe(proxy as any, 10);
    expect(res.error).toContain('aiModules.error');
  });
});

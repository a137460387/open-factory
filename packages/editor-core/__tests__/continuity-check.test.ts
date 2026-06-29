import { describe, expect, it } from 'vitest';
import {
  isAxisJump,
  subjectBoxCenterDistance,
  isJumpCut,
  parseAIAnalysisResponse,
  checkContinuity,
  checkTimelineContinuity,
  JUMP_CUT_CENTER_DIFF_THRESHOLD,
  JUMP_CUT_DURATION_DIFF_THRESHOLD,
  type ClipFrameAnalysis,
  type SubjectBox,
} from '../src';

const makeBox = (x: number, y: number, w: number, h: number): SubjectBox => ({ x, y, width: w, height: h });

const makeAnalysis = (
  clipId: string,
  facing: 'left' | 'right' | 'center' | 'unknown',
  box: SubjectBox,
  duration = 2.0,
  sceneTag?: string
): ClipFrameAnalysis => ({ clipId, subjectBox: box, facingDirection: facing, duration, sceneTag });

describe('isAxisJump', () => {
  it('detects left to right jump', () => {
    expect(isAxisJump('left', 'right')).toBe(true);
  });

  it('detects right to left jump', () => {
    expect(isAxisJump('right', 'left')).toBe(true);
  });

  it('returns false when either direction is unknown', () => {
    expect(isAxisJump('unknown', 'right')).toBe(false);
    expect(isAxisJump('left', 'unknown')).toBe(false);
    expect(isAxisJump('unknown', 'unknown')).toBe(false);
  });

  it('returns false when either direction is center', () => {
    expect(isAxisJump('center', 'right')).toBe(false);
    expect(isAxisJump('left', 'center')).toBe(false);
    expect(isAxisJump('center', 'center')).toBe(false);
  });

  it('returns false for same direction', () => {
    expect(isAxisJump('left', 'left')).toBe(false);
    expect(isAxisJump('right', 'right')).toBe(false);
  });
});

describe('subjectBoxCenterDistance', () => {
  it('calculates distance correctly', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3); // center = 0.25
    const boxB = makeBox(0.6, 0.1, 0.3, 0.3); // center = 0.75
    expect(subjectBoxCenterDistance(boxA, boxB)).toBeCloseTo(0.5, 5);
  });

  it('returns 0 for identical boxes', () => {
    const box = makeBox(0.2, 0.2, 0.3, 0.3);
    expect(subjectBoxCenterDistance(box, box)).toBe(0);
  });
});

describe('isJumpCut', () => {
  it('returns true when center distance < threshold and duration diff < threshold', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3);
    const boxB = makeBox(0.11, 0.1, 0.3, 0.3); // center diff = 0.005 < 0.05
    expect(isJumpCut(boxA, boxB, 2.0, 2.1)).toBe(true); // duration diff = 0.1 < 0.5
  });

  it('returns false when center distance exceeds threshold', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3); // center = 0.25
    const boxB = makeBox(0.5, 0.1, 0.3, 0.3); // center = 0.65, diff = 0.4
    expect(isJumpCut(boxA, boxB, 2.0, 2.1)).toBe(false);
  });

  it('returns false when duration diff exceeds threshold', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3);
    const boxB = makeBox(0.11, 0.1, 0.3, 0.3);
    expect(isJumpCut(boxA, boxB, 2.0, 3.0)).toBe(false); // duration diff = 1.0 >= 0.5
  });

  it('boundary: center distance exactly at threshold', () => {
    // centerDiff exactly 0.05 should NOT match (uses < not <=)
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3); // center = 0.25
    const boxB = makeBox(0.1 + 0.05, 0.1, 0.3, 0.3); // center = 0.30, diff = 0.05
    expect(isJumpCut(boxA, boxB, 2.0, 2.0)).toBe(false);
  });

  it('boundary: duration diff exactly at threshold', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3);
    const boxB = makeBox(0.11, 0.1, 0.3, 0.3);
    expect(isJumpCut(boxA, boxB, 2.0, 2.5)).toBe(false); // diff = 0.5, not <
  });

  it('boundary: just under thresholds', () => {
    const boxA = makeBox(0.1, 0.1, 0.3, 0.3); // center = 0.25
    const boxB = makeBox(0.149, 0.1, 0.3, 0.3); // center = 0.299, diff = 0.049 < 0.05
    expect(isJumpCut(boxA, boxB, 2.0, 2.499)).toBe(true);
  });
});

describe('parseAIAnalysisResponse', () => {
  it('parses valid response', () => {
    const response = {
      clipA: {
        clipId: 'clip-1',
        subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        facingDirection: 'left',
        sceneTag: 'scene-1',
        duration: 2.5,
      },
      clipB: {
        clipId: 'clip-2',
        subjectBox: { x: 0.5, y: 0.2, width: 0.3, height: 0.4 },
        facingDirection: 'right',
        sceneTag: 'scene-1',
        duration: 3.0,
      },
    };
    const result = parseAIAnalysisResponse(response);
    expect(result).not.toBeNull();
    expect(result!.clipA.clipId).toBe('clip-1');
    expect(result!.clipA.facingDirection).toBe('left');
    expect(result!.clipB.facingDirection).toBe('right');
  });

  it('returns null for non-object input', () => {
    expect(parseAIAnalysisResponse(null)).toBeNull();
    expect(parseAIAnalysisResponse(undefined)).toBeNull();
    expect(parseAIAnalysisResponse(42)).toBeNull();
    expect(parseAIAnalysisResponse('string')).toBeNull();
  });

  it('returns null when clipA or clipB missing', () => {
    expect(parseAIAnalysisResponse({ clipA: {} })).toBeNull();
    expect(parseAIAnalysisResponse({ clipB: {} })).toBeNull();
    expect(parseAIAnalysisResponse({})).toBeNull();
  });

  it('returns null when subjectBox is invalid', () => {
    const response = {
      clipA: { subjectBox: null, facingDirection: 'left' },
      clipB: { subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'right' },
    };
    expect(parseAIAnalysisResponse(response)).toBeNull();
  });

  it('returns null when subjectBox fields are not numbers', () => {
    const response = {
      clipA: { subjectBox: { x: 'a', y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'left' },
      clipB: { subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'right' },
    };
    expect(parseAIAnalysisResponse(response)).toBeNull();
  });

  it('defaults facingDirection to unknown for invalid string', () => {
    const response = {
      clipA: {
        subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        facingDirection: 'invalid',
      },
      clipB: {
        subjectBox: { x: 0.5, y: 0.2, width: 0.3, height: 0.4 },
        facingDirection: 'center',
      },
    };
    const result = parseAIAnalysisResponse(response);
    expect(result).not.toBeNull();
    expect(result!.clipA.facingDirection).toBe('unknown');
  });

  it('uses default clipId when not provided', () => {
    const response = {
      clipA: { subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'left' },
      clipB: { subjectBox: { x: 0.5, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'right' },
    };
    const result = parseAIAnalysisResponse(response);
    expect(result!.clipA.clipId).toBe('clipA');
    expect(result!.clipB.clipId).toBe('clipB');
  });

  it('handles missing sceneTag and duration gracefully', () => {
    const response = {
      clipA: { subjectBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'left' },
      clipB: { subjectBox: { x: 0.5, y: 0.2, width: 0.3, height: 0.4 }, facingDirection: 'right' },
    };
    const result = parseAIAnalysisResponse(response);
    expect(result!.clipA.sceneTag).toBeUndefined();
    expect(result!.clipA.duration).toBe(0);
  });
});

describe('checkContinuity', () => {
  it('detects axis jump in same scene', () => {
    const a = makeAnalysis('c1', 'left', makeBox(0.1, 0.1, 0.3, 0.3), 2, 'scene-1');
    const b = makeAnalysis('c2', 'right', makeBox(0.5, 0.1, 0.3, 0.3), 2, 'scene-1');
    const warnings = checkContinuity(a, b);
    const axisWarnings = warnings.filter((w) => w.type === 'axis_jump');
    expect(axisWarnings).toHaveLength(1);
    expect(axisWarnings[0].confidence).toBe(0.85);
  });

  it('does not flag axis jump across different scenes', () => {
    const a = makeAnalysis('c1', 'left', makeBox(0.1, 0.1, 0.3, 0.3), 2, 'scene-1');
    const b = makeAnalysis('c2', 'right', makeBox(0.5, 0.1, 0.3, 0.3), 2, 'scene-2');
    const warnings = checkContinuity(a, b);
    expect(warnings.filter((w) => w.type === 'axis_jump')).toHaveLength(0);
  });

  it('does not flag axis jump when sceneTag missing', () => {
    const a = makeAnalysis('c1', 'left', makeBox(0.1, 0.1, 0.3, 0.3), 2);
    const b = makeAnalysis('c2', 'right', makeBox(0.5, 0.1, 0.3, 0.3), 2);
    const warnings = checkContinuity(a, b);
    expect(warnings.filter((w) => w.type === 'axis_jump')).toHaveLength(0);
  });

  it('detects jump cut when composition is nearly identical', () => {
    const box = makeBox(0.1, 0.1, 0.3, 0.3);
    const a = makeAnalysis('c1', 'center', box, 2.0);
    const b = makeAnalysis('c2', 'center', { ...box, x: 0.101 }, 2.1);
    const warnings = checkContinuity(a, b);
    const jumpCutWarnings = warnings.filter((w) => w.type === 'jump_cut');
    expect(jumpCutWarnings).toHaveLength(1);
    expect(jumpCutWarnings[0].confidence).toBe(0.80);
  });

  it('detects both axis jump and jump cut simultaneously', () => {
    const box = makeBox(0.1, 0.1, 0.3, 0.3);
    const a = makeAnalysis('c1', 'left', box, 2.0, 'scene-1');
    const b = makeAnalysis('c2', 'right', { ...box, x: 0.101 }, 2.1, 'scene-1');
    const warnings = checkContinuity(a, b);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.type === 'axis_jump')).toBe(true);
    expect(warnings.some((w) => w.type === 'jump_cut')).toBe(true);
  });

  it('returns empty when no issues', () => {
    const a = makeAnalysis('c1', 'center', makeBox(0.1, 0.1, 0.3, 0.3), 2.0, 'scene-1');
    const b = makeAnalysis('c2', 'center', makeBox(0.5, 0.5, 0.3, 0.3), 4.0, 'scene-1');
    const warnings = checkContinuity(a, b);
    expect(warnings).toHaveLength(0);
  });
});

describe('checkTimelineContinuity', () => {
  it('checks all adjacent pairs', () => {
    const analyses = [
      makeAnalysis('c1', 'left', makeBox(0.1, 0.1, 0.3, 0.3), 2, 'scene-1'),
      makeAnalysis('c2', 'right', makeBox(0.5, 0.1, 0.3, 0.3), 2, 'scene-1'),
      makeAnalysis('c3', 'center', makeBox(0.6, 0.6, 0.3, 0.3), 4, 'scene-2'),
    ];
    const warnings = checkTimelineContinuity(analyses);
    // c1→c2: axis jump, c2→c3: nothing
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for fewer than 2 analyses', () => {
    expect(checkTimelineContinuity([])).toEqual([]);
    expect(checkTimelineContinuity([makeAnalysis('c1', 'left', makeBox(0.1, 0.1, 0.3, 0.3))])).toEqual([]);
  });
});


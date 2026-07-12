import { describe, it, expect } from 'vitest';
import { EffectChainEngine } from '../../src/audio/effect-chain';
import type { FfmpegAudioFilter, AudioNodeDescription } from '../../src/audio/effect-chain';
import type { AudioEffectSlot, AudioEffectType } from '../../src/audio/mixer-types';
import { createEffectSlot } from '../../src/audio/mixer-types';

// ─── helpers ──────────────────────────────────────────────────

function makeSlot(
  overrides: Partial<AudioEffectSlot> & { effectType?: AudioEffectType },
): AudioEffectSlot {
  const base = createEffectSlot(overrides.effectType ?? 'gain');
  return { ...base, ...overrides };
}

// ─── sortChain ────────────────────────────────────────────────

describe('EffectChainEngine.sortChain', () => {
  it('returns an empty array when given no effects', () => {
    expect(EffectChainEngine.sortChain([])).toEqual([]);
  });

  it('filters out disabled effects', () => {
    const chain = [
      makeSlot({ id: 'a', order: 1, enabled: true }),
      makeSlot({ id: 'b', order: 2, enabled: false }),
      makeSlot({ id: 'c', order: 3, enabled: true }),
    ];
    const sorted = EffectChainEngine.sortChain(chain);
    expect(sorted).toHaveLength(2);
    expect(sorted.map(e => e.id)).toEqual(['a', 'c']);
  });

  it('sorts enabled effects by order ascending', () => {
    const chain = [
      makeSlot({ id: 'a', order: 3 }),
      makeSlot({ id: 'b', order: 1 }),
      makeSlot({ id: 'c', order: 2 }),
    ];
    const sorted = EffectChainEngine.sortChain(chain);
    expect(sorted.map(e => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('preserves relative order for equal order values (stable sort)', () => {
    const chain = [
      makeSlot({ id: 'a', order: 1 }),
      makeSlot({ id: 'b', order: 1 }),
      makeSlot({ id: 'c', order: 1 }),
    ];
    const sorted = EffectChainEngine.sortChain(chain);
    expect(sorted.map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const chain = [
      makeSlot({ id: 'a', order: 2 }),
      makeSlot({ id: 'b', order: 1 }),
    ];
    const original = [...chain];
    EffectChainEngine.sortChain(chain);
    expect(chain).toEqual(original);
  });

  it('returns empty when all effects are disabled', () => {
    const chain = [
      makeSlot({ id: 'a', order: 1, enabled: false }),
      makeSlot({ id: 'b', order: 2, enabled: false }),
    ];
    expect(EffectChainEngine.sortChain(chain)).toEqual([]);
  });
});

// ─── validateParams ───────────────────────────────────────────

describe('EffectChainEngine.validateParams', () => {
  it('clamps compressor threshold below minimum', () => {
    const result = EffectChainEngine.validateParams('compressor', { threshold: -100 });
    expect(result.threshold).toBe(-60);
  });

  it('clamps compressor threshold above maximum', () => {
    const result = EffectChainEngine.validateParams('compressor', { threshold: 10 });
    expect(result.threshold).toBe(0);
  });

  it('clamps compressor ratio within range', () => {
    expect(EffectChainEngine.validateParams('compressor', { ratio: 0 }).ratio).toBe(1);
    expect(EffectChainEngine.validateParams('compressor', { ratio: 50 }).ratio).toBe(20);
    expect(EffectChainEngine.validateParams('compressor', { ratio: 4 }).ratio).toBe(4);
  });

  it('clamps compressor attack and release', () => {
    const r1 = EffectChainEngine.validateParams('compressor', { attack: 0 });
    expect(r1.attack).toBe(0.1);
    const r2 = EffectChainEngine.validateParams('compressor', { attack: 200 });
    expect(r2.attack).toBe(100);
    const r3 = EffectChainEngine.validateParams('compressor', { release: 0 });
    expect(r3.release).toBe(1);
    const r4 = EffectChainEngine.validateParams('compressor', { release: 5000 });
    expect(r4.release).toBe(1000);
  });

  it('clamps compressor makeup within [0, 24]', () => {
    expect(EffectChainEngine.validateParams('compressor', { makeup: -5 }).makeup).toBe(0);
    expect(EffectChainEngine.validateParams('compressor', { makeup: 30 }).makeup).toBe(24);
  });

  it('clamps limiter threshold within [-12, 0]', () => {
    expect(EffectChainEngine.validateParams('limiter', { threshold: -20 }).threshold).toBe(-12);
    expect(EffectChainEngine.validateParams('limiter', { threshold: 5 }).threshold).toBe(0);
  });

  it('clamps gate threshold and range', () => {
    expect(EffectChainEngine.validateParams('gate', { threshold: -100 }).threshold).toBe(-80);
    expect(EffectChainEngine.validateParams('gate', { threshold: 10 }).threshold).toBe(0);
    expect(EffectChainEngine.validateParams('gate', { range: -100 }).range).toBe(-80);
    expect(EffectChainEngine.validateParams('gate', { range: 10 }).range).toBe(0);
  });

  it('clamps reverb roomSize and damping', () => {
    expect(EffectChainEngine.validateParams('reverb', { roomSize: -10 }).roomSize).toBe(0);
    expect(EffectChainEngine.validateParams('reverb', { roomSize: 200 }).roomSize).toBe(100);
    expect(EffectChainEngine.validateParams('reverb', { damping: -1 }).damping).toBe(0);
    expect(EffectChainEngine.validateParams('reverb', { damping: 150 }).damping).toBe(100);
  });

  it('clamps delay time and feedback', () => {
    expect(EffectChainEngine.validateParams('delay', { time: 0 }).time).toBe(1);
    expect(EffectChainEngine.validateParams('delay', { time: 5000 }).time).toBe(2000);
    expect(EffectChainEngine.validateParams('delay', { feedback: -10 }).feedback).toBe(0);
    expect(EffectChainEngine.validateParams('delay', { feedback: 100 }).feedback).toBe(95);
  });

  it('clamps eq-4band gains within [-24, 24]', () => {
    const r = EffectChainEngine.validateParams('eq-4band', { lowGain: -30, highGain: 30 });
    expect(r.lowGain).toBe(-24);
    expect(r.highGain).toBe(24);
  });

  it('returns params unchanged for unknown effect types', () => {
    const params = { foo: 42, bar: -10 };
    const result = EffectChainEngine.validateParams('chorus' as AudioEffectType, params);
    expect(result).toEqual(params);
  });

  it('does not add keys that are not in the input', () => {
    const result = EffectChainEngine.validateParams('compressor', { threshold: -10 });
    expect('ratio' in result).toBe(false);
  });

  it('does not mutate the input params object', () => {
    const params = { threshold: -100, ratio: 50 };
    const copy = { ...params };
    EffectChainEngine.validateParams('compressor', params);
    expect(params).toEqual(copy);
  });

  it('leaves values in range untouched', () => {
    const result = EffectChainEngine.validateParams('compressor', { threshold: -20, ratio: 4 });
    expect(result.threshold).toBe(-20);
    expect(result.ratio).toBe(4);
  });
});

// ─── toFfmpegFilters ──────────────────────────────────────────

describe('EffectChainEngine.toFfmpegFilters', () => {
  it('returns empty array for empty chain', () => {
    expect(EffectChainEngine.toFfmpegFilters([])).toEqual([]);
  });

  it('skips disabled effects', () => {
    const chain = [
      makeSlot({ effectType: 'gain', enabled: false, params: { gain: 6 }, order: 1 }),
    ];
    expect(EffectChainEngine.toFfmpegFilters(chain)).toEqual([]);
  });

  it('generates equalizer filter for eq-4band', () => {
    const chain = [makeSlot({ effectType: 'eq-4band', params: { lowFreq: 100, lowGain: 3 }, order: 1 })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('equalizer');
    expect(filters[0].params.frequency).toBe(100);
    expect(filters[0].params.gain).toBe(3);
  });

  it('generates acompressor filter for compressor', () => {
    const chain = [makeSlot({
      effectType: 'compressor',
      params: { threshold: -20, ratio: 4, attack: 10, release: 100, makeup: 0 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('acompressor');
    expect(filters[0].params.threshold).toBe(-20);
    expect(filters[0].params.ratio).toBe(4);
    expect(filters[0].params.attack).toBe(10);
    expect(filters[0].params.release).toBe(100);
    expect(filters[0].params.makeup).toBe(0);
  });

  it('generates alimiter filter for limiter', () => {
    const chain = [makeSlot({
      effectType: 'limiter',
      params: { threshold: -3, release: 50 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('alimiter');
    expect(filters[0].params.limit).toBe(-3);
    expect(filters[0].params.release).toBe(50);
  });

  it('generates agate filter for gate', () => {
    const chain = [makeSlot({
      effectType: 'gate',
      params: { threshold: -40, attack: 5, release: 200, range: -60 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('agate');
    expect(filters[0].params.threshold).toBe(-40);
    expect(filters[0].params.attack).toBe(5);
    expect(filters[0].params.release).toBe(200);
    expect(filters[0].params.range).toBe(-60);
  });

  it('generates aecho filter for reverb', () => {
    const chain = [makeSlot({
      effectType: 'reverb',
      params: { roomSize: 60, damping: 40 },
      wetDry: 0.5,
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('aecho');
    expect(filters[0].params.delays).toBe(120); // 60 * 2
    expect(filters[0].params.decays).toBe(0.4); // 40 / 100
    expect(filters[0].params.in_gain).toBe(0.8);
    expect(filters[0].params.out_gain).toBe(0.9);
  });

  it('generates aecho filter for delay with wetDry', () => {
    const chain = [makeSlot({
      effectType: 'delay',
      params: { time: 500, feedback: 50 },
      wetDry: 0.7,
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('aecho');
    expect(filters[0].params.delays).toBe(500);
    expect(filters[0].params.decays).toBe(0.5);
    expect(filters[0].params.out_gain).toBe(0.7);
  });

  it('generates highpass filter for high-pass', () => {
    const chain = [makeSlot({
      effectType: 'high-pass',
      params: { frequency: 120 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('highpass');
    expect(filters[0].params.f).toBe(120);
  });

  it('generates lowpass filter for low-pass', () => {
    const chain = [makeSlot({
      effectType: 'low-pass',
      params: { frequency: 10000 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('lowpass');
    expect(filters[0].params.f).toBe(10000);
  });

  it('generates volume filter for gain', () => {
    const chain = [makeSlot({
      effectType: 'gain',
      params: { gain: 6 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('volume');
    expect(filters[0].params.volume).toBe('6dB');
  });

  it('generates chorus filter for chorus', () => {
    const chain = [makeSlot({
      effectType: 'chorus',
      params: {},
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('chorus');
    expect(filters[0].params.in_gain).toBe(0.5);
    expect(filters[0].params.delays).toBe('50|60');
  });

  it('processes multiple effects in order', () => {
    const chain = [
      makeSlot({ id: 'comp', effectType: 'compressor', params: { threshold: -20, ratio: 4, attack: 10, release: 100, makeup: 0 }, order: 2 }),
      makeSlot({ id: 'hp', effectType: 'high-pass', params: { frequency: 80 }, order: 1 }),
      makeSlot({ id: 'gain', effectType: 'gain', params: { gain: 3 }, order: 3 }),
    ];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(3);
    expect(filters[0].filterName).toBe('highpass');
    expect(filters[1].filterName).toBe('acompressor');
    expect(filters[2].filterName).toBe('volume');
  });

  it('generates eq-8band with 8 equalizer filters', () => {
    const chain = [makeSlot({
      effectType: 'eq-8band',
      params: { band1: 3, band2: -2, band5: 6 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(8);
    for (const f of filters) {
      expect(f.filterName).toBe('equalizer');
      expect(f.params.width_type).toBe('h');
    }
    expect(filters[0].params.f).toBe(32);
    expect(filters[0].params.g).toBe(3);
    expect(filters[1].params.f).toBe(64);
    expect(filters[1].params.g).toBe(-2);
    expect(filters[4].params.f).toBe(500);
    expect(filters[4].params.g).toBe(6);
    // bands with no explicit param default to 0
    expect(filters[2].params.g).toBe(0);
  });

  it('generates acompressor for expander with ratio < 1', () => {
    const chain = [makeSlot({
      effectType: 'expander',
      params: { threshold: -30, ratio: 0.5, attack: 5, release: 200 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('acompressor');
    expect(filters[0].params.threshold).toBe(-30);
    expect(filters[0].params.ratio).toBe(0.5);
    expect(filters[0].params.attack).toBe(5);
    expect(filters[0].params.release).toBe(200);
  });

  it('generates flanger filter for flanger', () => {
    const chain = [makeSlot({
      effectType: 'flanger',
      params: { delay: 10, depth: 3, regen: 20, speed: 1 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('flanger');
    expect(filters[0].params.delay).toBe(10);
    expect(filters[0].params.depth).toBe(3);
    expect(filters[0].params.regen).toBe(20);
    expect(filters[0].params.speed).toBe(1);
  });

  it('generates aeval for distortion', () => {
    const chain = [makeSlot({
      effectType: 'distortion',
      params: { gain: 5 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('aeval');
    expect(filters[0].params.exprs).toBe('val(0)*clip(5, -1, 1)');
    expect(filters[0].params.c).toBe('same');
  });

  it('generates equalizer + acompressor for de-esser', () => {
    const chain = [makeSlot({
      effectType: 'de-esser',
      params: { threshold: -25, reduction: 12 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(2);
    expect(filters[0].filterName).toBe('equalizer');
    expect(filters[0].params.f).toBe(6000);
    expect(filters[0].params.g).toBe(-12);
    expect(filters[1].filterName).toBe('acompressor');
    expect(filters[1].params.threshold).toBe(-25);
    expect(filters[1].params.ratio).toBe(4);
  });

  it('generates afftdn for noise-reduction', () => {
    const chain = [makeSlot({
      effectType: 'noise-reduction',
      params: { reduction: -30 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('afftdn');
    expect(filters[0].params.nf).toBe(-30);
  });

  it('generates asetrate + aresample for pitch-shift', () => {
    const chain = [makeSlot({
      effectType: 'pitch-shift',
      params: { semitones: 2 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(2);
    expect(filters[0].filterName).toBe('asetrate');
    expect(filters[1].filterName).toBe('aresample');
    expect(filters[1].params.r).toBe(48000);
    // ratio = 2^(2/12) ~= 1.12246
    const expectedRatio = Math.pow(2, 2 / 12);
    expect(filters[0].params.r).toBe(`${expectedRatio}*48000`);
  });

  it('generates stereotools for stereo-widener', () => {
    const chain = [makeSlot({
      effectType: 'stereo-widener',
      params: { width: 1.5 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('stereotools');
    expect(filters[0].params.mlev).toBe(1);
    expect(filters[0].params.slev).toBe(1.5);
  });

  it('generates stereotools with ms mode for mid-side', () => {
    const chain = [makeSlot({
      effectType: 'mid-side',
      params: {},
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('stereotools');
    expect(filters[0].params.mode).toBe('ms');
  });

  it('generates aeval for phase-invert', () => {
    const chain = [makeSlot({
      effectType: 'phase-invert',
      params: {},
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters).toHaveLength(1);
    expect(filters[0].filterName).toBe('aeval');
    expect(filters[0].params.exprs).toBe('-val(0)');
    expect(filters[0].params.c).toBe('same');
  });

  it('generates anull for truly unknown effect types', () => {
    const chain = [makeSlot({
      effectType: 'unknown-effect' as AudioEffectType,
      params: {},
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].filterName).toBe('anull');
    expect(filters[0].params).toEqual({});
  });

  it('validates params before generating filters (clamping)', () => {
    const chain = [makeSlot({
      effectType: 'compressor',
      params: { threshold: -100, ratio: 50, attack: 0, release: 5000, makeup: -5 },
      order: 1,
    })];
    const filters = EffectChainEngine.toFfmpegFilters(chain);
    expect(filters[0].params.threshold).toBe(-60);
    expect(filters[0].params.ratio).toBe(20);
    expect(filters[0].params.attack).toBe(0.1);
    expect(filters[0].params.release).toBe(1000);
    expect(filters[0].params.makeup).toBe(0);
  });
});

// ─── describeNodeGraph ────────────────────────────────────────

describe('EffectChainEngine.describeNodeGraph', () => {
  it('returns empty array for empty chain', () => {
    expect(EffectChainEngine.describeNodeGraph([])).toEqual([]);
  });

  it('filters out disabled effects', () => {
    const chain = [
      makeSlot({ effectType: 'gain', enabled: false, params: { gain: 6 }, order: 1 }),
    ];
    expect(EffectChainEngine.describeNodeGraph(chain)).toEqual([]);
  });

  it('returns node descriptions sorted by order', () => {
    const chain = [
      makeSlot({ effectType: 'gain', params: { gain: 3 }, order: 2 }),
      makeSlot({ effectType: 'compressor', params: { threshold: -20, ratio: 4, attack: 10, release: 100, makeup: 0 }, order: 1 }),
    ];
    const nodes = EffectChainEngine.describeNodeGraph(chain);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe('compressor');
    expect(nodes[1].type).toBe('gain');
  });

  it('includes validated params in node descriptions', () => {
    const chain = [makeSlot({
      effectType: 'compressor',
      params: { threshold: -100, ratio: 4, attack: 10, release: 100, makeup: 0 },
      order: 1,
    })];
    const nodes = EffectChainEngine.describeNodeGraph(chain);
    expect(nodes[0].params.threshold).toBe(-60); // clamped
    expect(nodes[0].params.ratio).toBe(4);       // in range, unchanged
  });

  it('preserves wetDry in node descriptions', () => {
    const chain = [makeSlot({
      effectType: 'reverb',
      params: { roomSize: 50, damping: 50 },
      wetDry: 0.6,
      order: 1,
    })];
    const nodes = EffectChainEngine.describeNodeGraph(chain);
    expect(nodes[0].wetDry).toBe(0.6);
  });

  it('returns correct shape for each node', () => {
    const chain = [makeSlot({ effectType: 'gain', params: { gain: 0 }, order: 1 })];
    const nodes = EffectChainEngine.describeNodeGraph(chain);
    const node = nodes[0];
    expect(typeof node.type).toBe('string');
    expect(typeof node.params).toBe('object');
    expect(typeof node.wetDry).toBe('number');
  });

  it('handles a full realistic chain', () => {
    const chain = [
      makeSlot({ effectType: 'high-pass', params: { frequency: 80 }, order: 1 }),
      makeSlot({ effectType: 'eq-4band', params: { lowFreq: 80, lowGain: 2, lowMidFreq: 500, lowMidGain: -1, highMidFreq: 2000, highMidGain: 1, highFreq: 8000, highGain: 0 }, order: 2 }),
      makeSlot({ effectType: 'compressor', params: { threshold: -18, ratio: 3, attack: 5, release: 80, makeup: 2 }, order: 3 }),
      makeSlot({ effectType: 'limiter', params: { threshold: -0.3, release: 50 }, order: 4 }),
    ];
    const nodes = EffectChainEngine.describeNodeGraph(chain);
    expect(nodes).toHaveLength(4);
    expect(nodes.map(n => n.type)).toEqual(['high-pass', 'eq-4band', 'compressor', 'limiter']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  createDefaultEffectParams,
  createEffectSlot,
  createBus,
  createMixerChannel,
  createDefaultMixerState,
} from '../../src/audio/mixer-types';
import type {
  AudioEffectType,
  AudioEffectSlot,
  BusType,
  AudioBus,
  MixerChannel,
  MixerState,
} from '../../src/audio/mixer-types';

// ─── createDefaultEffectParams ──────────────────────────────

describe('createDefaultEffectParams', () => {
  const effectTypes: AudioEffectType[] = [
    'eq-4band', 'eq-8band', 'compressor', 'limiter', 'gate', 'expander',
    'reverb', 'delay', 'chorus', 'flanger', 'distortion', 'de-esser',
    'noise-reduction', 'pitch-shift', 'stereo-widener', 'mid-side',
    'gain', 'phase-invert', 'high-pass', 'low-pass',
  ];

  it('returns an object for every effect type', () => {
    for (const t of effectTypes) {
      const params = createDefaultEffectParams(t);
      expect(params).toBeDefined();
      expect(typeof params).toBe('object');
    }
  });

  it('returns eq-4band params with 8 keys', () => {
    const p = createDefaultEffectParams('eq-4band');
    expect(Object.keys(p)).toHaveLength(8);
    expect(p.lowFreq).toBe(80);
    expect(p.lowGain).toBe(0);
    expect(p.highFreq).toBe(8000);
  });

  it('returns eq-8band params with 16 keys', () => {
    const p = createDefaultEffectParams('eq-8band');
    expect(Object.keys(p)).toHaveLength(16);
    expect(p.freq1).toBe(31);
    expect(p.freq8).toBe(16000);
  });

  it('returns compressor params with correct defaults', () => {
    const p = createDefaultEffectParams('compressor');
    expect(p.threshold).toBe(-20);
    expect(p.ratio).toBe(4);
    expect(p.attack).toBe(10);
    expect(p.release).toBe(100);
    expect(p.makeup).toBe(0);
  });

  it('returns limiter params', () => {
    const p = createDefaultEffectParams('limiter');
    expect(p.threshold).toBe(-1);
    expect(p.release).toBe(100);
  });

  it('returns gate params', () => {
    const p = createDefaultEffectParams('gate');
    expect(p.threshold).toBe(-40);
    expect(p.attack).toBe(1);
    expect(p.range).toBe(-60);
  });

  it('returns reverb params', () => {
    const p = createDefaultEffectParams('reverb');
    expect(p.roomSize).toBe(50);
    expect(p.damping).toBe(50);
    expect(p.wetLevel).toBe(30);
    expect(p.dryLevel).toBe(70);
    expect(p.width).toBe(100);
  });

  it('returns delay params', () => {
    const p = createDefaultEffectParams('delay');
    expect(p.time).toBe(250);
    expect(p.feedback).toBe(30);
    expect(p.mix).toBe(30);
  });

  it('returns chorus params', () => {
    const p = createDefaultEffectParams('chorus');
    expect(p.rate).toBe(1.5);
    expect(p.depth).toBe(50);
    expect(p.feedback).toBe(25);
    expect(p.mix).toBe(50);
  });

  it('returns flanger params', () => {
    const p = createDefaultEffectParams('flanger');
    expect(p.rate).toBe(0.5);
    expect(p.depth).toBe(70);
    expect(p.feedback).toBe(50);
    expect(p.delay).toBe(5);
    expect(p.mix).toBe(50);
  });

  it('returns distortion params', () => {
    const p = createDefaultEffectParams('distortion');
    expect(p.drive).toBe(50);
    expect(p.tone).toBe(50);
    expect(p.level).toBe(80);
  });

  it('returns de-esser params', () => {
    const p = createDefaultEffectParams('de-esser');
    expect(p.frequency).toBe(6000);
    expect(p.threshold).toBe(-20);
    expect(p.ratio).toBe(4);
  });

  it('returns noise-reduction params', () => {
    const p = createDefaultEffectParams('noise-reduction');
    expect(p.threshold).toBe(-40);
    expect(p.reduction).toBe(50);
  });

  it('returns pitch-shift params', () => {
    const p = createDefaultEffectParams('pitch-shift');
    expect(p.semitones).toBe(0);
    expect(p.cents).toBe(0);
    expect(p.formantPreserve).toBe(1);
  });

  it('returns stereo-widener params', () => {
    const p = createDefaultEffectParams('stereo-widener');
    expect(p.width).toBe(100);
  });

  it('returns mid-side params', () => {
    const p = createDefaultEffectParams('mid-side');
    expect(p.midGain).toBe(0);
    expect(p.sideGain).toBe(0);
  });

  it('returns gain params', () => {
    const p = createDefaultEffectParams('gain');
    expect(p.gain).toBe(0);
  });

  it('returns phase-invert params', () => {
    const p = createDefaultEffectParams('phase-invert');
    expect(p.invert).toBe(1);
  });

  it('returns high-pass params', () => {
    const p = createDefaultEffectParams('high-pass');
    expect(p.frequency).toBe(80);
    expect(p.resonance).toBe(0.707);
  });

  it('returns low-pass params', () => {
    const p = createDefaultEffectParams('low-pass');
    expect(p.frequency).toBe(18000);
    expect(p.resonance).toBe(0.707);
  });

  it('returns all numeric values', () => {
    for (const t of effectTypes) {
      const params = createDefaultEffectParams(t);
      for (const [key, val] of Object.entries(params)) {
        expect(typeof val).toBe('number');
      }
    }
  });
});

// ─── createEffectSlot ───────────────────────────────────────

describe('createEffectSlot', () => {
  it('creates a slot with correct effectType', () => {
    const slot = createEffectSlot('compressor');
    expect(slot.effectType).toBe('compressor');
  });

  it('creates a slot enabled by default', () => {
    const slot = createEffectSlot('reverb');
    expect(slot.enabled).toBe(true);
  });

  it('creates a slot with wetDry = 1', () => {
    const slot = createEffectSlot('delay');
    expect(slot.wetDry).toBe(1);
  });

  it('creates a slot with order = 0', () => {
    const slot = createEffectSlot('gate');
    expect(slot.order).toBe(0);
  });

  it('creates a slot with non-empty id', () => {
    const slot = createEffectSlot('gain');
    expect(slot.id).toBeTruthy();
    expect(slot.id.length).toBeGreaterThan(0);
  });

  it('creates unique ids for different calls', () => {
    const a = createEffectSlot('gain');
    const b = createEffectSlot('gain');
    expect(a.id).not.toBe(b.id);
  });

  it('populates params matching the effect type', () => {
    const slot = createEffectSlot('eq-4band');
    expect(slot.params.lowFreq).toBe(80);
    expect(slot.params.highFreq).toBe(8000);
  });

  it('returns correct type shape for AudioEffectSlot', () => {
    const slot: AudioEffectSlot = createEffectSlot('limiter');
    expect(typeof slot.id).toBe('string');
    expect(typeof slot.effectType).toBe('string');
    expect(typeof slot.enabled).toBe('boolean');
    expect(typeof slot.params).toBe('object');
    expect(typeof slot.wetDry).toBe('number');
    expect(typeof slot.order).toBe('number');
  });
});

// ─── createBus ──────────────────────────────────────────────

describe('createBus', () => {
  it('creates a bus with the given name and type', () => {
    const bus = createBus('Drums', 'submix');
    expect(bus.name).toBe('Drums');
    expect(bus.type).toBe('submix');
  });

  it('defaults volume to 0', () => {
    const bus = createBus('Vocals', 'aux');
    expect(bus.volume).toBe(0);
  });

  it('defaults pan to 0', () => {
    const bus = createBus('Guitars', 'send');
    expect(bus.pan).toBe(0);
  });

  it('defaults muted to false', () => {
    const bus = createBus('FX', 'aux');
    expect(bus.muted).toBe(false);
  });

  it('has empty effectsChain', () => {
    const bus = createBus('Bus1', 'submix');
    expect(bus.effectsChain).toEqual([]);
  });

  it('defaults outputBusId to null', () => {
    const bus = createBus('Sub', 'submix');
    expect(bus.outputBusId).toBeNull();
  });

  it('generates unique ids', () => {
    const a = createBus('A', 'submix');
    const b = createBus('B', 'submix');
    expect(a.id).not.toBe(b.id);
  });

  it('creates master bus type', () => {
    const bus = createBus('Master', 'master');
    expect(bus.type).toBe('master');
    expect(bus.name).toBe('Master');
  });

  it('satisfies AudioBus interface', () => {
    const bus: AudioBus = createBus('Test', 'aux');
    expect(typeof bus.id).toBe('string');
    expect(typeof bus.name).toBe('string');
    expect(Array.isArray(bus.effectsChain)).toBe(true);
  });
});

// ─── createMixerChannel ─────────────────────────────────────

describe('createMixerChannel', () => {
  it('creates a channel with the given trackId and name', () => {
    const ch = createMixerChannel('track-1', 'Voice');
    expect(ch.trackId).toBe('track-1');
    expect(ch.name).toBe('Voice');
  });

  it('defaults volume to 0 dB', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.volume).toBe(0);
  });

  it('defaults pan to center (0)', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.pan).toBe(0);
  });

  it('defaults muted to false', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.muted).toBe(false);
  });

  it('defaults solo to false', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.solo).toBe(false);
  });

  it('has empty busAssignments', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.busAssignments).toEqual([]);
  });

  it('defaults inputBus to null', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.inputBus).toBeNull();
  });

  it('has empty effectsChain', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.effectsChain).toEqual([]);
  });

  it('has empty automation', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.automation).toEqual({});
  });

  it('metering starts at -Infinity peak', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.metering.peakLevel).toBe(-Infinity);
  });

  it('metering starts at -Infinity rms', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.metering.rmsLevel).toBe(-Infinity);
  });

  it('metering starts with 0 clip count', () => {
    const ch = createMixerChannel('t1', 'Test');
    expect(ch.metering.clipCount).toBe(0);
  });

  it('satisfies MixerChannel interface', () => {
    const ch: MixerChannel = createMixerChannel('t1', 'Test');
    expect(typeof ch.trackId).toBe('string');
    expect(typeof ch.name).toBe('string');
    expect(typeof ch.volume).toBe('number');
    expect(typeof ch.pan).toBe('number');
    expect(typeof ch.muted).toBe('boolean');
    expect(typeof ch.solo).toBe('boolean');
    expect(Array.isArray(ch.busAssignments)).toBe(true);
    expect(Array.isArray(ch.effectsChain)).toBe(true);
    expect(typeof ch.automation).toBe('object');
    expect(typeof ch.metering).toBe('object');
  });
});

// ─── createDefaultMixerState ────────────────────────────────

describe('createDefaultMixerState', () => {
  it('creates state with empty channels', () => {
    const state = createDefaultMixerState();
    expect(state.channels).toEqual([]);
  });

  it('creates state with empty buses', () => {
    const state = createDefaultMixerState();
    expect(state.buses).toEqual([]);
  });

  it('creates state with a master bus', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus).toBeDefined();
    expect(state.masterBus.name).toBe('Master');
    expect(state.masterBus.type).toBe('master');
  });

  it('master bus is unmuted by default', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus.muted).toBe(false);
  });

  it('master bus volume defaults to 0', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus.volume).toBe(0);
  });

  it('master bus pan defaults to center', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus.pan).toBe(0);
  });

  it('master bus has empty effects chain', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus.effectsChain).toEqual([]);
  });

  it('master bus output is null', () => {
    const state = createDefaultMixerState();
    expect(state.masterBus.outputBusId).toBeNull();
  });

  it('satisfies MixerState interface', () => {
    const state: MixerState = createDefaultMixerState();
    expect(Array.isArray(state.channels)).toBe(true);
    expect(Array.isArray(state.buses)).toBe(true);
    expect(typeof state.masterBus).toBe('object');
  });

  it('each call returns a fresh master bus instance', () => {
    const a = createDefaultMixerState();
    const b = createDefaultMixerState();
    expect(a.masterBus).not.toBe(b.masterBus);
  });
});

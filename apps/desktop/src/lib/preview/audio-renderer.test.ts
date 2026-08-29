// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/preview/audio-renderer.ts（388 行，四期-B 前覆盖 0%）
// 覆盖目标：≥60%（DOM/Audio 耦合类）。模式：mock window.AudioContext + createAudioElement，
// 断言节点参数（gain/pan/playbackRate/校准时间）与调用序列而非音频值；
// 借助 __OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ 开启 recordAudioMix 读回增益。

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createProject, createTrack, DEFAULT_CLIP_SPEED, type Clip, type MediaAsset } from '@open-factory/editor-core';

vi.mock('./media-elements', () => ({
  createAudioElement: vi.fn(),
}));

import { PreviewAudioRenderer } from './audio-renderer';
import { createAudioElement } from './media-elements';

// ── Fake Web Audio ───────────────────────────────────────────────────

class FakeParam {
  value = 1;
}

function connectSpy() {
  return vi.fn((node: unknown) => node);
}

function makeFakeAnalyser() {
  return {
    fftSize: 2048,
    get frequencyBinCount() {
      return this.fftSize / 2;
    },
    getByteFrequencyData: vi.fn((data: Uint8Array) => {
      data.fill(40);
    }),
    getByteTimeDomainData: vi.fn((data: Uint8Array) => {
      data.fill(128);
    }),
    connect: connectSpy(),
  };
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  sampleRate = 48_000;
  destination = { kind: 'destination', connect: connectSpy() };
  resume = vi.fn(async () => undefined);

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    return { gain: new FakeParam(), connect: connectSpy() };
  }

  createAnalyser() {
    return makeFakeAnalyser();
  }

  createBiquadFilter() {
    return {
      type: 'peaking',
      frequency: new FakeParam(),
      gain: new FakeParam(),
      Q: new FakeParam(),
      connect: connectSpy(),
    };
  }

  createDynamicsCompressor() {
    return {
      threshold: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
      connect: connectSpy(),
    };
  }

  createStereoPanner() {
    return { pan: new FakeParam(), connect: connectSpy() };
  }

  createPanner() {
    return {
      panningModel: 'equalpower',
      distanceModel: 'inverse',
      refDistance: 1,
      maxDistance: 6,
      positionX: new FakeParam(),
      positionY: new FakeParam(),
      positionZ: new FakeParam(),
      connect: connectSpy(),
    };
  }

  createMediaElementSource(element: unknown) {
    return { element, connect: connectSpy() };
  }
}

/** 音频元素桩：play 返回 promise，属性可断言。 */
function makeStubAudio() {
  return {
    src: '',
    volume: 1,
    playbackRate: 1,
    currentTime: 0,
    paused: true,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
  };
}

// ── Fixture ──────────────────────────────────────────────────────────

const media: MediaAsset[] = [
  { id: 'media-a', type: 'audio', name: 'a.wav', path: 'D:/audio/a.wav', duration: 4, width: 0, height: 0 },
];

function makeTimeline(clipOverrides: Record<string, unknown> = {}) {
  const project = createProject('Audio Renderer Test');
  project.timeline = {
    transitions: [],
    markers: [],
    tracks: [
      createTrack({
        id: 'track-audio',
        type: 'audio',
        name: 'Music',
        clips: [
          {
            id: 'clip-audio',
            type: 'audio',
            name: 'BGM',
            mediaId: 'media-a',
            trackId: 'track-audio',
            start: 0,
            duration: 4,
            trimStart: 0,
            trimEnd: 0,
            speed: DEFAULT_CLIP_SPEED,
            volume: 0.8,
            ...clipOverrides,
          } as unknown as Clip,
        ],
      }),
    ],
  };
  return project.timeline;
}

function setupAudioStub() {
  const audio = makeStubAudio();
  vi.mocked(createAudioElement).mockReturnValue(audio as unknown as HTMLAudioElement);
  return audio;
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeAudioContext.instances = [];
  (window as unknown as Record<string, unknown>).__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = true;
  (window as unknown as Record<string, unknown>).__OPEN_FACTORY_AUDIO_MIX_DEBUG__ = undefined;
  (window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext;
  (window as unknown as Record<string, unknown>).webkitAudioContext = undefined;
});

afterEach(() => {
  (window as unknown as Record<string, unknown>).__OPEN_FACTORY_NATIVE_PREVIEW_SMOKE_ACTIVE__ = false;
  (window as unknown as Record<string, unknown>).__OPEN_FACTORY_AUDIO_MIX_DEBUG__ = undefined;
  delete (window as unknown as Record<string, unknown>).AudioContext;
});

function lastGainValues(): number[] {
  const debug = (window as unknown as Record<string, { gainValues?: number[] }>).__OPEN_FACTORY_AUDIO_MIX_DEBUG__;
  return debug?.gainValues ?? [];
}

// ── 用例 ─────────────────────────────────────────────────────────────

describe('PreviewAudioRenderer syncAudio 播放同步', () => {
  it('播放中的音频 clip：创建元素、节点并播放，增益 = clip 音量', () => {
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);

    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.volume).toBe(1);
    expect(lastGainValues().at(-1)).toBeCloseTo(0.8, 3);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('重复 sync 复用已创建的 audio 元素与节点', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);
    renderer.syncAudio(timeline, media, 2, true);

    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('暂停态不调用 play；播放中再次 sync 保持播放', () => {
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, false);
    expect(audio.play).not.toHaveBeenCalled();

    renderer.syncAudio(timeline, media, 1, true);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('muted clip 增益归零但仍创建节点', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline({ muted: true });

    renderer.syncAudio(timeline, media, 1, true);

    expect(lastGainValues().at(-1)).toBe(0);
  });

  it('clip 移出播放头后暂停对应元素', () => {
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);
    renderer.syncAudio(timeline, media, 5, true);

    expect(audio.pause).toHaveBeenCalled();
  });

  it('masterVolume 超界值被钳制且不抛错', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true, 5);
    renderer.syncAudio(timeline, media, 1, true, -1);

    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('pauseAllAudio 暂停全部元素', () => {
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);
    renderer.pauseAllAudio();

    expect(audio.pause).toHaveBeenCalled();
  });

  it('reverseAudio clip 的源时间从尾部倒数校准', () => {
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline({ reverseAudio: true });

    renderer.syncAudio(timeline, media, 1, true);

    // localTime=1, sourceOffset=1, visible=4 → sourceTime = 4-1 = 3
    expect(audio.currentTime).toBe(3);
  });

  it('fadeIn 削减增益（线性曲线，前半段）', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline({ fadeInDuration: 2, fadeInCurve: 'linear' });

    renderer.syncAudio(timeline, media, 0.5, true);

    // multiplier = 0.5/2 = 0.25 → gain = 0.8 * 0.25 = 0.2
    expect(lastGainValues().at(-1)).toBeCloseTo(0.2, 3);
  });

  it('缺失媒体资产不创建音频元素', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline({ mediaId: 'media-missing' });

    renderer.syncAudio(timeline, media, 1, true);

    expect(createAudioElement).not.toHaveBeenCalled();
  });

  it('混音台自动化音量（+6dB）写入节点增益', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();
    const mixerState = {
      channels: [
        {
          trackId: 'track-audio',
          automation: {
            volume: { points: [{ time: 0, value: 6, curve: 'linear' as const }] },
            pan: { points: [{ time: 0, value: 50, curve: 'linear' as const }] },
          },
        },
      ],
    };

    renderer.syncAudio(timeline, media, 1, true, 1, mixerState as never);

    // gain = 0.8 * 10^(6/20) ≈ 1.597
    expect(lastGainValues().at(-1)).toBeCloseTo(0.8 * 10 ** (6 / 20), 3);
  });
});

describe('PreviewAudioRenderer AudioContext 回退路径', () => {
  it('无 AudioContext 时走 fallback 增益并照常播放', () => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
    delete (window as unknown as Record<string, unknown>).webkitAudioContext;
    const audio = setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe('PreviewAudioRenderer 电平与频谱读取', () => {
  it('getLevels 返回轨道/主输出电平与频段结构', () => {
    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();

    renderer.syncAudio(timeline, media, 1, true);
    const levels = renderer.getLevels(1000);

    expect(levels.trackLevels['track-audio']).toMatchObject({
      levelDb: expect.any(Number),
      peakDb: expect.any(Number),
    });
    expect(levels.masterLevel).toMatchObject({ levelDb: expect.any(Number), peakDb: expect.any(Number) });
    expect(levels.trackFrequencyBands['track-audio']).toHaveLength(16);
    expect(levels.trackAnalysisFrames['track-audio']).toMatchObject({
      sampleRate: 48_000,
      recordedAtMs: 1000,
    });
  });

  it('未同步时 getLevels 主输出为静音底噪', () => {
    const renderer = new PreviewAudioRenderer();

    const levels = renderer.getLevels(0);

    expect(levels.masterLevel.levelDb).toBe(-60);
    expect(levels.trackLevels).toEqual({});
  });

  it('readAnalysisFrame 无主分析器返回 undefined；有则返回频谱数据', () => {
    const fresh = new PreviewAudioRenderer();
    expect(fresh.readAnalysisFrame('frequency')).toBeUndefined();

    setupAudioStub();
    const renderer = new PreviewAudioRenderer();
    const timeline = makeTimeline();
    renderer.syncAudio(timeline, media, 1, true);

    const frequency = renderer.readAnalysisFrame('frequency');
    const waveform = renderer.readAnalysisFrame('waveform');

    expect(frequency).toBeInstanceOf(Uint8Array);
    expect(frequency!.length).toBe(512);
    expect(waveform).toBeInstanceOf(Uint8Array);
  });
});

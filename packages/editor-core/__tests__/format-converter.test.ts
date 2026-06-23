import { describe, it, expect } from 'vitest';
import {
  detectMediaCategory,
  resolveConversionDirection,
  resolveIntermediateFormat,
  buildConversionPath,
  generateConversionMatrix,
  buildBatchConversionTasks,
  normalizeConversionPreset,
  BUILTIN_CONVERSION_PRESETS,
  type CodecInfo,
} from '../src/format-converter';

describe('detectMediaCategory', () => {
  it('detects video formats', () => {
    expect(detectMediaCategory('mp4')).toBe('video');
    expect(detectMediaCategory('mkv')).toBe('video');
    expect(detectMediaCategory('webm')).toBe('video');
  });

  it('detects audio formats', () => {
    expect(detectMediaCategory('mp3')).toBe('audio');
    expect(detectMediaCategory('wav')).toBe('audio');
    expect(detectMediaCategory('flac')).toBe('audio');
  });

  it('detects image formats', () => {
    expect(detectMediaCategory('png')).toBe('image');
    expect(detectMediaCategory('webp')).toBe('image');
    expect(detectMediaCategory('exr')).toBe('image');
  });

  it('returns undefined for unknown formats', () => {
    expect(detectMediaCategory('xyz')).toBeUndefined();
  });
});

describe('resolveConversionDirection', () => {
  it('video to video', () => {
    expect(resolveConversionDirection('video', 'mkv')).toBe('video-to-video');
  });

  it('video to audio', () => {
    expect(resolveConversionDirection('video', 'mp3')).toBe('video-to-audio');
  });

  it('video to image sequence', () => {
    expect(resolveConversionDirection('video', 'png')).toBe('video-to-image-sequence');
  });

  it('audio to audio', () => {
    expect(resolveConversionDirection('audio', 'wav')).toBe('audio-to-audio');
  });

  it('image to image', () => {
    expect(resolveConversionDirection('image', 'webp')).toBe('image-to-image');
  });

  it('returns undefined for incompatible directions', () => {
    expect(resolveConversionDirection('audio', 'mp4')).toBeUndefined();
  });
});

describe('resolveIntermediateFormat', () => {
  it('inserts png intermediate for EXR to video', () => {
    expect(resolveIntermediateFormat('exr', 'mp4')).toBe('png');
    expect(resolveIntermediateFormat('exr', 'mkv')).toBe('png');
    expect(resolveIntermediateFormat('exr', 'webm')).toBe('png');
  });

  it('returns undefined for direct conversions', () => {
    expect(resolveIntermediateFormat('mp4', 'mkv')).toBeUndefined();
    expect(resolveIntermediateFormat('png', 'jpg')).toBeUndefined();
  });
});

describe('buildConversionPath', () => {
  it('supported direct path', () => {
    const path = buildConversionPath('mp4', 'mkv');
    expect(path.supported).toBe(true);
    expect(path.direction).toBe('video-to-video');
    expect(path.intermediateFormat).toBeUndefined();
  });

  it('unsupported source format', () => {
    const path = buildConversionPath('xyz', 'mp4');
    expect(path.supported).toBe(false);
  });

  it('unsupported direction', () => {
    const path = buildConversionPath('mp3', 'mp4');
    expect(path.supported).toBe(false);
  });

  it('EXR to MP4 requires intermediate PNG', () => {
    const path = buildConversionPath('exr', 'mp4');
    expect(path.supported).toBe(true);
    expect(path.intermediateFormat).toBe('png');
    expect(path.hint).toContain('中间格式');
  });

  it('codec availability check', () => {
    const codecs: CodecInfo[] = [
      { name: 'libx264', type: 'encoder', mediaCategory: 'video', formats: ['mp4'] },
      { name: 'libvpx', type: 'encoder', mediaCategory: 'video', formats: ['webm'] },
    ];
    const path = buildConversionPath('mp4', 'mkv', codecs);
    expect(path.supported).toBe(false);
    expect(path.hint).toContain('编码器');
  });
});

describe('generateConversionMatrix', () => {
  it('generates matrix from codec list', () => {
    const codecs: CodecInfo[] = [
      { name: 'libx264', type: 'encoder', mediaCategory: 'video', formats: ['mp4', 'mkv'] },
      { name: 'libmp3lame', type: 'encoder', mediaCategory: 'audio', formats: ['mp3'] },
      { name: 'libwav', type: 'encoder', mediaCategory: 'audio', formats: ['wav'] },
    ];
    const matrix = generateConversionMatrix(codecs);
    expect(matrix.has('mp4')).toBe(true);
    expect(matrix.has('mp3')).toBe(true);
    // mp4 → mp3 should be supported (video-to-audio)
    const mp4Paths = matrix.get('mp4')!;
    expect(mp4Paths.some((p) => p.targetFormat === 'mp3' && p.supported)).toBe(true);
  });

  it('empty codecs yields empty matrix', () => {
    expect(generateConversionMatrix([]).size).toBe(0);
  });
});

describe('BUILTIN_CONVERSION_PRESETS', () => {
  it('extract-audio-mp3 preset has correct output args', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'extract-audio-mp3')!;
    expect(preset).toBeDefined();
    expect(preset.targetFormat).toBe('mp3');
    expect(preset.outputArgs).toContain('-vn');
  });

  it('video-to-gif preset has correct args', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'video-to-gif')!;
    expect(preset).toBeDefined();
    expect(preset.targetFormat).toBe('gif');
    expect(preset.outputArgs.some((a) => a.includes('fps'))).toBe(true);
  });

  it('batch-to-webp preset targets image', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'batch-to-webp')!;
    expect(preset).toBeDefined();
    expect(preset.targetFormat).toBe('webp');
    expect(preset.sourceCategory).toContain('image');
  });

  it('all presets have required fields', () => {
    for (const preset of BUILTIN_CONVERSION_PRESETS) {
      expect(preset.id.length).toBeGreaterThan(0);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.targetFormat.length).toBeGreaterThan(0);
      expect(preset.sourceCategory.length).toBeGreaterThan(0);
    }
  });
});

describe('buildBatchConversionTasks', () => {
  it('builds tasks for matching source files', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'extract-audio-mp3')!;
    const files = [
      { path: '/video1.mp4', format: 'mp4' },
      { path: '/video2.mkv', format: 'mkv' },
      { path: '/video3.mov', format: 'mov' },
    ];
    const tasks = buildBatchConversionTasks(files, preset, '/output');
    expect(tasks).toHaveLength(3);
    expect(tasks[0].targetFormat).toBe('mp3');
    expect(tasks[0].status).toBe('pending');
  });

  it('skips files with incompatible source category', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'extract-audio-mp3')!;
    const files = [
      { path: '/video1.mp4', format: 'mp4' },
      { path: '/audio1.mp3', format: 'mp3' },
    ];
    const tasks = buildBatchConversionTasks(files, preset, '/output');
    expect(tasks).toHaveLength(1);
  });

  it('assigns unique ids with prefix', () => {
    const preset = BUILTIN_CONVERSION_PRESETS.find((p) => p.id === 'batch-to-webp')!;
    const files = [
      { path: '/img1.png', format: 'png' },
      { path: '/img2.jpg', format: 'jpg' },
    ];
    const tasks = buildBatchConversionTasks(files, preset, '/output', 'test');
    expect(tasks[0].id).toBe('test-1');
    expect(tasks[1].id).toBe('test-2');
  });
});

describe('normalizeConversionPreset', () => {
  it('returns undefined for invalid input', () => {
    expect(normalizeConversionPreset(undefined)).toBeUndefined();
    expect(normalizeConversionPreset({})).toBeUndefined();
  });

  it('normalizes valid preset', () => {
    const result = normalizeConversionPreset({
      id: ' test ',
      name: ' Test ',
      targetFormat: 'MP4 ',
      sourceCategory: ['video', 'invalid' as any],
      outputArgs: ['-c:v', 'libx264'],
    });
    expect(result?.id).toBe('test');
    expect(result?.name).toBe('Test');
    expect(result?.targetFormat).toBe('mp4');
    expect(result?.sourceCategory).toEqual(['video']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromText,
  parseWhisperSrt,
  createSegmentsFromTimestamps,
  mergeShortSegments,
  splitLongSegments,
  alignTimestamps,
  estimateReadingTimeMs,
  segmentsToSubtitleClips,
  validateTranscriptionResult,
  processWhisperOutput,
} from '../src/ai/transcription';
import type { TranscriptionSegment } from '../src/ai/transcription';

// -- 测试数据 --

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
你好，欢迎来到这个视频。

2
00:00:04,000 --> 00:00:07,200
今天我们来讨论人工智能的发展。

3
00:00:08,000 --> 00:00:10,000
Thank you for watching.`;

const SAMPLE_SEGMENTS: TranscriptionSegment[] = [
  { startMs: 1000, endMs: 3500, text: '你好，欢迎来到这个视频。' },
  { startMs: 4000, endMs: 7200, text: '今天我们来讨论人工智能的发展。' },
  { startMs: 8000, endMs: 10000, text: 'Thank you for watching.' },
];

// -- detectLanguageFromText --

describe('detectLanguageFromText', () => {
  it('检测中文文本', () => {
    expect(detectLanguageFromText('你好，欢迎来到这个视频')).toBe('zh');
  });

  it('检测英文文本', () => {
    expect(detectLanguageFromText('Hello, welcome to this video')).toBe('en');
  });

  it('检测日文文本', () => {
    expect(detectLanguageFromText('こんにちは、ようこそ')).toBe('ja');
  });

  it('检测韩文文本', () => {
    expect(detectLanguageFromText('안녕하세요 환영합니다')).toBe('ko');
  });

  it('空文本返回 auto', () => {
    expect(detectLanguageFromText('')).toBe('auto');
  });

  it('纯数字文本返回 auto', () => {
    expect(detectLanguageFromText('12345')).toBe('auto');
  });

  it('混合文本以中文字符为主时返回 zh', () => {
    expect(detectLanguageFromText('这是中文text混合')).toBe('zh');
  });
});

// -- parseWhisperSrt --

describe('parseWhisperSrt', () => {
  it('解析标准 SRT 内容为转录片段', () => {
    const segments = parseWhisperSrt(SAMPLE_SRT);
    expect(segments).toHaveLength(3);
    expect(segments[0].startMs).toBe(1000);
    expect(segments[0].endMs).toBe(3500);
    expect(segments[0].text).toBe('你好，欢迎来到这个视频。');
  });

  it('空内容返回空数组', () => {
    expect(parseWhisperSrt('')).toHaveLength(0);
  });

  it('处理 BOM 标记', () => {
    const srtWithBom = '\uFEFF' + SAMPLE_SRT;
    const segments = parseWhisperSrt(srtWithBom);
    expect(segments).toHaveLength(3);
  });

  it('处理 Windows 换行符', () => {
    const srtWithCRLF = SAMPLE_SRT.replace(/\n/g, '\r\n');
    const segments = parseWhisperSrt(srtWithCRLF);
    expect(segments).toHaveLength(3);
  });
});

// -- createSegmentsFromTimestamps --

describe('createSegmentsFromTimestamps', () => {
  it('从时间戳数组创建片段', () => {
    const timestamps = [
      { startMs: 1000, endMs: 3000, text: 'Hello' },
      { startMs: 4000, endMs: 6000, text: 'World' },
    ];
    const segments = createSegmentsFromTimestamps(timestamps);
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe('Hello');
  });

  it('过滤空文本片段', () => {
    const timestamps = [
      { startMs: 1000, endMs: 3000, text: 'Hello' },
      { startMs: 4000, endMs: 6000, text: '   ' },
    ];
    const segments = createSegmentsFromTimestamps(timestamps);
    expect(segments).toHaveLength(1);
  });

  it('按时间排序', () => {
    const timestamps = [
      { startMs: 4000, endMs: 6000, text: 'World' },
      { startMs: 1000, endMs: 3000, text: 'Hello' },
    ];
    const segments = createSegmentsFromTimestamps(timestamps);
    expect(segments[0].text).toBe('Hello');
  });

  it('处理负数时间戳', () => {
    const timestamps = [
      { startMs: -100, endMs: 3000, text: 'Hello' },
    ];
    const segments = createSegmentsFromTimestamps(timestamps);
    expect(segments[0].startMs).toBe(0);
  });
});

// -- mergeShortSegments --

describe('mergeShortSegments', () => {
  it('合并间隔过小的片段', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 200, text: '你好' },
      { startMs: 250, endMs: 1000, text: '世界' },
    ];
    const merged = mergeShortSegments(segments, 500, 300);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('你好 世界');
  });

  it('不合并间隔较大的片段', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 2000, text: '你好' },
      { startMs: 5000, endMs: 7000, text: '世界' },
    ];
    const merged = mergeShortSegments(segments, 500, 300);
    expect(merged).toHaveLength(2);
  });

  it('空数组返回空数组', () => {
    expect(mergeShortSegments([])).toHaveLength(0);
  });

  it('单个片段直接返回', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 1000, text: '你好' },
    ];
    expect(mergeShortSegments(segments)).toHaveLength(1);
  });

  it('合并后保留较低的置信度', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 200, text: '你好', confidence: 0.9 },
      { startMs: 250, endMs: 1000, text: '世界', confidence: 0.7 },
    ];
    const merged = mergeShortSegments(segments, 500, 300);
    expect(merged[0].confidence).toBe(0.7);
  });
});

// -- splitLongSegments --

describe('splitLongSegments', () => {
  it('不拆分正常长度的片段', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 3000, text: '短文本' },
    ];
    expect(splitLongSegments(segments)).toHaveLength(1);
  });

  it('按句号拆分过长文本', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 20000, text: '这是第一句话。这是第二句话。这是第三句话。' },
    ];
    const split = splitLongSegments(segments, 10000, 20);
    expect(split.length).toBeGreaterThan(1);
  });

  it('按逗号拆分长文本', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 20000, text: '这是第一部分，这是第二部分，这是第三部分' },
    ];
    const split = splitLongSegments(segments, 10000, 15);
    expect(split.length).toBeGreaterThan(1);
  });

  it('拆分后时间戳连续', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 20000, text: '很长的文本内容需要被拆分成多个片段' },
    ];
    const split = splitLongSegments(segments, 5000, 5);
    for (let i = 1; i < split.length; i++) {
      expect(split[i].startMs).toBe(split[i - 1].endMs);
    }
  });

  it('保留说话人信息', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 20000, text: '很长的文本内容需要被拆分', speaker: '张三', speakerId: 1 },
    ];
    const split = splitLongSegments(segments, 5000, 5);
    for (const seg of split) {
      expect(seg.speaker).toBe('张三');
      expect(seg.speakerId).toBe(1);
    }
  });
});

// -- alignTimestamps --

describe('alignTimestamps', () => {
  it('正向偏移时间戳', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 1000, endMs: 3000, text: 'Hello' },
    ];
    const aligned = alignTimestamps(segments, 2000);
    expect(aligned[0].startMs).toBe(3000);
    expect(aligned[0].endMs).toBe(5000);
  });

  it('负向偏移时间戳', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 3000, endMs: 5000, text: 'Hello' },
    ];
    const aligned = alignTimestamps(segments, -2000);
    expect(aligned[0].startMs).toBe(1000);
    expect(aligned[0].endMs).toBe(3000);
  });

  it('负向偏移不产生负数时间戳', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 1000, endMs: 3000, text: 'Hello' },
    ];
    const aligned = alignTimestamps(segments, -5000);
    expect(aligned[0].startMs).toBe(0);
    expect(aligned[0].endMs).toBe(0);
  });

  it('零偏移返回原数组', () => {
    const aligned = alignTimestamps(SAMPLE_SEGMENTS, 0);
    expect(aligned).toBe(SAMPLE_SEGMENTS);
  });
});

// -- estimateReadingTimeMs --

describe('estimateReadingTimeMs', () => {
  it('估算中文阅读时间', () => {
    const time = estimateReadingTimeMs('你好世界', 'zh');
    expect(time).toBe(800); // 4 字 * 200ms
  });

  it('估算英文阅读时间', () => {
    const time = estimateReadingTimeMs('Hello World', 'en');
    expect(time).toBe(880); // 11 字符 * 80ms
  });

  it('空文本返回 0', () => {
    expect(estimateReadingTimeMs('', 'zh')).toBe(0);
  });

  it('自动检测语言', () => {
    const time = estimateReadingTimeMs('你好世界');
    expect(time).toBeGreaterThan(0);
  });
});

// -- segmentsToSubtitleClips --

describe('segmentsToSubtitleClips', () => {
  it('将片段转换为 SubtitleClip', () => {
    const clips = segmentsToSubtitleClips(SAMPLE_SEGMENTS, 'track-1');
    expect(clips).toHaveLength(3);
    expect(clips[0].type).toBe('subtitle');
    expect(clips[0].trackId).toBe('track-1');
    expect(clips[0].text).toBe('你好，欢迎来到这个视频。');
    expect(clips[0].start).toBe(1);
    expect(clips[0].duration).toBe(2.5);
  });

  it('使用默认样式', () => {
    const clips = segmentsToSubtitleClips(SAMPLE_SEGMENTS, 'track-1');
    expect(clips[0].style).toBeDefined();
    expect(clips[0].subtitleMode).toBe('burn-in');
  });

  it('使用自定义配置', () => {
    const clips = segmentsToSubtitleClips(SAMPLE_SEGMENTS, 'track-1', {
      subtitleMode: 'soft-sub',
      subtitleType: 'cc',
    });
    expect(clips[0].subtitleMode).toBe('soft-sub');
    expect(clips[0].subtitleType).toBe('cc');
  });

  it('生成唯一 ID', () => {
    const clips = segmentsToSubtitleClips(SAMPLE_SEGMENTS, 'track-1');
    const ids = new Set(clips.map((c) => c.id));
    expect(ids.size).toBe(clips.length);
  });
});

// -- validateTranscriptionResult --

describe('validateTranscriptionResult', () => {
  it('有效片段返回空问题列表', () => {
    const issues = validateTranscriptionResult(SAMPLE_SEGMENTS);
    expect(issues).toHaveLength(0);
  });

  it('检测空文本', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 1000, text: '' },
    ];
    const issues = validateTranscriptionResult(segments);
    expect(issues.some((i) => i.type === 'empty-text')).toBe(true);
  });

  it('检测无效时间', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 3000, endMs: 1000, text: 'Hello' },
    ];
    const issues = validateTranscriptionResult(segments);
    expect(issues.some((i) => i.type === 'invalid-time')).toBe(true);
  });

  it('检测时间重叠', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 3000, text: 'Hello' },
      { startMs: 2000, endMs: 5000, text: 'World' },
    ];
    const issues = validateTranscriptionResult(segments);
    expect(issues.some((i) => i.type === 'overlap')).toBe(true);
  });

  it('检测过短片段', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: 0, endMs: 100, text: 'Hi' },
    ];
    const issues = validateTranscriptionResult(segments, 500);
    expect(issues.some((i) => i.type === 'too-short')).toBe(true);
  });

  it('检测负数时间戳', () => {
    const segments: TranscriptionSegment[] = [
      { startMs: -100, endMs: 1000, text: 'Hello' },
    ];
    const issues = validateTranscriptionResult(segments);
    expect(issues.some((i) => i.type === 'invalid-time')).toBe(true);
  });
});

// -- processWhisperOutput --

describe('processWhisperOutput', () => {
  it('完整处理 Whisper SRT 输出', () => {
    const result = processWhisperOutput(SAMPLE_SRT);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.language).toBeDefined();
    expect(result.issues).toBeDefined();
  });

  it('使用指定语言配置', () => {
    const result = processWhisperOutput(SAMPLE_SRT, { language: 'zh' });
    expect(result.language).toBe('zh');
  });

  it('自动检测混合文本语言', () => {
    const result = processWhisperOutput(SAMPLE_SRT);
    // 包含中文和英文，应检测为中文（中文字符占比较高）
    expect(['zh', 'auto']).toContain(result.language);
  });

  it('空内容返回空结果', () => {
    const result = processWhisperOutput('');
    expect(result.segments).toHaveLength(0);
  });

  it('应用合并和拆分配置', () => {
    const result = processWhisperOutput(SAMPLE_SRT, {
      minSegmentDurationMs: 100,
      mergeGapMs: 100,
      maxSegmentDurationMs: 5000,
    });
    expect(result.segments.length).toBeGreaterThan(0);
  });
});

/**
 * Headless video analyzer — quality/semantic/compliance analysis
 * without requiring a GUI environment.
 */

import type {
  HeadlessAnalyzeRequest,
  HeadlessAnalyzeResult,
  QualityReport,
  QualityIssue,
  SemanticReport,
  ComplianceReport,
  ComplianceCheck,
  FullReport,
  HeadlessProgress,
} from './headless-editor-core';

/**
 * Probe video file using ffprobe to extract technical metadata.
 */
export async function probeVideo(inputPath: string, ffprobePath = 'ffprobe'): Promise<{
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  audioSampleRate: number;
  duration: number;
}> {
  const { execFile } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ],
      (error, stdout) => {
        if (error) {
          reject(new Error(`ffprobe failed: ${error.message}`));
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = (data.streams ?? []).find(
            (s: Record<string, unknown>) => s.codec_type === 'video',
          );
          const audioStream = (data.streams ?? []).find(
            (s: Record<string, unknown>) => s.codec_type === 'audio',
          );

          const fpsParts = (videoStream?.r_frame_rate as string ?? '30/1').split('/');
          const fps = Number(fpsParts[0]) / Number(fpsParts[1]);

          resolve({
            width: Number(videoStream?.width ?? 0),
            height: Number(videoStream?.height ?? 0),
            frameRate: Math.round(fps * 100) / 100,
            bitrate: Number(data.format?.bit_rate ?? 0),
            codec: String(videoStream?.codec_name ?? 'unknown'),
            audioCodec: String(audioStream?.codec_name ?? 'unknown'),
            audioChannels: Number(audioStream?.channels ?? 0),
            audioSampleRate: Number(audioStream?.sample_rate ?? 0),
            duration: Number(data.format?.duration ?? 0),
          });
        } catch {
          reject(new Error('Failed to parse ffprobe output'));
        }
      },
    );
  });
}

/**
 * Measure audio loudness using ffmpeg loudnorm filter (2-pass).
 */
export async function measureLoudness(inputPath: string, ffmpegPath = 'ffmpeg'): Promise<{
  integrated: number;
  truePeak: number;
  range: number;
}> {
  const { execFile } = await import('node:child_process');

  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      [
        '-i', inputPath,
        '-af', 'loudnorm=print_format=json',
        '-f', 'null',
        '-',
      ],
      { timeout: 60_000 },
      (_error, _stdout, stderr) => {
        // Parse loudnorm JSON output from stderr
        const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            resolve({
              integrated: Number(data.input_i ?? -24),
              truePeak: Number(data.input_tp ?? 0),
              range: Number(data.input_lra ?? 0),
            });
            return;
          } catch {
            // fall through
          }
        }
        // Fallback if loudnorm parsing fails
        resolve({ integrated: -24, truePeak: 0, range: 0 });
      },
    );
  });
}

/**
 * Analyze video quality and return a quality report.
 */
export async function analyzeQuality(
  inputPath: string,
  onProgress?: (p: HeadlessProgress) => void,
): Promise<QualityReport> {
  onProgress?.({ phase: 'analyzing', percent: 10, message: 'Probing video metadata' });

  const meta = await probeVideo(inputPath);
  onProgress?.({ phase: 'analyzing', percent: 40, message: 'Measuring loudness' });

  const loudness = await measureLoudness(inputPath);
  onProgress?.({ phase: 'analyzing', percent: 80, message: 'Evaluating quality' });

  const issues: QualityIssue[] = [];

  // Resolution checks
  if (meta.width < 1280 || meta.height < 720) {
    issues.push({
      severity: 'warning',
      code: 'LOW_RESOLUTION',
      message: `Resolution ${meta.width}x${meta.height} is below HD (1280x720)`,
    });
  }

  // Frame rate checks
  if (meta.frameRate < 24) {
    issues.push({
      severity: 'warning',
      code: 'LOW_FRAMERATE',
      message: `Frame rate ${meta.frameRate} fps is below cinematic standard (24fps)`,
    });
  }

  // Bitrate checks
  const bitrateMbps = meta.bitrate / 1_000_000;
  if (meta.width >= 1920 && bitrateMbps < 4) {
    issues.push({
      severity: 'warning',
      code: 'LOW_BITRATE',
      message: `Bitrate ${bitrateMbps.toFixed(1)} Mbps may be too low for ${meta.width}x${meta.height}`,
    });
  }

  // Loudness checks
  if (loudness.integrated > -14) {
    issues.push({
      severity: 'warning',
      code: 'LOUDNESS_HIGH',
      message: `Integrated loudness ${loudness.integrated} LUFS exceeds -14 LUFS target`,
    });
  }
  if (loudness.truePeak > -1) {
    issues.push({
      severity: 'critical',
      code: 'TRUE_PEAK_CLIPPING',
      message: `True peak ${loudness.truePeak} dBTP exceeds -1 dBTP, risking clipping`,
    });
  }

  // Calculate quality score (0-100)
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 20;
    else if (issue.severity === 'warning') score -= 10;
    else score -= 3;
  }
  score = Math.max(0, Math.min(100, score));

  onProgress?.({ phase: 'done', percent: 100, message: 'Quality analysis complete' });

  return {
    type: 'quality',
    resolution: { width: meta.width, height: meta.height },
    frameRate: meta.frameRate,
    bitrate: meta.bitrate,
    codec: meta.codec,
    audioCodec: meta.audioCodec,
    audioChannels: meta.audioChannels,
    audioSampleRate: meta.audioSampleRate,
    loudness,
    issues,
    score,
  };
}

/**
 * Analyze video semantics (scene detection stub — requires AI provider).
 */
export async function analyzeSemantic(
  inputPath: string,
  onProgress?: (p: HeadlessProgress) => void,
): Promise<SemanticReport> {
  onProgress?.({ phase: 'analyzing', percent: 10, message: 'Probing video' });

  const meta = await probeVideo(inputPath);
  onProgress?.({ phase: 'analyzing', percent: 50, message: 'Detecting scenes' });

  // Basic scene detection via ffmpeg scene change filter
  const scenes = await detectScenes(inputPath, meta.duration);
  onProgress?.({ phase: 'done', percent: 100, message: 'Semantic analysis complete' });

  return {
    type: 'semantic',
    scenes,
    duration: meta.duration,
    summary: `Video with ${scenes.length} detected scenes, ${meta.duration.toFixed(1)}s total duration`,
  };
}

/**
 * Detect scene changes using ffmpeg.
 */
async function detectScenes(
  inputPath: string,
  duration: number,
  threshold = 0.3,
  ffmpegPath = 'ffmpeg',
): Promise<Array<{ index: number; startTime: number; endTime: number; tags: string[] }>> {
  const { execFile } = await import('node:child_process');

  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      [
        '-i', inputPath,
        '-vf', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null',
        '-',
      ],
      { timeout: 120_000 },
      (_error, _stdout, stderr) => {
        const timestamps: number[] = [];
        const timeRegex = /pts_time:([\d.]+)/g;
        let match;
        while ((match = timeRegex.exec(stderr)) !== null) {
          timestamps.push(Number(match[1]));
        }

        // Build scene list
        const scenes: Array<{ index: number; startTime: number; endTime: number; tags: string[] }> = [];
        const boundaries = [0, ...timestamps, duration];

        for (let i = 0; i < boundaries.length - 1; i++) {
          scenes.push({
            index: i,
            startTime: Math.round(boundaries[i] * 100) / 100,
            endTime: Math.round(boundaries[i + 1] * 100) / 100,
            tags: [],
          });
        }

        resolve(scenes);
      },
    );
  });
}

/**
 * Run compliance checks against common platform requirements.
 */
export async function analyzeCompliance(
  inputPath: string,
  platform: string,
  onProgress?: (p: HeadlessProgress) => void,
): Promise<ComplianceReport> {
  onProgress?.({ phase: 'analyzing', percent: 20, message: 'Probing video' });

  const meta = await probeVideo(inputPath);
  onProgress?.({ phase: 'analyzing', percent: 60, message: 'Checking compliance' });

  const checks: ComplianceCheck[] = [];

  // Platform-specific checks
  const platformRules = getPlatformRules(platform);

  for (const rule of platformRules) {
    const actual = rule.getActual(meta);
    checks.push({
      name: rule.name,
      passed: rule.check(meta),
      expected: rule.expected,
      actual,
    });
  }

  const passed = checks.every((c) => c.passed);
  onProgress?.({ phase: 'done', percent: 100, message: 'Compliance check complete' });

  return { type: 'compliance', platform, passed, checks };
}

interface PlatformRule {
  name: string;
  expected: string;
  check: (meta: Awaited<ReturnType<typeof probeVideo>>) => boolean;
  getActual: (meta: Awaited<ReturnType<typeof probeVideo>>) => string;
}

function getPlatformRules(platform: string): PlatformRule[] {
  const rules: Record<string, PlatformRule[]> = {
    youtube: [
      { name: 'Resolution', expected: '1920x1080 or higher', check: (m) => m.width >= 1920 && m.height >= 1080, getActual: (m) => `${m.width}x${m.height}` },
      { name: 'Frame Rate', expected: '24-60 fps', check: (m) => m.frameRate >= 24 && m.frameRate <= 60, getActual: (m) => `${m.frameRate} fps` },
      { name: 'Video Codec', expected: 'h264 or h265', check: (m) => ['h264', 'hevc', 'h265'].includes(m.codec), getActual: (m) => m.codec },
      { name: 'Audio Codec', expected: 'aac', check: (m) => m.audioCodec === 'aac', getActual: (m) => m.audioCodec },
    ],
    tiktok: [
      { name: 'Resolution', expected: '1080x1920 (vertical)', check: (m) => m.width >= 1080 && m.height >= 1920, getActual: (m) => `${m.width}x${m.height}` },
      { name: 'Duration', expected: '10-180 seconds', check: (m) => m.duration >= 10 && m.duration <= 180, getActual: (m) => `${m.duration.toFixed(1)}s` },
    ],
    bilibili: [
      { name: 'Resolution', expected: '1920x1080 or higher', check: (m) => m.width >= 1920 && m.height >= 1080, getActual: (m) => `${m.width}x${m.height}` },
      { name: 'Video Codec', expected: 'h264 or h265', check: (m) => ['h264', 'hevc', 'h265'].includes(m.codec), getActual: (m) => m.codec },
    ],
  };

  return rules[platform] ?? rules['youtube']!;
}

/**
 * Run full analysis (quality + semantic + compliance).
 */
export async function analyzeFull(
  inputPath: string,
  onProgress?: (p: HeadlessProgress) => void,
): Promise<FullReport> {
  onProgress?.({ phase: 'analyzing', percent: 0, message: 'Starting full analysis' });

  const quality = await analyzeQuality(inputPath, (p) => {
    onProgress?.({ ...p, percent: p.percent * 0.4 });
  });

  const semantic = await analyzeSemantic(inputPath, (p) => {
    onProgress?.({ ...p, percent: 40 + p.percent * 0.3 });
  });

  const compliance = await Promise.all([
    analyzeCompliance(inputPath, 'youtube', (p) => {
      onProgress?.({ ...p, percent: 70 + p.percent * 0.1 });
    }),
    analyzeCompliance(inputPath, 'tiktok', (p) => {
      onProgress?.({ ...p, percent: 80 + p.percent * 0.1 });
    }),
    analyzeCompliance(inputPath, 'bilibili', (p) => {
      onProgress?.({ ...p, percent: 90 + p.percent * 0.1 });
    }),
  ]);

  onProgress?.({ phase: 'done', percent: 100, message: 'Full analysis complete' });

  return { type: 'full', quality, semantic, compliance };
}

/**
 * Main analysis entry point.
 */
export async function headlessAnalyze(request: HeadlessAnalyzeRequest): Promise<HeadlessAnalyzeResult> {
  try {
    let report;

    switch (request.type) {
      case 'quality':
        report = await analyzeQuality(request.inputPath, request.onProgress);
        break;
      case 'semantic':
        report = await analyzeSemantic(request.inputPath, request.onProgress);
        break;
      case 'compliance':
        report = await analyzeCompliance(request.inputPath, request.platform ?? 'youtube', request.onProgress);
        break;
      case 'full':
        report = await analyzeFull(request.inputPath, request.onProgress);
        break;
    }

    return { success: true, report };
  } catch (err) {
    const fallbackReport = buildFallbackReport(request.type);
    return {
      success: false,
      report: fallbackReport,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildFallbackReport(type: HeadlessAnalyzeRequest['type']): QualityReport | SemanticReport | ComplianceReport | FullReport {
  switch (type) {
    case 'quality':
      return { type: 'quality', resolution: { width: 0, height: 0 }, frameRate: 0, bitrate: 0, codec: '', audioCodec: '', audioChannels: 0, audioSampleRate: 0, loudness: { integrated: 0, truePeak: 0, range: 0 }, issues: [], score: 0 };
    case 'semantic':
      return { type: 'semantic', scenes: [], duration: 0, summary: 'Analysis failed' };
    case 'compliance':
      return { type: 'compliance', platform: 'unknown', passed: false, checks: [] };
    case 'full':
      return {
        type: 'full',
        quality: { type: 'quality', resolution: { width: 0, height: 0 }, frameRate: 0, bitrate: 0, codec: '', audioCodec: '', audioChannels: 0, audioSampleRate: 0, loudness: { integrated: 0, truePeak: 0, range: 0 }, issues: [], score: 0 },
        semantic: { type: 'semantic', scenes: [], duration: 0, summary: 'Analysis failed' },
        compliance: [],
      };
  }
}

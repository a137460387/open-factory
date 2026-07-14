import {
  buildFrameInterpolationCompareArgs,
  buildFrameInterpolationCompareFrameTimes,
  estimateFrameInterpolationModeDurationMs,
  FRAME_INTERPOLATION_COMPARE_MODES,
  frameInterpolationCompareModeToSlowMotionMode,
  normalizeFrameInterpolation,
  type Clip,
  type FfmpegExportPlan,
  type ExportPreviewSamplePlan,
  type FrameInterpolationCompareMode,
  type MediaAsset,
  type Project,
} from '@open-factory/editor-core';

interface FrameInterpolationComparePreviewItem {
  mode: FrameInterpolationCompareMode;
  label: string;
  outputPath: string;
  estimatedMs: number;
  sourceFrameTimes: number[];
  slowMotionMode: ReturnType<typeof frameInterpolationCompareModeToSlowMotionMode>;
}

export interface FrameInterpolationComparePreviewPlan {
  items: FrameInterpolationComparePreviewItem[];
  samples: ExportPreviewSamplePlan[];
}

export const FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS = 30_000;

export function buildFrameInterpolationComparePreviewPlan(
  project: Project,
  clip: Extract<Clip, { type: 'video' }>,
  asset: MediaAsset,
  playheadTime: number,
  outputDir: string,
  labels: Record<FrameInterpolationCompareMode, string>,
): FrameInterpolationComparePreviewPlan {
  if (!asset.path) {
    throw new Error('Missing media path for frame interpolation preview.');
  }
  const fps = Math.max(1, Math.round(project.settings.fps || 30));
  const frameInterpolation = normalizeFrameInterpolation(clip.frameInterpolation);
  const targetFps = Math.max(fps, frameInterpolation.targetFps || 60);
  const sourceFrameTimes = buildFrameInterpolationCompareFrameTimes(clip.start, clip.duration, playheadTime, fps);
  const sourceStart = Math.max(clip.trimStart, clip.trimStart + sourceFrameTimes[0] - clip.start);
  const frameWindowDuration = Math.max(5 / fps, 0.001);
  const outputWidth = Math.max(16, Math.round(project.settings.width || 1280));
  const outputHeight = Math.max(16, Math.round(project.settings.height || 720));
  const clipFrameCount = Math.max(1, Math.round(clip.duration * targetFps));

  const items = FRAME_INTERPOLATION_COMPARE_MODES.map((mode) => {
    const outputPath = `${outputDir.replace(/\/+$/, '')}/${safePathPart(clip.id)}-${mode}.png`;
    return {
      mode,
      label: labels[mode],
      outputPath,
      estimatedMs: estimateFrameInterpolationModeDurationMs(clipFrameCount, mode),
      sourceFrameTimes,
      slowMotionMode: frameInterpolationCompareModeToSlowMotionMode(mode),
    };
  });

  return {
    items,
    samples: items.map((item) => ({
      id: `frame-interpolation-${item.mode}`,
      kind: 'middle',
      label: item.label,
      time: sourceFrameTimes[2] ?? clip.start,
      outputPath: item.outputPath,
      plan: buildSingleClipPreviewPlan({
        mediaPath: asset.path,
        sourceStart,
        frameWindowDuration,
        outputPath: item.outputPath,
        width: outputWidth,
        height: outputHeight,
        targetFps,
        mode: item.mode,
      }),
    })),
  };
}

function buildSingleClipPreviewPlan({
  mediaPath,
  sourceStart,
  frameWindowDuration,
  outputPath,
  width,
  height,
  targetFps,
  mode,
}: {
  mediaPath: string;
  sourceStart: number;
  frameWindowDuration: number;
  outputPath: string;
  width: number;
  height: number;
  targetFps: number;
  mode: FrameInterpolationCompareMode;
}): FfmpegExportPlan {
  const normalizedOutput = normalizePath(outputPath);
  const inputPath = normalizePath(mediaPath);
  const filterChain = [
    `trim=start=${formatSeconds(sourceStart)}:duration=${formatSeconds(frameWindowDuration)}`,
    'setpts=PTS-STARTPTS',
    ...buildFrameInterpolationCompareArgs(mode, targetFps),
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    'format=rgba',
  ];
  const filterComplex = `[0:v]${filterChain.join(',')}[vout]`;
  const fullArgs = [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filterComplex,
    '-map',
    '[vout]',
    '-frames:v',
    '1',
    '-f',
    'image2',
    normalizedOutput,
  ];
  return {
    inputs: [{ index: 0, path: inputPath, args: ['-i', inputPath] }],
    filterComplex,
    maps: ['-map', '[vout]'],
    outputArgs: ['-frames:v', '1', '-f', 'image2', normalizedOutput],
    fullArgs,
    warnings: [],
    textArtifacts: [],
    nestedPlans: [],
    duration: frameWindowDuration,
  };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function safePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'clip';
}

function formatSeconds(value: number): string {
  return Math.max(0, Math.round(value * 1000) / 1000).toString();
}

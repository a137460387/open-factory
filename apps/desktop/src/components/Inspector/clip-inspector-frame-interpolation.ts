import {useEffect, useState} from 'react';
import type {Clip, MediaAsset, Project} from '@open-factory/editor-core';
import {normalizeFrameInterpolation, getClipSpeed, mapSsimToFrameInterpolationQualityGrade, normalizeSlowMotionMode, frameInterpolationCachePath, type ClipPatch, type FrameInterpolationCompareMode} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {evaluateExportQuality, convertLocalFileSrc, getAppDataDir, runExportPreviewSamples} from '../../lib/tauri-bridge';
import {buildFrameInterpolationComparePreviewPlan, FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS} from '../../lib/frameInterpolationComparePreview';
import {showToast} from '../../lib/toast';
import {joinLocalPath, type FrameInterpolationComparePreviewViewItem} from './InspectorEditors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFrameInterpolationStateParams {
  clip: Clip;
  asset: MediaAsset | undefined;
  project: Project;
  playheadTime: number;
  commit: (patch: ClipPatch) => void;
}

export interface UseFrameInterpolationStateReturn {
  frameInterpolationSupported: boolean | undefined;
  setFrameInterpolationSupported: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  frameInterpolationCompareRunning: boolean;
  setFrameInterpolationCompareRunning: React.Dispatch<React.SetStateAction<boolean>>;
  frameInterpolationCompareItems: FrameInterpolationComparePreviewViewItem[];
  setFrameInterpolationCompareItems: React.Dispatch<React.SetStateAction<FrameInterpolationComparePreviewViewItem[]>>;
  frameInterpolationCompareError: string | undefined;
  setFrameInterpolationCompareError: React.Dispatch<React.SetStateAction<string | undefined>>;
  frameInterpolationExpandedMode: FrameInterpolationCompareMode | undefined;
  setFrameInterpolationExpandedMode: React.Dispatch<React.SetStateAction<FrameInterpolationCompareMode | undefined>>;
  frameInterpolationQualityRunning: boolean;
  setFrameInterpolationQualityRunning: React.Dispatch<React.SetStateAction<boolean>>;
  frameInterpolationQualityError: string | undefined;
  setFrameInterpolationQualityError: React.Dispatch<React.SetStateAction<string | undefined>>;
  frameInterpolation: ReturnType<typeof normalizeFrameInterpolation>;
  frameInterpolationUnavailable: boolean;
  slowMotionMode: ReturnType<typeof normalizeSlowMotionMode>;
  frameInterpolationExpandedItem: FrameInterpolationComparePreviewViewItem | undefined;
  showSlowMotionMode: boolean;
  runFrameInterpolationComparePreview: () => Promise<void>;
  runFrameInterpolationQualityEvaluation: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFrameInterpolationState({
  clip,
  asset,
  project,
  playheadTime,
  commit,
}: UseFrameInterpolationStateParams): UseFrameInterpolationStateReturn {
  const [frameInterpolationSupported, setFrameInterpolationSupported] = useState<boolean | undefined>();
  const [frameInterpolationCompareRunning, setFrameInterpolationCompareRunning] = useState(false);
  const [frameInterpolationCompareItems, setFrameInterpolationCompareItems] = useState<
    FrameInterpolationComparePreviewViewItem[]
  >([]);
  const [frameInterpolationCompareError, setFrameInterpolationCompareError] = useState<string>();
  const [frameInterpolationExpandedMode, setFrameInterpolationExpandedMode] = useState<FrameInterpolationCompareMode>();
  const [frameInterpolationQualityRunning, setFrameInterpolationQualityRunning] = useState(false);
  const [frameInterpolationQualityError, setFrameInterpolationQualityError] = useState<string>();

  const frameInterpolation = normalizeFrameInterpolation(clip.frameInterpolation);
  const frameInterpolationUnavailable = frameInterpolationSupported === false;
  const slowMotionMode = normalizeSlowMotionMode(clip.slowMotionMode);
  const frameInterpolationExpandedItem = frameInterpolationCompareItems.find(
    (item) => item.mode === frameInterpolationExpandedMode,
  );
  const showSlowMotionMode = clip.type === 'video' && getClipSpeed(clip) < 1;

  useEffect(() => {
    setFrameInterpolationCompareItems([]);
    setFrameInterpolationCompareError(undefined);
    setFrameInterpolationQualityError(undefined);
    setFrameInterpolationExpandedMode(undefined);
  }, [clip.id]);

  const runFrameInterpolationComparePreview = async () => {
    if (clip.type !== 'video' || !asset) {
      setFrameInterpolationCompareError(zhCN.inspector.frameInterpolationCompare.missingMedia);
      return;
    }
    setFrameInterpolationCompareRunning(true);
    setFrameInterpolationCompareError(undefined);
    setFrameInterpolationExpandedMode(undefined);
    try {
      const outputDir = joinLocalPath(await getAppDataDir(), 'frame-interpolation-preview');
      const plan = buildFrameInterpolationComparePreviewPlan(
        project,
        clip,
        asset,
        playheadTime,
        outputDir,
        zhCN.inspector.frameInterpolationCompare.modes,
      );
      const result = await runExportPreviewSamples({
        samples: plan.samples,
        timeoutMs: FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS,
      });
      const resultById = new Map(result.samples.map((sample) => [sample.id, sample]));
      setFrameInterpolationCompareItems(
        plan.items.map((item) => {
          const sample = resultById.get(`frame-interpolation-${item.mode}`);
          const outputPath = sample?.path ?? item.outputPath;
          return {
            mode: item.mode,
            label: item.label,
            outputPath,
            src: convertLocalFileSrc(outputPath),
            estimatedMs: item.estimatedMs,
            slowMotionMode: item.slowMotionMode,
          };
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.inspector.frameInterpolationCompare.failedMessage;
      setFrameInterpolationCompareError(message);
      showToast({ kind: 'warning', title: zhCN.inspector.frameInterpolationCompare.failedTitle, message });
    } finally {
      setFrameInterpolationCompareRunning(false);
    }
  };

  const runFrameInterpolationQualityEvaluation = async () => {
    if (clip.type !== 'video' || !asset?.path) {
      setFrameInterpolationQualityError(zhCN.inspector.frameInterpolationCompare.missingMedia);
      return;
    }
    setFrameInterpolationQualityRunning(true);
    setFrameInterpolationQualityError(undefined);
    try {
      const appDataDir = await getAppDataDir();
      const outputDir = frameInterpolationCachePath(appDataDir, asset.path, frameInterpolation);
      const plan = buildFrameInterpolationComparePreviewPlan(
        project,
        clip,
        asset,
        playheadTime,
        outputDir,
        zhCN.inspector.frameInterpolationCompare.modes,
      );
      const preview = await runExportPreviewSamples({
        samples: plan.samples,
        timeoutMs: FRAME_INTERPOLATION_COMPARE_TIMEOUT_MS,
      });
      const samplesById = new Map(preview.samples.map((sample) => [sample.id, sample]));
      const selectedMode =
        frameInterpolation.mode === 'adaptive'
          ? 'mci'
          : frameInterpolation.mode === 'copy'
            ? 'original'
            : frameInterpolation.mode;
      const baseline = samplesById.get('frame-interpolation-blend') ?? samplesById.get('frame-interpolation-original');
      const candidate =
        samplesById.get(`frame-interpolation-${selectedMode}`) ??
        samplesById.get('frame-interpolation-mci') ??
        baseline;
      if (!baseline || !candidate) {
        throw new Error(zhCN.inspector.frameInterpolationCompare.failedMessage);
      }
      const result = await evaluateExportQuality({
        taskId: `frame-interpolation-quality-${clip.id}`,
        sourcePath: baseline.path,
        outputPath: candidate.path,
        duration: clip.duration,
      });
      const ssim = Number.isFinite(result.ssim) ? result.ssim! : 0;
      commit({
        frameInterpolation: {
          ...frameInterpolation,
          quality: {
            ssim,
            grade: mapSsimToFrameInterpolationQualityGrade(ssim),
            sampleCount: 10,
            evaluatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.inspector.frameInterpolationCompare.failedMessage;
      setFrameInterpolationQualityError(message);
      showToast({ kind: 'warning', title: zhCN.inspector.frameInterpolationCompare.qualityFailedTitle, message });
    } finally {
      setFrameInterpolationQualityRunning(false);
    }
  };

  return {
    frameInterpolationSupported,
    setFrameInterpolationSupported,
    frameInterpolationCompareRunning,
    setFrameInterpolationCompareRunning,
    frameInterpolationCompareItems,
    setFrameInterpolationCompareItems,
    frameInterpolationCompareError,
    setFrameInterpolationCompareError,
    frameInterpolationExpandedMode,
    setFrameInterpolationExpandedMode,
    frameInterpolationQualityRunning,
    setFrameInterpolationQualityRunning,
    frameInterpolationQualityError,
    setFrameInterpolationQualityError,
    frameInterpolation,
    frameInterpolationUnavailable,
    slowMotionMode,
    frameInterpolationExpandedItem,
    showSlowMotionMode,
    runFrameInterpolationComparePreview,
    runFrameInterpolationQualityEvaluation,
  };
}

import {useEffect, useState} from 'react';
import type {Clip, MediaAsset} from '@open-factory/editor-core';
import {normalizeMotionTrack, normalizeStabilization, type ClipPatch} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {analyzeClip, analyzeMotionTrack, cancelMotionTracking, listenBridge, type ClipAnalysisProgressEvent, type MotionTrackProgressEvent} from '../../lib/tauri-bridge';
import {bindMotionTrackToPositionKeyframes} from '@open-factory/editor-core';
import {showToast} from '../../lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseMotionAnalysisStateParams {
  clip: Clip;
  asset: MediaAsset | undefined;
  commit: (patch: ClipPatch) => void;
  stabilization: ReturnType<typeof normalizeStabilization>;
}

export interface UseMotionAnalysisStateReturn {
  analysisProgress: number | undefined;
  setAnalysisProgress: React.Dispatch<React.SetStateAction<number | undefined>>;
  motionTrackProgress: number | undefined;
  setMotionTrackProgress: React.Dispatch<React.SetStateAction<number | undefined>>;
  motionTrackingBusy: boolean;
  setMotionTrackingBusy: React.Dispatch<React.SetStateAction<boolean>>;
  motionTrack: NonNullable<ReturnType<typeof normalizeMotionTrack>>;
  runStabilizationAnalysis: () => Promise<void>;
  runMotionTrackAnalysis: () => Promise<void>;
  cancelMotionTrackAnalysis: () => Promise<void>;
  bindMotionTrackKeyframes: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMotionAnalysisState({
  clip,
  asset,
  commit,
  stabilization,
}: UseMotionAnalysisStateParams): UseMotionAnalysisStateReturn {
  const [analysisProgress, setAnalysisProgress] = useState<number | undefined>();
  const [motionTrackProgress, setMotionTrackProgress] = useState<number | undefined>();
  const [motionTrackingBusy, setMotionTrackingBusy] = useState(false);

  const motionTrack = normalizeMotionTrack(clip.motionTrack, clip.duration) ?? [];

  useEffect(() => {
    let disposed = false;
    let unlistenAnalysis: (() => void) | undefined;
    let unlistenMotionTrack: (() => void) | undefined;
    void listenBridge<ClipAnalysisProgressEvent>('clip-analysis-progress', (payload) => {
      if (payload.clipId === clip.id) setAnalysisProgress(payload.progress);
    }).then((dispose) => { if (disposed) dispose(); else unlistenAnalysis = dispose; });
    void listenBridge<MotionTrackProgressEvent>('motion-track-progress', (payload) => {
      if (payload.clipId === clip.id) setMotionTrackProgress(payload.progress);
    }).then((dispose) => { if (disposed) dispose(); else unlistenMotionTrack = dispose; });
    return () => { disposed = true; unlistenAnalysis?.(); unlistenMotionTrack?.(); };
  }, [clip.id]);

  const runStabilizationAnalysis = async () => {
    if (clip.type !== 'video' || !asset?.path) return;
    try {
      setAnalysisProgress(0);
      const result = await analyzeClip({ clipId: clip.id, mediaPath: asset.path, duration: clip.duration });
      commit({ stabilization: { ...stabilization, enabled: true, analyzed: true, trfPath: result.trfPath } });
      setAnalysisProgress(1);
    } catch (error) {
      setAnalysisProgress(undefined);
      showToast({kind: 'warning', title: zhCN.inspector.propertyRejectedTitle, message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage});
    }
  };

  const runMotionTrackAnalysis = async () => {
    if (clip.type !== 'video' || !asset?.path) return;
    try {
      setMotionTrackingBusy(true);
      setMotionTrackProgress(0);
      const result = await analyzeMotionTrack({ clipId: clip.id, mediaPath: asset.path, duration: clip.duration });
      const points = normalizeMotionTrack(result.points, clip.duration) ?? [];
      commit({ motionTrack: points });
      setMotionTrackProgress(1);
      if (points.length === 0) showToast({kind: 'warning', title: zhCN.inspector.motionTrack.failed, message: zhCN.inspector.motionTrack.noPoints});
    } catch (error) {
      showToast({kind: 'warning', title: zhCN.inspector.motionTrack.failed, message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage});
      setMotionTrackProgress(undefined);
    } finally { setMotionTrackingBusy(false); }
  };

  const cancelMotionTrackAnalysis = async () => {
    try { await cancelMotionTracking(clip.id); }
    catch (error) { showToast({kind: 'warning', title: zhCN.inspector.motionTrack.cancelFailed, message: error instanceof Error ? error.message : zhCN.inspector.motionTrack.failedMessage}); }
    finally { setMotionTrackingBusy(false); setMotionTrackProgress(undefined); }
  };

  const bindMotionTrackKeyframes = () => {
    const keyframes = bindMotionTrackToPositionKeyframes(clip.keyframes, motionTrack, clip.transform, clip.duration);
    if (keyframes) commit({ keyframes });
  };

  return {
    analysisProgress, setAnalysisProgress,
    motionTrackProgress, setMotionTrackProgress,
    motionTrackingBusy, setMotionTrackingBusy,
    motionTrack,
    runStabilizationAnalysis, runMotionTrackAnalysis, cancelMotionTrackAnalysis,
    bindMotionTrackKeyframes,
  };
}

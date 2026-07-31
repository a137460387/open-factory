import {useEffect, useState} from 'react';
import type {Clip, MediaAsset} from '@open-factory/editor-core';
import {normalizeAudioDenoise} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {listenBridge, type NoiseReductionProgressEvent} from '../../lib/tauri-bridge';
import {showToast} from '../../lib/toast';
import {logger} from '@open-factory/editor-core/utils';
import {markLocalAiModelUsed} from '../../settings/appSettings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseAudioDenoiseStateParams {
  clip: Clip;
  asset: MediaAsset | undefined;
  commit: (patch: import('@open-factory/editor-core').ClipPatch) => void;
}

export interface UseAudioDenoiseStateReturn {
  audioDenoiseSupported: boolean | undefined;
  setAudioDenoiseSupported: React.Dispatch<React.SetStateAction<boolean | undefined>>;
  aiLocalDenoiseProcessing: boolean;
  setAiLocalDenoiseProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  aiLocalDenoiseProgress: number;
  setAiLocalDenoiseProgress: React.Dispatch<React.SetStateAction<number>>;
  aiLocalDenoiseStage: string;
  setAiLocalDenoiseStage: React.Dispatch<React.SetStateAction<string>>;
  aiLocalDenoiseResult: { outputPath: string; noiseReductionDb: number } | null;
  setAiLocalDenoiseResult: React.Dispatch<
    React.SetStateAction<{ outputPath: string; noiseReductionDb: number } | null>
  >;
  audioDenoise: ReturnType<typeof normalizeAudioDenoise>;
  audioDenoiseUnavailable: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAudioDenoiseState({clip}: UseAudioDenoiseStateParams): UseAudioDenoiseStateReturn {
  const [audioDenoiseSupported, setAudioDenoiseSupported] = useState<boolean | undefined>();
  const [aiLocalDenoiseProcessing, setAiLocalDenoiseProcessing] = useState(false);
  const [aiLocalDenoiseProgress, setAiLocalDenoiseProgress] = useState(0);
  const [aiLocalDenoiseStage, setAiLocalDenoiseStage] = useState('');
  const [aiLocalDenoiseResult, setAiLocalDenoiseResult] = useState<{
    outputPath: string;
    noiseReductionDb: number;
  } | null>(null);

  const audioDenoise = normalizeAudioDenoise(clip.audioDenoise);
  const audioDenoiseUnavailable = audioDenoiseSupported === false;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenBridge<NoiseReductionProgressEvent>('noise-reduction-progress', (payload) => {
      if (payload.clipId === clip.id) {
        setAiLocalDenoiseProgress(payload.progress);
        setAiLocalDenoiseStage(payload.stage);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [clip.id]);

  return {
    audioDenoiseSupported,
    setAudioDenoiseSupported,
    aiLocalDenoiseProcessing,
    setAiLocalDenoiseProcessing,
    aiLocalDenoiseProgress,
    setAiLocalDenoiseProgress,
    aiLocalDenoiseStage,
    setAiLocalDenoiseStage,
    aiLocalDenoiseResult,
    setAiLocalDenoiseResult,
    audioDenoise,
    audioDenoiseUnavailable,
  };
}

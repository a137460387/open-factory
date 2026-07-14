import type { MediaAsset } from '@open-factory/editor-core';

export interface ASRState {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
}

interface ASRStageProps {
  media: MediaAsset[];
  onComplete: (trackId: string) => void;
  onCancel: () => void;
  asrState?: ASRState;
  onUpdate?: (patch: Partial<ASRState>) => void;
}

export function ASRStage(props: ASRStageProps) {
  return <div data-testid="asr-stage">ASR Stage (stub)</div>;
}

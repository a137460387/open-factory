import type { MediaAsset } from '@open-factory/editor-core';

interface ASRStageProps {
  media: MediaAsset[];
  onComplete: (trackId: string) => void;
  onCancel: () => void;
  asrState?: unknown;
  onUpdate?: (patch: Record<string, unknown>) => void;
}

export function ASRStage(props: ASRStageProps) {
  return <div data-testid="asr-stage">ASR Stage (stub)</div>;
}

import type { MediaAsset } from '@open-factory/editor-core';
import type { ASRState } from './useSubtitleWorkflow';

interface ASRStageProps {
  media: MediaAsset[];
  onComplete: (trackId: string) => void;
  onCancel: () => void;
  asrState?: ASRState;
  onUpdate?: (patch: Partial<ASRState>) => void;
  selectedClip?: { id: string; name: string };
}

export function ASRStage(props: ASRStageProps) {
  const clipName = props.selectedClip?.name;
  return (
    <div data-testid="subtitle-workflow-asr-stage">
      {clipName ? (
        <span>{clipName}</span>
      ) : (
        <span>请在时间线上选择一个音频或视频片段</span>
      )}
    </div>
  );
}

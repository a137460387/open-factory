import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import {
  batchComputeAdaptations,
  type TtsSegment,
} from '@open-factory/editor-core';

const TYPE_LABEL: Record<string, string> = {
  compress: zhCN.dubbingAdaptation.compress,
  pad: zhCN.dubbingAdaptation.pad,
  trim: zhCN.dubbingAdaptation.trim,
  none: zhCN.dubbingAdaptation.none,
};

export function DubbingAdaptationPanel() {
  const project = useEditorStore((s) => s.project);
  const ttsSegments = project?.ttsSegments ?? [];

  const handleAnalyze = () => {
    if (!project) return;
    const updated = batchComputeAdaptations(project.ttsSegments ?? [] as TtsSegment[]);
    useEditorStore.getState().setProject({ ...project, ttsSegments: updated });
  };

  return (
    <div data-testid="dubbing-adaptation-panel" className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{zhCN.dubbingAdaptation.title}</h3>
        <button
          data-testid="dubbing-analyze-btn"
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
          onClick={handleAnalyze}
        >
          {zhCN.dubbingAdaptation.analyzeAll}
        </button>
      </div>

      {ttsSegments.length === 0 ? (
        <p data-testid="dubbing-no-segments" className="text-xs text-gray-400">{zhCN.dubbingAdaptation.noSegments}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {ttsSegments.map((seg) => (
            <li
              key={seg.id}
              data-testid={`dubbing-segment-${seg.id}`}
              className="rounded border border-gray-700 p-2 text-xs"
            >
              <div className="flex justify-between">
                <span data-testid={`dubbing-delta-${seg.id}`}>
                  {zhCN.dubbingAdaptation.durationDelta}: {seg.timingAdaptation?.durationDelta.toFixed(2) ?? '—'}s
                </span>
                <span data-testid={`dubbing-type-${seg.id}`}>
                  {zhCN.dubbingAdaptation.adaptationType}: {seg.timingAdaptation ? TYPE_LABEL[seg.timingAdaptation.adaptationType] ?? seg.timingAdaptation.adaptationType : '—'}
                </span>
              </div>
              {seg.timingAdaptation?.atempoRatio != null && (
                <div data-testid={`dubbing-atempo-${seg.id}`}>
                  {zhCN.dubbingAdaptation.atempoRatio}: {seg.timingAdaptation.atempoRatio.toFixed(4)}
                </div>
              )}
              {seg.timingAdaptation?.suggestedOutPoint != null && (
                <div data-testid={`dubbing-outpoint-${seg.id}`}>
                  {zhCN.dubbingAdaptation.suggestedOutPoint}: {seg.timingAdaptation.suggestedOutPoint.toFixed(2)}s
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

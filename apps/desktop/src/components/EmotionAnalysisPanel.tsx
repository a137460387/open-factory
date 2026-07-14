import { useState, useMemo, useCallback } from 'react';
import { Palette, Sparkles, Info } from 'lucide-react';
import {
  analyzeSubtitleClipEmotions,
  suggestEmotionColor,
  batchApplyEmotionStyles,
  EMOTION_COLOR_MAP,
  EMOTION_ACCURACY_DISCLAIMER,
  type SubtitleEmotionScore,
  type SubtitleEmotionType,
} from '@open-factory/editor-core';
import type { SubtitleClip, SubtitleStyle } from '@open-factory/editor-core';
import { featureStrings } from '../i18n/featureStrings';

interface EmotionAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  subtitleClips: SubtitleClip[];
  onApplyStyles: (updates: Array<{ clipId: string; style: Partial<SubtitleStyle> }>) => void;
}

export function EmotionAnalysisPanel({ open, onClose, subtitleClips, onApplyStyles }: EmotionAnalysisPanelProps) {
  const [scores, setScores] = useState<SubtitleEmotionScore[]>([]);
  const [filterEmotion, setFilterEmotion] = useState<SubtitleEmotionType | null>(null);
  const t = featureStrings.subtitleEmotion;

  const handleDetect = useCallback(() => {
    const result = analyzeSubtitleClipEmotions(subtitleClips);
    setScores(result);
  }, [subtitleClips]);

  const handleBatchApply = useCallback(() => {
    const styled = batchApplyEmotionStyles(scores, filterEmotion ?? undefined);
    onApplyStyles(styled.map((s) => ({ clipId: s.clipId, style: s.partialStyle })));
  }, [scores, filterEmotion, onApplyStyles]);

  const emotionCounts = useMemo(() => {
    const counts: Record<SubtitleEmotionType, number> = { anger: 0, joy: 0, sadness: 0, surprise: 0, neutral: 0 };
    for (const s of scores) counts[s.emotion]++;
    return counts;
  }, [scores]);

  if (!open) return null;

  return (
    <div
      data-testid="emotion-analysis-panel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 w-[480px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <Palette size={16} /> {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 text-xs"
            data-testid="emotion-panel-close"
          >
            ✕
          </button>
        </div>

        {/* Disclaimer */}
        <div data-testid="emotion-disclaimer" className="text-xs text-neutral-500 flex items-center gap-1 mb-3">
          <Info size={12} /> {t.disclaimer}
        </div>

        {/* Detect button */}
        <button
          data-testid="emotion-detect"
          onClick={handleDetect}
          className="w-full bg-purple-700 hover:bg-purple-600 text-white rounded px-3 py-2 text-xs font-medium transition-colors mb-3 flex items-center justify-center gap-2"
        >
          <Sparkles size={14} /> {t.detect} ({subtitleClips.length} 条字幕)
        </button>

        {/* Emotion summary */}
        {scores.length > 0 && (
          <div data-testid="emotion-summary" className="grid grid-cols-5 gap-1 mb-3">
            {(Object.keys(EMOTION_COLOR_MAP) as SubtitleEmotionType[]).map((emotion) => {
              const suggestion = EMOTION_COLOR_MAP[emotion];
              return (
                <button
                  key={emotion}
                  data-testid={`emotion-filter-${emotion}`}
                  onClick={() => setFilterEmotion(filterEmotion === emotion ? null : emotion)}
                  className={`text-center p-1.5 rounded text-xs border transition-colors ${
                    filterEmotion === emotion ? 'border-blue-500 bg-blue-900/30' : 'border-neutral-700 bg-neutral-800'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: suggestion.color }} />
                  <div className="text-neutral-300">{t.emotions[emotion]}</div>
                  <div className="text-neutral-500">{emotionCounts[emotion]}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Per-clip results */}
        {scores.length > 0 && (
          <div data-testid="emotion-results" className="mb-3 space-y-1 max-h-[200px] overflow-auto">
            {scores
              .filter((s) => filterEmotion === null || s.emotion === filterEmotion)
              .map((score) => {
                const suggestion = suggestEmotionColor(score);
                return (
                  <div key={score.clipId} className="flex items-center gap-2 text-xs bg-neutral-800 rounded p-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: suggestion.color }} />
                    <span className="text-neutral-300 flex-1 truncate">{score.clipId}</span>
                    <span className="text-neutral-500">{t.emotions[score.emotion]}</span>
                    <span className="text-neutral-600">{Math.round(score.confidence * 100)}%</span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Batch apply */}
        {scores.length > 0 && (
          <button
            data-testid="emotion-batch-apply"
            onClick={handleBatchApply}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white rounded px-3 py-2 text-xs font-medium transition-colors"
          >
            {filterEmotion ? `${t.applyAll} (${t.emotions[filterEmotion]})` : t.applyAll}
          </button>
        )}
      </div>
    </div>
  );
}

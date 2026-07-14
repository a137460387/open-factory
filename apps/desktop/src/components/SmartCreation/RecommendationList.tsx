import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sparkles, Check } from 'lucide-react';
import { featureStrings } from '../../i18n/featureStrings';

/** Recommended clip from smart recommender. */
export interface RecommendedClip {
  clipId: string;
  score: number;
  similarityScore: number;
  emotionScore: number;
  diversityScore: number;
  reason: string;
}

interface RecommendationListProps {
  recommendations: RecommendedClip[];
  onSelect?: (clipId: string) => void;
  onApply?: (clipIds: string[]) => void;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function RecommendationList({ recommendations, onSelect, onApply }: RecommendationListProps) {
  const t = featureStrings.smartCreation;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: recommendations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  const handleApplyAll = useCallback(() => {
    onApply?.(recommendations.map((r) => r.clipId));
  }, [recommendations, onApply]);

  if (recommendations.length === 0) {
    return (
      <div data-testid="recommendation-list-empty" className="text-xs text-neutral-500 text-center py-6">
        {t.noRecommendations}
      </div>
    );
  }

  return (
    <div data-testid="recommendation-list" className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">{t.recommendationCount(recommendations.length)}</span>
        <button
          data-testid="recommendation-apply-all"
          onClick={handleApplyAll}
          className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded px-2 py-1 transition-colors flex items-center gap-1"
        >
          <Check size={12} /> {t.applyAll}
        </button>
      </div>

      <div ref={parentRef} data-testid="recommendation-list-scroll" className="max-h-[240px] overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const rec = recommendations[virtualItem.index];
            return (
              <div
                key={rec.clipId}
                data-testid={`recommendation-item-${virtualItem.index}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <button
                  onClick={() => onSelect?.(rec.clipId)}
                  className="w-full text-left bg-neutral-800 hover:bg-neutral-750 rounded p-2 transition-colors border border-transparent hover:border-neutral-600"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} className="text-purple-400" />
                      <span className="text-xs text-neutral-200 font-mono truncate max-w-[120px]">{rec.clipId}</span>
                    </div>
                    <span className="text-xs font-medium text-purple-300">{(rec.score * 100).toFixed(0)}%</span>
                  </div>

                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-500">{t.similarity}</span>
                      <ScoreBar value={rec.similarityScore} color="#3b82f6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-500">{t.emotion}</span>
                      <ScoreBar value={rec.emotionScore} color="#8b5cf6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-neutral-500">{t.diversity}</span>
                      <ScoreBar value={rec.diversityScore} color="#22c55e" />
                    </div>
                  </div>

                  <div className="text-[10px] text-neutral-500">{rec.reason}</div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

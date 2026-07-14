import { useState, useCallback } from 'react';
import { Wand2, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { MediaAsset, NarrativeGenerationResult } from '@open-factory/editor-core';
import {
  orchestrateSmartCreation,
  type SmartCreationProgress,
  type SmartCreationResult,
} from '@open-factory/editor-core';
import { featureStrings } from '../../i18n/featureStrings';
import { EmotionCurveChart } from './EmotionCurveChart';
import { SceneTimeline } from './SceneTimeline';
import { RecommendationList } from './RecommendationList';
import { NarrativeTimeline } from './NarrativeTimeline';

interface SmartCreationPanelProps {
  open: boolean;
  onClose: () => void;
  media: MediaAsset[];
  onApplyRecommendations?: (clipIds: string[]) => void;
  onApplyStoryline?: (storyline: NarrativeGenerationResult) => void;
}

type SectionKey = 'scenes' | 'emotions' | 'recommendations' | 'narrative';

const PHASE_LABELS: Record<SmartCreationProgress['phase'], string> = {
  scene_detection: '场景检测',
  emotion_analysis: '情绪分析',
  speech_understanding: '语音理解',
  narrative_analysis: '叙事分析',
  recommendation: '智能推荐',
  storyline: '故事线生成',
};

export function SmartCreationPanel({
  open,
  onClose,
  media,
  onApplyRecommendations,
  onApplyStoryline,
}: SmartCreationPanelProps) {
  const t = featureStrings.smartCreation;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<SmartCreationProgress | null>(null);
  const [result, setResult] = useState<SmartCreationResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['scenes', 'emotions', 'recommendations', 'narrative']),
  );

  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (media.length === 0) return;
    setIsAnalyzing(true);
    setProgress(null);
    setResult(null);

    try {
      const analysisResult = await orchestrateSmartCreation(media, {
        enableSpeechUnderstanding: true,
        onProgress: setProgress,
      });
      setResult(analysisResult);
    } catch {
      setProgress({ phase: 'scene_detection', progress: 0, message: t.analysisError });
    } finally {
      setIsAnalyzing(false);
    }
  }, [media, t]);

  const handleSelectRecommendation = useCallback((_clipId: string) => {
    // Future: highlight clip in timeline
  }, []);

  const handleApplyRecommendations = useCallback(
    (clipIds: string[]) => {
      onApplyRecommendations?.(clipIds);
    },
    [onApplyRecommendations],
  );

  const handleApplyStoryline = useCallback(() => {
    if (result?.storyline) {
      onApplyStoryline?.(result.storyline);
    }
  }, [result?.storyline, onApplyStoryline]);

  if (!open) return null;

  return (
    <div
      data-testid="smart-creation-panel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-lg w-[520px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
            <Wand2 size={16} className="text-purple-400" /> {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
            data-testid="smart-creation-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {/* Analyze button */}
          <button
            data-testid="smart-creation-analyze"
            onClick={handleAnalyze}
            disabled={isAnalyzing || media.length === 0}
            className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded px-3 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> {t.analyzing}
              </>
            ) : (
              <>
                <Wand2 size={14} /> {t.startAnalysis}
              </>
            )}
          </button>

          {/* Progress */}
          {progress && (
            <div data-testid="smart-creation-progress" className="space-y-1">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{PHASE_LABELS[progress.phase]}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="text-[10px] text-neutral-500">{progress.message}</div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div data-testid="smart-creation-results" className="space-y-2">
              {/* Scene Timeline Section */}
              <Section
                title={t.sections.scenes}
                expanded={expandedSections.has('scenes')}
                onToggle={() => toggleSection('scenes')}
                testId="section-scenes"
              >
                <SceneTimeline scenes={result.scenes.boundaries} />
              </Section>

              {/* Emotion Curve Section */}
              <Section
                title={t.sections.emotions}
                expanded={expandedSections.has('emotions')}
                onToggle={() => toggleSection('emotions')}
                testId="section-emotions"
              >
                <EmotionCurveChart curve={result.emotions.curve} />
              </Section>

              {/* Recommendations Section */}
              <Section
                title={t.sections.recommendations}
                expanded={expandedSections.has('recommendations')}
                onToggle={() => toggleSection('recommendations')}
                testId="section-recommendations"
              >
                <RecommendationList
                  recommendations={result.recommendations.clips}
                  onSelect={handleSelectRecommendation}
                  onApply={handleApplyRecommendations}
                />
              </Section>

              {/* Narrative Section */}
              <Section
                title={t.sections.narrative}
                expanded={expandedSections.has('narrative')}
                onToggle={() => toggleSection('narrative')}
                testId="section-narrative"
              >
                <NarrativeTimeline narrative={result.narrative} storyline={result.storyline} />
                {result.storyline && (
                  <button
                    data-testid="smart-creation-apply-storyline"
                    onClick={handleApplyStoryline}
                    className="w-full mt-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded px-3 py-2 text-xs font-medium transition-colors"
                  >
                    {t.applyStoryline}
                  </button>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────────

function Section({
  title,
  expanded,
  onToggle,
  testId,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testId} className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800/50 transition-colors"
        data-testid={`${testId}-toggle`}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

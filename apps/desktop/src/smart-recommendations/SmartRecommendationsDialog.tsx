import { ImageIcon, Plus, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildSmartSegmentRecommendations,
  buildSmartTimelineContext,
  secondsToTimecode,
  type Project,
  type SmartRecommendationReasonCode,
  type SmartSegmentRecommendation,
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';

interface SmartRecommendationsDialogProps {
  project: Project;
  onAddToTimeline(assetId: string): void;
  onClose(): void;
}

const MEDIA_CARD_DRAG_MIME = 'application/x-open-factory-media-id';

export default function SmartRecommendationsDialog({
  project,
  onAddToTimeline,
  onClose,
}: SmartRecommendationsDialogProps) {
  const t = zhCN.smartRecommendations;
  const context = useMemo(() => buildSmartTimelineContext(project), [project]);
  const recommendations = useMemo(() => buildSmartSegmentRecommendations(project), [project]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const selected = recommendations.find((item) => item.assetId === selectedAssetId) ?? recommendations[0];

  function addRecommendation(recommendation: SmartSegmentRecommendation): void {
    onAddToTimeline(recommendation.assetId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="smart-recommendations-dialog"
    >
      <section className="grid max-h-[88vh] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={18} className="text-brand" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
              <p className="text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="smart-recommendations-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div
          className="grid gap-2 border-b border-line bg-panel px-4 py-3 text-xs text-slate-600 sm:grid-cols-4"
          data-testid="smart-recommendations-context"
        >
          <SummaryCell label={t.gaps} value={String(context.gaps.length)} />
          <SummaryCell
            label={t.usedTypes}
            value={
              context.usedTypes.length > 0 ? context.usedTypes.map((type) => t.assetTypes[type]).join(' / ') : t.none
            }
          />
          <SummaryCell label={t.rhythm} value={t.cutsPerMinute(context.rhythmCutsPerMinute)} />
          <SummaryCell label={t.averageClipDuration} value={t.seconds(context.averageClipDuration)} />
        </div>

        <div className="grid min-h-0 gap-px bg-line md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-auto bg-white p-4">
            {recommendations.length === 0 ? (
              <div
                className="flex h-48 items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500"
                data-testid="smart-recommendations-empty"
              >
                {t.empty}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="smart-recommendation-list">
                {recommendations.map((recommendation) => (
                  <button
                    key={recommendation.id}
                    type="button"
                    draggable
                    className={`grid min-h-44 overflow-hidden rounded-md border text-left transition ${selected?.assetId === recommendation.assetId ? 'border-brand ring-2 ring-brand/20' : 'border-line hover:border-brand/60'}`}
                    data-testid="smart-recommendation-card"
                    data-asset-id={recommendation.assetId}
                    onClick={() => setSelectedAssetId(recommendation.assetId)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy';
                      event.dataTransfer.setData(MEDIA_CARD_DRAG_MIME, recommendation.assetId);
                    }}
                  >
                    <RecommendationPreview recommendation={recommendation} />
                    <div className="grid gap-2 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{recommendation.assetName}</div>
                        <div className="text-xs text-slate-500">
                          {t.assetSummary(t.assetTypes[recommendation.assetType], recommendation.duration)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.reasons.map((reason) => (
                          <span
                            key={reason.code}
                            className="rounded bg-panel px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {reasonLabel(reason.code)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{t.score}</span>
                        <span className="font-semibold tabular-nums text-ink">
                          {Math.round(recommendation.score * 100)}%
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="min-h-0 overflow-auto bg-white p-4" data-testid="smart-recommendation-preview">
            {selected ? (
              <div className="grid gap-3">
                <RecommendationPreview recommendation={selected} large />
                <div>
                  <h3 className="text-sm font-semibold text-ink">{selected.assetName}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.matchSummary(
                      Math.round(selected.colorSimilarity * 100),
                      Math.round(selected.durationScore * 100),
                    )}
                  </p>
                </div>
                {selected.gap ? (
                  <div
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
                    data-testid="smart-recommendation-gap"
                  >
                    <div className="font-semibold">{t.gapTitle}</div>
                    <div className="mt-1">{formatGap(selected, project)}</div>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white"
                  data-testid="smart-recommendation-add-button"
                  onClick={() => addRecommendation(selected)}
                >
                  <Plus size={15} />
                  {t.addToTimeline}
                </button>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500">
                {t.noPreview}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );

  function reasonLabel(code: SmartRecommendationReasonCode): string {
    return t.reasons[code];
  }
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-semibold text-ink">{value}</div>
    </div>
  );
}

function RecommendationPreview({
  recommendation,
  large = false,
}: {
  recommendation: SmartSegmentRecommendation;
  large?: boolean;
}) {
  const className = large
    ? 'aspect-video w-full overflow-hidden rounded-md border border-line bg-slate-100'
    : 'aspect-video w-full overflow-hidden bg-slate-100';
  if (recommendation.thumbnail) {
    return <img className={`${className} object-cover`} src={recommendation.thumbnail} alt="" loading="lazy" />;
  }
  return (
    <div className={`${className} grid place-items-center text-slate-400`}>
      <ImageIcon size={large ? 30 : 22} />
    </div>
  );
}

function formatGap(recommendation: SmartSegmentRecommendation, project: Project): string {
  if (!recommendation.gap) {
    return '';
  }
  const fps = project.settings.fps || 30;
  const format = project.settings.timecodeFormat ?? 'ndf';
  return `${recommendation.gap.trackName} · ${secondsToTimecode(recommendation.gap.start, fps, format)} - ${secondsToTimecode(recommendation.gap.end, fps, format)}`;
}

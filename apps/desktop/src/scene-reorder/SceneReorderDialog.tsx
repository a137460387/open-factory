import { Check, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  BatchReorderClipsCommand,
  buildSceneReorderStarts,
  createFallbackSceneClipFeatures,
  extractSceneClipFeatures,
  getStoryboardCards,
  orderSceneClipFeatures,
  type Clip,
  type MediaAsset,
  type Project,
  type SceneClipFeatures,
  type SceneReorderStrategy
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { convertLocalFileSrc } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';

interface SceneReorderDialogProps {
  project: Project;
  selectedClipIds: string[];
  onClose(): void;
}

const STRATEGIES: SceneReorderStrategy[] = ['brightness-asc', 'brightness-desc', 'color-similar', 'motion-rhythm', 'duration-balance'];
const SAMPLE_SIZE = 12;

export function SceneReorderDialog({ project, selectedClipIds, onClose }: SceneReorderDialogProps) {
  const t = zhCN.sceneReorder;
  const setSelectedClipIds = useEditorStore((state) => state.setSelectedClipIds);
  const [strategy, setStrategy] = useState<SceneReorderStrategy>('brightness-asc');
  const [features, setFeatures] = useState<SceneClipFeatures[]>([]);
  const [loading, setLoading] = useState(false);
  const mediaById = useMemo(() => new Map(project.media.map((asset) => [asset.id, asset])), [project.media]);
  const selectedIdSet = useMemo(() => new Set(selectedClipIds), [selectedClipIds]);
  const cards = useMemo(
    () => getStoryboardCards(project.timeline).filter((card) => selectedIdSet.has(card.clip.id)),
    [project.timeline, selectedIdSet]
  );
  const selectedVisualClipIds = useMemo(() => cards.map((card) => card.clip.id), [cards]);
  const orderedFeatures = useMemo(() => orderSceneClipFeatures(features, strategy), [features, strategy]);
  const orderedCards = useMemo(() => {
    const cardById = new Map(cards.map((card) => [card.clip.id, card]));
    return orderedFeatures.flatMap((feature) => {
      const card = cardById.get(feature.clipId);
      return card ? [card] : [];
    });
  }, [cards, orderedFeatures]);
  const orderChanged = orderedCards.map((card) => card.clip.id).join('\0') !== selectedVisualClipIds.join('\0');

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    void Promise.all(
      cards.map(async ({ clip }) => {
        const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
        return analyzeSceneClipFeature(clip, asset);
      })
    )
      .then((nextFeatures) => {
        if (!canceled) {
          setFeatures(nextFeatures);
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [cards, mediaById]);

  function applyReorder(): void {
    if (orderedCards.length < 2) {
      showToast({ kind: 'info', title: t.unavailableTitle, message: t.unavailableMessage });
      return;
    }
    const orderedIds = orderedCards.map((card) => card.clip.id);
    const starts = buildSceneReorderStarts(project.timeline, selectedVisualClipIds, orderedIds);
    try {
      commandManager.execute(new BatchReorderClipsCommand(timelineAccessor, starts));
      setSelectedClipIds(orderedIds);
      showToast({ kind: 'success', title: t.appliedTitle, message: t.appliedMessage(orderedIds.length) });
      onClose();
    } catch (error) {
      showToast({ kind: 'warning', title: t.failedTitle, message: error instanceof Error ? error.message : t.failedMessage });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="scene-reorder-dialog">
      <section className="grid max-h-[88vh] w-full max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-slate-600 hover:bg-panel"
            title={zhCN.common.close}
            aria-label={zhCN.common.close}
            data-testid="scene-reorder-close-button"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-3 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <span>{t.strategy}</span>
            <select
              className="h-8 rounded-md border border-line bg-white px-2 text-xs text-slate-700"
              value={strategy}
              data-testid="scene-reorder-strategy-select"
              onChange={(event) => setStrategy(event.target.value as SceneReorderStrategy)}
            >
              {STRATEGIES.map((item) => (
                <option key={item} value={item}>
                  {t.strategies[item]}
                </option>
              ))}
            </select>
          </label>
          <span data-testid="scene-reorder-selected-count">{t.selectedCount(cards.length)}</span>
          {loading ? (
            <span className="inline-flex items-center gap-1 text-slate-500" data-testid="scene-reorder-loading">
              <Loader2 size={13} className="animate-spin" />
              {t.analyzing}
            </span>
          ) : (
            <span className="text-slate-500" data-testid="scene-reorder-analysis-summary">
              {t.analysisSummary(features.filter((feature) => feature.analyzed).length, features.length)}
            </span>
          )}
        </div>
        <div className="min-h-0 overflow-auto p-4">
          {orderedCards.length < 2 ? (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500" data-testid="scene-reorder-empty">
              {t.empty}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3" data-testid="scene-reorder-preview">
              {orderedCards.map(({ clip }, index) => {
                const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
                const feature = orderedFeatures.find((item) => item.clipId === clip.id);
                return <SceneReorderCard key={clip.id} index={index + 1} clip={clip} asset={asset} feature={feature} />;
              })}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="text-xs text-slate-500" data-testid="scene-reorder-order-state">
            {orderChanged ? t.orderChanged : t.orderUnchanged}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="h-9 rounded-md border border-line px-3 text-sm text-slate-700 hover:bg-panel" data-testid="scene-reorder-cancel-button" onClick={onClose}>
              {zhCN.common.cancel}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={orderedCards.length < 2 || loading}
              data-testid="scene-reorder-apply-button"
              onClick={applyReorder}
            >
              <Check size={15} />
              {t.apply}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function SceneReorderCard({ index, clip, asset, feature }: { index: number; clip: Clip; asset?: MediaAsset; feature?: SceneClipFeatures }) {
  const t = zhCN.sceneReorder;
  const src = resolvePreviewSrc(asset);
  return (
    <article className="overflow-hidden rounded-md border border-line bg-white shadow-sm" data-testid={`scene-reorder-card-${clip.id}`}>
      {src ? (
        <img className="aspect-video w-full bg-slate-100 object-cover" src={src} alt={clip.name} draggable={false} />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-500">{clip.type === 'image' ? zhCN.storyboard.image : zhCN.storyboard.video}</div>
      )}
      <div className="space-y-1 p-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-[11px] font-semibold text-white">{index}</span>
          <span className="min-w-0 truncate text-xs font-semibold text-ink" data-testid={`scene-reorder-card-name-${clip.id}`}>
            {clip.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-slate-500">
          <span>{zhCN.storyboard.duration(clip.duration)}</span>
          <span>{t.featureSummary(feature?.brightness ?? 0, feature?.motion ?? 0)}</span>
        </div>
      </div>
    </article>
  );
}

async function analyzeSceneClipFeature(clip: Clip, asset?: MediaAsset): Promise<SceneClipFeatures> {
  const fallback = createFallbackSceneClipFeatures({
    clipId: clip.id,
    duration: clip.duration,
    brightness: clamp01(0.5 + (clip.colorCorrection?.brightness ?? 0) / 2),
    motion: estimateClipMotion(clip),
    color: fallbackColorFromAsset(asset)
  });
  const src = resolvePreviewSrc(asset);
  if (!src) {
    return fallback;
  }
  try {
    const pixels = await loadImageSamplePixels(src);
    return extractSceneClipFeatures({
      clipId: clip.id,
      duration: clip.duration,
      frames: [{ pixels, motionFromPrevious: fallback.motion }]
    });
  } catch {
    return fallback;
  }
}

function resolvePreviewSrc(asset?: MediaAsset): string | undefined {
  const source = asset?.thumbnail || (asset?.type === 'image' ? asset.path : undefined);
  if (!source) {
    return undefined;
  }
  if (/^(data:|blob:|https?:|asset:)/i.test(source)) {
    return source;
  }
  return convertLocalFileSrc(source);
}

function loadImageSamplePixels(src: string): Promise<Array<readonly [number, number, number]>> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const data = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
        const pixels: Array<readonly [number, number, number]> = [];
        for (let index = 0; index < data.length; index += 4) {
          pixels.push([data[index], data[index + 1], data[index + 2]]);
        }
        resolve(pixels);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = src;
  });
}

function fallbackColorFromAsset(asset?: MediaAsset): readonly [number, number, number] {
  if (!asset) {
    return [128, 128, 128];
  }
  const seed = Array.from(asset.name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [(seed * 53) % 256, (seed * 97) % 256, (seed * 193) % 256];
}

function estimateClipMotion(clip: Clip): number {
  const points = clip.motionTrack ?? [];
  if (points.length === 0) {
    return 0;
  }
  const total = points.reduce((sum, point) => sum + Math.hypot(point.dx, point.dy), 0);
  return clamp01(total / points.length);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

import { useState, useCallback, useRef } from 'react';
import type { MediaAsset, Clip } from '@open-factory/editor-core';
import {
  buildDirectorModeMediaInfo,
  splitDirectorModeMediaBatches,
  buildDirectorModeSystemPrompt,
  buildDirectorModeUserPrompt,
  parseDirectorModeResponse,
  validateDirectorModeTotalDuration,
  buildDirectorModeStoryboardCards,
  isProviderConfigured,
  createId,
  createBaseClip,
  BatchAddClipsCommand,
  BatchAddMarkersCommand,
  AddTrackCommand,
  type DirectorModeStyle,
  type DirectorModeStoryboardCard
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useAISettingsStore } from '../../store/aiSettingsStore';
import { callAiApi, readAiApiKey } from '../../lib/tauri-bridge';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';

const t = zhCN.directorMode;

type Phase = 'wizard' | 'generating' | 'preview' | 'done';
type WizardStep = 1 | 2 | 3;

const DURATION_OPTIONS = [30, 60, 90, 120] as const;
const STYLE_OPTIONS: { value: DirectorModeStyle; label: string }[] = [
  { value: 'energetic', label: t.styleEnergetic },
  { value: 'calm', label: t.styleCalm },
  { value: 'documentary', label: t.styleDocumentary },
  { value: 'social-short', label: t.styleSocialShort }
];

export function DirectorModePanel({
  media,
  favoriteIds,
  onClose
}: {
  media: MediaAsset[];
  favoriteIds: string[];
  onClose: () => void;
}) {
  const providers = useAISettingsStore((s) => s.providers);
  const textProviders = providers.filter((p) => p.enabled && isProviderConfigured(p));
  const [selectedProviderId, setSelectedProviderId] = useState(textProviders[0]?.id ?? '');
  const selectedProvider = textProviders.find((p) => p.id === selectedProviderId) ?? textProviders[0];

  const [phase, setPhase] = useState<Phase>('wizard');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Step 1
  const [description, setDescription] = useState('');
  const [targetDuration, setTargetDuration] = useState(90);
  const [customDuration, setCustomDuration] = useState('');
  const [style, setStyle] = useState<DirectorModeStyle>('energetic');

  // Step 2
  const [mediaSource, setMediaSource] = useState<'all' | 'favorites' | 'folder' | 'manual'>('all');

  // Step 3
  const [addMarkers, setAddMarkers] = useState(true);
  const [addMusicTrack, setAddMusicTrack] = useState(false);
  const [outputTarget, setOutputTarget] = useState<'main' | 'new'>('new');

  const [storyboard, setStoryboard] = useState<DirectorModeStoryboardCard[]>([]);
  const [planResult, setPlanResult] = useState<ReturnType<typeof parseDirectorModeResponse> | null>(null);
  const abortRef = useRef(false);

  const effectiveDuration = targetDuration === -1 ? (Number(customDuration) || 90) : targetDuration;

  const filteredMedia = mediaSource === 'all' ? media :
    mediaSource === 'favorites' ? media.filter((m) => favoriteIds.includes(m.id)) :
    media;

  const handleNext = useCallback(() => {
    if (wizardStep < 3) setWizardStep((s) => (s + 1) as WizardStep);
  }, [wizardStep]);

  const handlePrev = useCallback(() => {
    if (wizardStep > 1) setWizardStep((s) => (s - 1) as WizardStep);
  }, [wizardStep]);

  const startGeneration = useCallback(async () => {
    if (!description.trim() || !selectedProvider || filteredMedia.length === 0) return;
    abortRef.current = false;

    try {
      setPhase('generating');
      const apiKey = await readAiApiKey(selectedProvider.id);
      if (abortRef.current) { setPhase('wizard'); return; }

      const mediaInfo = buildDirectorModeMediaInfo(filteredMedia);
      const batches = splitDirectorModeMediaBatches(mediaInfo);
      const batchMedia = batches[0] ?? mediaInfo;

      const systemPrompt = buildDirectorModeSystemPrompt(style, addMarkers, addMusicTrack);
      const userPrompt = buildDirectorModeUserPrompt(description, effectiveDuration, batchMedia);

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt }
      ];

      const response = await callAiApi(
        {
          providerId: selectedProvider.id,
          baseUrl: selectedProvider.baseUrl,
          model: selectedProvider.defaultModel,
          messages,
          customHeaders: selectedProvider.customHeaders,
          maxTokens: 4096,
          temperature: 0.3
        },
        apiKey
      );
      if (abortRef.current) { setPhase('wizard'); return; }

      const parsed = parseDirectorModeResponse(JSON.parse(response.content));
      if (parsed.segments.length === 0) {
        showToast({ kind: 'info', title: t.storyboardEmpty });
        setPhase('wizard');
        return;
      }

      if (!validateDirectorModeTotalDuration(parsed.segments, effectiveDuration)) {
        showToast({ kind: 'warning', title: 'AI返回的片段总时长超出目标时长' });
      }

      const mediaById = new Map(filteredMedia.map((m) => [m.id, { name: m.name }]));
      const cards = buildDirectorModeStoryboardCards(parsed, mediaById);
      setStoryboard(cards);
      setPlanResult(parsed);
      setPhase('preview');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
      setPhase('wizard');
    }
  }, [selectedProvider, filteredMedia, description, effectiveDuration, style, addMarkers, addMusicTrack]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setPhase('wizard');
  }, []);

  const toggleDelete = useCallback((index: number) => {
    setStoryboard((prev) =>
      prev.map((item, i) => (i === index ? { ...item, deleted: !item.deleted } : item))
    );
  }, []);

  const moveCard = useCallback((index: number, direction: -1 | 1) => {
    setStoryboard((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const confirmCreate = useCallback(() => {
    const activeCards = storyboard.filter((s) => !s.deleted);
    if (activeCards.length === 0) { setPhase('wizard'); return; }

    try {
      const trackId = createId();
      const mediaMap = new Map(filteredMedia.map((m) => [m.id, m]));
      let cursor = 0;

      const clips: Clip[] = activeCards.map((card, index) => {
        const asset = mediaMap.get(card.mediaId);
        if (!asset) throw new Error(`Media not found: ${card.mediaId}`);
        const clipDuration = Math.min(card.duration, asset.duration);
        const base = createBaseClip({
          id: createId(),
          name: `${asset.name} - ${card.reason || `片段${index + 1}`}`,
          trackId,
          start: cursor,
          duration: clipDuration,
          trimStart: Math.min(card.trimStart, Math.max(0, asset.duration - clipDuration)),
          trimEnd: Math.max(0, asset.duration - Math.min(card.trimStart, Math.max(0, asset.duration - clipDuration)) - clipDuration)
        });
        cursor += clipDuration;
        if (asset.type === 'video') return { ...base, type: 'video' as const, mediaId: asset.id, volume: 1 };
        if (asset.type === 'image') return { ...base, type: 'image' as const, mediaId: asset.id };
        return { ...base, type: 'audio' as const, mediaId: asset.id, volume: 1 };
      });

      const trackType = clips.some((c) => c.type === 'video' || c.type === 'image') ? 'video' as const : 'audio' as const;
      commandManager.execute(new BatchAddClipsCommand(timelineAccessor, clips, [{ id: trackId, name: 'AI导演', type: trackType }]));

      if (planResult && planResult.markers.length > 0) {
        commandManager.execute(new BatchAddMarkersCommand(timelineAccessor, planResult.markers));
      }

      if (addMusicTrack) {
        const musicTrackId = createId();
        commandManager.execute(new AddTrackCommand(timelineAccessor, {
          id: musicTrackId,
          type: 'audio',
          name: '背景音乐（待添加）',
          clips: [],
          muted: false,
          solo: false,
          locked: false,
          volume: 1,
          height: 60
        } as never));
      }

      showToast({ kind: 'success', title: t.applied, message: t.appliedMessage(activeCards.length) });
      setPhase('done');
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.failedTitle,
        message: error instanceof Error ? error.message : t.failedMessage
      });
    }
  }, [storyboard, filteredMedia, planResult, addMusicTrack]);

  if (media.length === 0) {
    return (
      <div className="flex flex-col h-full" data-testid="director-mode-panel">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
          <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="director-mode-close">{zhCN.common.close}</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-xs text-slate-500">{t.noMedia}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="director-mode-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-panel" type="button" onClick={onClose} data-testid="director-mode-close">{zhCN.common.close}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {phase === 'wizard' && (
          <>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t.selectProvider}</label>
              <select className="w-full rounded-md border border-line bg-white px-2 py-1 text-sm" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)} disabled={textProviders.length === 0} data-testid="director-mode-provider">
                {textProviders.length === 0 && <option value="">{t.noProvider}</option>}
                {textProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex gap-1 text-xs">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`flex-1 text-center py-1 rounded ${wizardStep === s ? 'bg-blue-600 text-white' : wizardStep > s ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`} data-testid={`director-mode-step-${s}`}>
                  {s === 1 ? t.step1Title : s === 2 ? t.step2Title : t.step3Title}
                </div>
              ))}
            </div>

            {wizardStep === 1 && (
              <div className="space-y-2">
                <textarea className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm resize-none" rows={3} placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="director-mode-description" />
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.targetDuration}</label>
                  <div className="flex gap-1 flex-wrap">
                    {DURATION_OPTIONS.map((d) => (
                      <button key={d} className={`rounded-md px-2 py-1 text-xs font-medium ${targetDuration === d ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`} type="button" onClick={() => setTargetDuration(d)} data-testid={`director-mode-duration-${d}`}>{d}s</button>
                    ))}
                    <button className={`rounded-md px-2 py-1 text-xs font-medium ${targetDuration === -1 ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`} type="button" onClick={() => setTargetDuration(-1)} data-testid="director-mode-duration-custom">{t.customDuration}</button>
                  </div>
                  {targetDuration === -1 && <input type="number" className="mt-1 w-24 rounded-md border border-line bg-white px-2 py-1 text-xs" min={5} max={600} value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} data-testid="director-mode-custom-duration" />}
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.style}</label>
                  <div className="flex gap-1 flex-wrap">
                    {STYLE_OPTIONS.map((opt) => (
                      <button key={opt.value} className={`rounded-md px-2 py-1 text-xs font-medium ${style === opt.value ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`} type="button" onClick={() => setStyle(opt.value)} data-testid={`director-mode-style-${opt.value}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-600 mb-1">{t.mediaSource}</label>
                {(['all', 'favorites'] as const).map((src) => (
                  <label key={src} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="radio" name="mediaSource" checked={mediaSource === src} onChange={() => setMediaSource(src)} data-testid={`director-mode-source-${src}`} />
                    {src === 'all' ? t.mediaSourceAll : t.mediaSourceFavorites}
                  </label>
                ))}
                <div className="text-xs text-slate-500">{t.mediaCount(filteredMedia.length)}</div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={addMarkers} onChange={(e) => setAddMarkers(e.target.checked)} data-testid="director-mode-add-markers" />
                  {t.addMarkers}
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={addMusicTrack} onChange={(e) => setAddMusicTrack(e.target.checked)} data-testid="director-mode-add-music" />
                  {t.addMusicTrack}
                </label>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{t.outputTarget}</label>
                  <div className="flex gap-1">
                    <button className={`rounded-md px-2 py-1 text-xs font-medium ${outputTarget === 'main' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`} type="button" onClick={() => setOutputTarget('main')} data-testid="director-mode-output-main">{t.outputMainSequence}</button>
                    <button className={`rounded-md px-2 py-1 text-xs font-medium ${outputTarget === 'new' ? 'bg-blue-600 text-white' : 'bg-white border border-line text-slate-700 hover:bg-panel'}`} type="button" onClick={() => setOutputTarget('new')} data-testid="director-mode-output-new">{t.outputNewSequence}</button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {wizardStep > 1 && (
                <button className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={handlePrev} data-testid="director-mode-prev">{t.prev}</button>
              )}
              {wizardStep < 3 ? (
                <button className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" type="button" disabled={wizardStep === 1 && !description.trim()} onClick={handleNext} data-testid="director-mode-next">{t.next}</button>
              ) : (
                <button className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" type="button" disabled={!selectedProvider || !description.trim()} onClick={() => void startGeneration()} data-testid="director-mode-generate">{t.startGenerate}</button>
              )}
            </div>
          </>
        )}

        {phase === 'generating' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600" data-testid="director-mode-generating">{t.generating}</div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} /></div>
            <button className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={cancelGeneration} data-testid="director-mode-cancel">{t.cancel}</button>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-2" data-testid="director-mode-storyboard">
            <div className="text-xs font-semibold text-slate-700">
              {t.storyboard} — {t.clipCount(storyboard.filter((s) => !s.deleted).length)} · {t.totalDuration(storyboard.filter((s) => !s.deleted).reduce((sum, s) => sum + s.duration, 0))}
            </div>
            <div className="text-[11px] text-slate-400">{t.reorderHint}</div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {storyboard.map((card, index) => (
                <div key={`${card.mediaId}-${index}`} className={`flex items-start gap-2 rounded-md border p-2 text-xs ${card.deleted ? 'border-red-200 bg-red-50 opacity-50' : 'border-line bg-white'}`} data-testid={`director-mode-card-${index}`}>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-panel disabled:opacity-30" type="button" disabled={index === 0} onClick={() => moveCard(index, -1)} data-testid={`director-mode-up-${index}`}>▲</button>
                    <button className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-panel disabled:opacity-30" type="button" disabled={index === storyboard.length - 1} onClick={() => moveCard(index, 1)} data-testid={`director-mode-down-${index}`}>▼</button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 truncate">{card.mediaName}</div>
                    <div className="text-slate-500">{card.duration.toFixed(1)}s</div>
                    {card.reason && <div className="mt-0.5 text-slate-400 line-clamp-2">{card.reason}</div>}
                  </div>
                  <button className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50" type="button" onClick={() => toggleDelete(index)} data-testid={`director-mode-delete-${index}`}>{card.deleted ? zhCN.common.reset : t.deleteClip}</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 rounded-md border border-line bg-white px-2 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={() => setPhase('wizard')} data-testid="director-mode-back">{zhCN.common.back}</button>
              <button className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700" type="button" onClick={confirmCreate} data-testid="director-mode-confirm">{t.confirmCreate}</button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-8" data-testid="director-mode-done">
            <div className="text-sm text-green-700 font-medium">{t.applied}</div>
            <button className="mt-4 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={onClose} data-testid="director-mode-done-close">{zhCN.common.close}</button>
          </div>
        )}
      </div>
    </div>
  );
}

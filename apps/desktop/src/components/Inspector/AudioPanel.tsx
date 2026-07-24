import React from 'react';
import {
  type AudioFadeCurve,
  type AudioChannelRoutingMode,
  type SpatialAudioRenderMode,
  type SpatialAudioDistance,
  type SpatialAudioRoomModel,
} from '@open-factory/editor-core';
import { Loader2, Sparkles } from 'lucide-react';
import { t, zhCN } from '../../i18n/strings';
import { cancelAudioNoiseReduction, processAudioNoiseReduction } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import {
  Section,
  RangeField,
  RangeNumberField,
  ToggleField,
  AnimatedField,
} from './InspectorFields';
import { AudioRestorationWaveformPreview } from './InspectorEditors';
import type { ClipInspectorBodyProps } from './ClipInspectorBody';

export function AudioPanel({
  clip,
  selectedClipLocked,
  asset,
  audioDenoise,
  audioDenoiseUnavailable,
  aiLocalDenoiseProcessing,
  setAiLocalDenoiseProcessing,
  aiLocalDenoiseProgress,
  setAiLocalDenoiseProgress,
  aiLocalDenoiseStage,
  setAiLocalDenoiseStage,
  aiLocalDenoiseResult,
  setAiLocalDenoiseResult,
  audioPitchSemitones,
  reverseAudio,
  fadeInDuration,
  fadeOutDuration,
  fadeInCurve,
  fadeOutCurve,
  spatialAudio,
  spatialRenderModeOptions,
  spatialDistanceOptions,
  spatialRoomOptions,
  audioChannelRouting,
  audioChannelRoutingOptions,
  audioRestoration,
  audioRestorationComparison,
  pitchSummary,
  pitchAnalyzing,
  commit,
  addKeyframe,
  updateAudioRestoration,
  runPitchAnalysis,
  exportPitchCsv,
}: ClipInspectorBodyProps) {
  return (
    <>
      {/* Audio Denoise */}
      {(clip.type === 'video' || clip.type === 'audio') ? (
        <Section title={zhCN.inspector.sections.audioDenoise}>
          <ToggleField label={zhCN.inspector.fields.enabled} checked={audioDenoise.enabled} disabled={audioDenoiseUnavailable} onCommit={(enabled) => commit({ audioDenoise: { ...audioDenoise, enabled } })} testId="audio-denoise-toggle" />
          <RangeNumberField label={zhCN.inspector.fields.strength} value={audioDenoise.strength} min={0} max={1} step={0.05} format={(value) => `${Math.round(value * 100)}%`} disabled={audioDenoiseUnavailable || !audioDenoise.enabled} onCommit={(strength) => commit({ audioDenoise: { ...audioDenoise, strength } })} testId="audio-denoise-strength" />
          {audioDenoiseUnavailable ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="audio-denoise-unavailable">{zhCN.inspector.fields.audioDenoiseUnsupported}</div>
          ) : null}
        </Section>
      ) : null}

      {/* AI Local Denoise */}
      {(clip.type === 'video' || clip.type === 'audio') ? (
        <Section title={zhCN.inspector.sections.aiLocalDenoise}>
          <ToggleField label={zhCN.inspector.fields.enabled} checked={clip.aiLocalDenoise?.enabled ?? false} onCommit={(enabled) => commit({ aiLocalDenoise: { ...(clip.aiLocalDenoise ?? { strength: 0.5 }), enabled } })} testId="ai-local-denoise-toggle" />
          <RangeNumberField label={zhCN.inspector.fields.strength} value={clip.aiLocalDenoise?.strength ?? 0.5} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} disabled={!clip.aiLocalDenoise?.enabled} onCommit={(strength) => commit({ aiLocalDenoise: { ...(clip.aiLocalDenoise ?? { enabled: false }), strength } })} testId="ai-local-denoise-strength" />
          <AiLocalDenoiseControls
            clipId={clip.id} assetPath={asset?.path} aiLocalDenoise={clip.aiLocalDenoise}
            aiLocalDenoiseProcessing={aiLocalDenoiseProcessing} setAiLocalDenoiseProcessing={setAiLocalDenoiseProcessing}
            aiLocalDenoiseProgress={aiLocalDenoiseProgress} setAiLocalDenoiseProgress={setAiLocalDenoiseProgress}
            aiLocalDenoiseStage={aiLocalDenoiseStage} setAiLocalDenoiseStage={setAiLocalDenoiseStage}
            aiLocalDenoiseResult={aiLocalDenoiseResult} setAiLocalDenoiseResult={setAiLocalDenoiseResult}
            commit={commit}
          />
        </Section>
      ) : null}

      {/* Audio Volume & Pitch */}
      {'volume' in clip ? (
        <Section title={zhCN.inspector.sections.audio}>
          <AnimatedField label={zhCN.inspector.fields.volume} onAddKeyframe={() => addKeyframe('volume')} testId="add-volume-keyframe-button">
            <RangeField label={zhCN.inspector.fields.volume} value={clip.volume} min={0} max={2} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(volume) => commit({ volume })} hideLabel testId="clip-volume-input" />
          </AnimatedField>
          <RangeNumberField label={zhCN.inspector.fields.pitchShift} value={audioPitchSemitones} min={-12} max={12} step={1} format={(value) => `${value > 0 ? '+' : ''}${Math.round(value)} ${zhCN.inspector.fields.semitones}`} onCommit={(pitchSemitones) => commit({ pitchSemitones })} testId="clip-pitch-input" />
          <ToggleField label={zhCN.inspector.fields.reverseAudio} checked={reverseAudio} onCommit={(nextReverseAudio) => commit({ reverseAudio: nextReverseAudio })} testId="clip-reverse-audio-toggle" />

          {/* Audio Restoration */}
          <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="audio-advanced-restoration-section" open>
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t('inspector.sections.audioRestoration')}</summary>
            <div className="space-y-3 border-t border-line p-2">
              <ToggleField label={t('inspector.fields.audioRestorationDeclip')} checked={audioRestoration.declip.enabled} onCommit={(enabled) => updateAudioRestoration({ declip: { ...audioRestoration.declip, enabled } })} testId="audio-restoration-declip-toggle" />
              <ToggleField label={t('inspector.fields.audioRestorationDereverb')} checked={audioRestoration.dereverb.enabled} onCommit={(enabled) => updateAudioRestoration({ dereverb: { ...audioRestoration.dereverb, enabled } })} testId="audio-restoration-dereverb-toggle" />
              <RangeNumberField label={t('inspector.fields.strength')} value={audioRestoration.dereverb.strength} min={0} max={1} step={0.05} format={(value) => `${Math.round(value * 100)}%`} disabled={!audioRestoration.dereverb.enabled} onCommit={(strength) => updateAudioRestoration({ dereverb: { ...audioRestoration.dereverb, strength } })} testId="audio-restoration-dereverb-strength" />
              <ToggleField label={t('inspector.fields.audioRestorationDewind')} checked={audioRestoration.dewind.enabled} onCommit={(enabled) => updateAudioRestoration({ dewind: { ...audioRestoration.dewind, enabled } })} testId="audio-restoration-dewind-toggle" />
              <ToggleField label={t('inspector.fields.audioRestorationFill')} checked={audioRestoration.fill.enabled} onCommit={(enabled) => updateAudioRestoration({ fill: { ...audioRestoration.fill, enabled } })} testId="audio-restoration-fill-toggle" />
              <AudioRestorationWaveformPreview before={audioRestorationComparison.before} after={audioRestorationComparison.after} />
            </div>
          </details>

          {/* Audio Channel Routing */}
          <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="audio-channel-routing-section" open>
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.fields.audioChannelRouting}</summary>
            <div className="border-t border-line p-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.audioChannelRoutingMode}
                <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={audioChannelRoutingOptions.includes(audioChannelRouting) ? audioChannelRouting : 'normal'} data-testid="clip-audio-channel-routing-select" onChange={(event) => commit({ audioChannelRouting: event.target.value as AudioChannelRoutingMode })}>
                  {audioChannelRoutingOptions.map((mode) => (<option key={mode} value={mode}>{zhCN.inspector.audioChannelRoutingOptions[mode]}</option>))}
                </select>
              </label>
            </div>
          </details>

          {/* Pitch Analysis */}
          <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="pitch-analysis-section" open>
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.sections.pitchAnalysis}</summary>
            <div className="space-y-2 border-t border-line p-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-panel p-2"><div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.primaryPitchNote}</div><div className="font-semibold text-ink" data-testid="clip-pitch-primary-note">{pitchSummary.primaryNote ?? zhCN.inspector.pitchAnalysis.noData}</div></div>
                <div className="rounded bg-panel p-2"><div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.pitchRange}</div><div className="font-semibold text-ink" data-testid="clip-pitch-range">{pitchSummary.minHz !== undefined && pitchSummary.maxHz !== undefined ? `${Math.round(pitchSummary.minHz)}-${Math.round(pitchSummary.maxHz)} Hz` : zhCN.inspector.pitchAnalysis.noData}</div></div>
                <div className="rounded bg-panel p-2"><div className="text-[var(--color-text-muted)]">{zhCN.inspector.fields.pitchStability}</div><div className="font-semibold text-ink" data-testid="clip-pitch-stability">{`${Math.round(pitchSummary.stability * 100)}%`}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={selectedClipLocked || pitchAnalyzing || !asset} onClick={runPitchAnalysis} data-testid="clip-pitch-analyze-button">{pitchAnalyzing ? zhCN.inspector.pitchAnalysis.analyzing : zhCN.inspector.pitchAnalysis.analyze}</button>
                <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!clip.pitchData || clip.pitchData.length === 0} onClick={exportPitchCsv} data-testid="clip-pitch-export-csv-button">{zhCN.inspector.pitchAnalysis.exportCsv}</button>
              </div>
            </div>
          </details>

          {/* Spatial Audio */}
          <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="spatial-audio-section" open>
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{t('inspector.sections.spatialAudio')}</summary>
            <div className="space-y-3 border-t border-line p-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('inspector.fields.spatialRenderMode')}
                <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={spatialAudio.renderMode} data-testid="clip-spatial-render-mode-select" onChange={(event) => commit({ spatialAudio: { ...spatialAudio, renderMode: event.target.value as SpatialAudioRenderMode } })}>
                  {spatialRenderModeOptions.map((mode) => (<option key={mode} value={mode}>{t(`inspector.spatialRenderModes.${mode}`)}</option>))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <AnimatedField label={t('inspector.fields.spatialX')} onAddKeyframe={() => addKeyframe('spatialX', spatialAudio.x)} testId="add-spatial-x-keyframe-button"><RangeNumberField label={t('inspector.fields.spatialX')} value={spatialAudio.x} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(x) => commit({ spatialAudio: { ...spatialAudio, x } })} testId="clip-spatial-x-input" /></AnimatedField>
                <AnimatedField label={t('inspector.fields.spatialY')} onAddKeyframe={() => addKeyframe('spatialY', spatialAudio.y)} testId="add-spatial-y-keyframe-button"><RangeNumberField label={t('inspector.fields.spatialY')} value={spatialAudio.y} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(y) => commit({ spatialAudio: { ...spatialAudio, y } })} testId="clip-spatial-y-input" /></AnimatedField>
              </div>
              <RangeNumberField label={t('inspector.fields.spatialZ')} value={spatialAudio.z} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(z) => commit({ spatialAudio: { ...spatialAudio, z } })} testId="clip-spatial-z-input" />
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('inspector.fields.spatialDistance')}
                <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={spatialAudio.distance} data-testid="clip-spatial-distance-select" onChange={(event) => commit({ spatialAudio: { ...spatialAudio, distance: event.target.value as SpatialAudioDistance } })}>
                  {spatialDistanceOptions.map((distance) => (<option key={distance} value={distance}>{t(`inspector.spatialDistanceOptions.${distance}`)}</option>))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <AnimatedField label={t('inspector.fields.spatialAzimuth')} onAddKeyframe={() => addKeyframe('spatialAzimuth', spatialAudio.azimuth)} testId="add-spatial-azimuth-keyframe-button"><RangeNumberField label={t('inspector.fields.spatialAzimuth')} value={spatialAudio.azimuth} min={-180} max={180} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(azimuth) => commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', azimuth } })} testId="clip-spatial-azimuth-input" /></AnimatedField>
                <AnimatedField label={t('inspector.fields.spatialElevation')} onAddKeyframe={() => addKeyframe('spatialElevation', spatialAudio.elevation)} testId="add-spatial-elevation-keyframe-button"><RangeNumberField label={t('inspector.fields.spatialElevation')} value={spatialAudio.elevation} min={-90} max={90} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(elevation) => commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', elevation } })} testId="clip-spatial-elevation-input" /></AnimatedField>
              </div>
              <AnimatedField label={t('inspector.fields.spatialDistanceMeters')} onAddKeyframe={() => addKeyframe('spatialDistanceMeters', spatialAudio.distanceMeters)} testId="add-spatial-distance-meters-keyframe-button"><RangeNumberField label={t('inspector.fields.spatialDistanceMeters')} value={spatialAudio.distanceMeters} min={0.1} max={100} step={0.1} format={(value) => `${value.toFixed(1)} m`} onCommit={(distanceMeters) => commit({ spatialAudio: { ...spatialAudio, renderMode: 'binaural', distanceMeters } })} testId="clip-spatial-distance-meters-input" /></AnimatedField>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('inspector.fields.spatialRoomModel')}
                <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={spatialAudio.roomModel} data-testid="clip-spatial-room-model-select" onChange={(event) => commit({ spatialAudio: { ...spatialAudio, roomModel: event.target.value as SpatialAudioRoomModel } })}>
                  {spatialRoomOptions.map((room) => (<option key={room} value={room}>{t(`inspector.spatialRoomModels.${room}`)}</option>))}
                </select>
              </label>
            </div>
          </details>

          {/* Fade In/Out */}
          <div className="grid grid-cols-2 gap-2">
            <RangeNumberField label={zhCN.inspector.fields.fadeIn} value={fadeInDuration} min={0} max={clip.duration} step={0.1} format={(value) => `${value.toFixed(1)}s`} onCommit={(fadeInDuration) => commit({ fadeInDuration })} testId="clip-fade-in-duration-input" />
            <RangeNumberField label={zhCN.inspector.fields.fadeOut} value={fadeOutDuration} min={0} max={clip.duration} step={0.1} format={(value) => `${value.toFixed(1)}s`} onCommit={(fadeOutDuration) => commit({ fadeOutDuration })} testId="clip-fade-out-duration-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.fadeInCurve}
              <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={fadeInCurve} onChange={(event) => commit({ fadeInCurve: event.target.value as AudioFadeCurve })} data-testid="clip-fade-in-curve-select">
                <option value="linear">{zhCN.inspector.easing.linear}</option>
                <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.fields.fadeOutCurve}
              <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={fadeOutCurve} onChange={(event) => commit({ fadeOutCurve: event.target.value as AudioFadeCurve })} data-testid="clip-fade-out-curve-select">
                <option value="linear">{zhCN.inspector.easing.linear}</option>
                <option value="ease-in">{zhCN.inspector.easing.easeIn}</option>
                <option value="ease-out">{zhCN.inspector.easing.easeOut}</option>
              </select>
            </label>
          </div>
        </Section>
      ) : null}
    </>
  );
}

/** AI local denoise processing controls */
function AiLocalDenoiseControls({
  clipId, assetPath, aiLocalDenoise,
  aiLocalDenoiseProcessing, setAiLocalDenoiseProcessing,
  aiLocalDenoiseProgress, setAiLocalDenoiseProgress,
  aiLocalDenoiseStage, setAiLocalDenoiseStage,
  aiLocalDenoiseResult, setAiLocalDenoiseResult,
  commit,
}: {
  clipId: string;
  assetPath?: string;
  aiLocalDenoise?: { enabled?: boolean; strength?: number };
  aiLocalDenoiseProcessing: boolean;
  setAiLocalDenoiseProcessing: (v: boolean) => void;
  aiLocalDenoiseProgress: number;
  setAiLocalDenoiseProgress: (v: number) => void;
  aiLocalDenoiseStage: string;
  setAiLocalDenoiseStage: (v: string) => void;
  aiLocalDenoiseResult: { outputPath: string; noiseReductionDb: number } | null;
  setAiLocalDenoiseResult: (v: { outputPath: string; noiseReductionDb: number } | null) => void;
  commit: (patch: Record<string, unknown>) => void;
}) {
  if (aiLocalDenoiseProcessing) {
    return (
      <div className="space-y-2" data-testid="ai-local-denoise-progress">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 size={14} className="animate-spin" />
          <span>{Math.round(aiLocalDenoiseProgress * 100)}%</span>
          <span className="capitalize">{aiLocalDenoiseStage}</span>
        </div>
        <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-panel" type="button" onClick={() => { void cancelAudioNoiseReduction(clipId); setAiLocalDenoiseProcessing(false); }} data-testid="ai-local-denoise-cancel">取消</button>
      </div>
    );
  }

  if (aiLocalDenoiseResult) {
    return (
      <div className="space-y-2" data-testid="ai-local-denoise-complete">
        <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-700">降噪完成: -{aiLocalDenoiseResult.noiseReductionDb.toFixed(1)} dB</div>
        <button className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white" type="button" onClick={() => setAiLocalDenoiseResult(null)} data-testid="ai-local-denoise-reset">重新处理</button>
      </div>
    );
  }

  return (
    <button
      className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      type="button" disabled={!aiLocalDenoise?.enabled || !assetPath}
      onClick={async () => {
        if (!assetPath) return;
        setAiLocalDenoiseProcessing(true);
        setAiLocalDenoiseProgress(0);
        setAiLocalDenoiseStage('decoding');
        setAiLocalDenoiseResult(null);
        try {
          const result = await processAudioNoiseReduction({ mediaPath: assetPath, clipId, strength: aiLocalDenoise?.strength ?? 0.5 });
          setAiLocalDenoiseResult({ outputPath: result.outputPath, noiseReductionDb: result.noiseReductionDb });
          commit({ aiLocalDenoise: { ...(aiLocalDenoise ?? { enabled: true, strength: 0.5 }), outputPath: result.outputPath, originalPath: result.originalPath, processedAt: Date.now() } });
        } catch (error) {
          showToast({ kind: 'error', title: '降噪失败', message: error instanceof Error ? error.message : String(error) });
        } finally {
          setAiLocalDenoiseProcessing(false);
        }
      }}
      data-testid="ai-local-denoise-process"
    >
      <Sparkles size={14} className="mr-1 inline" />开始降噪
    </button>
  );
}

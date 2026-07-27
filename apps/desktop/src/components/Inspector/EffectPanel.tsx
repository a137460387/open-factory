import React from 'react';
import {AddEffectCommand, RemoveEffectCommand, ReorderEffectsCommand, UpdateEffectCommand, createId, DEFAULT_COLOR_CORRECTION, DEFAULT_EFFECT_PARAMS, INPUT_COLOR_SPACES, MAX_CHROMA_KEY_COLORS, type ChromaKeyMode, type ClipProjection, type ClipPanoramaOutputProjection, type InputColorSpace, type VideoDeinterlaceMode, type VideoDenoisePreset} from '@open-factory/editor-core';
import {Palette, Pipette, Plus, Trash2, X} from 'lucide-react';
import {zhCN} from '../../i18n/strings';
import {timelineAccessor} from '../../store/commandManager';
import {Section, NumberField, RangeNumberField, ColorField, ToggleField} from './InspectorFields';
import {CurveEditor, ThreeWayColorEditor, PrivacyBlurPanel, EffectsEditor, rgbToHex, hexToRgb, formatLutPath, formatInputColorSpaceLabel} from './InspectorEditors';
import {AIColorGradingPanel, AILookMatchPanel} from './AIColorGradingPanel';
import {ColorGradingWorkspace} from '../ColorGrading/ColorGradingWorkspace';
import {ProfessionalColorGradingPanel} from '../ColorGrading/ProfessionalColorGradingPanel';
import {MasksEditor} from './MasksEditor';
import type {ClipInspectorBodyProps} from './ClipInspectorBody';

export function EffectPanel({
  clip,
  selectedClipLocked,
  asset,
  projectSettings,
  privacyDetectionModelPath,
  privacyBlurBusy,
  privacyBlurEffect,
  setPrivacyBlurEffect,
  colorMatchReferenceClipId,
  setColorMatchReferenceClipId,
  colorMatchReferenceClips,
  colorMatchBusy,
  colorCorrection,
  chromaKey,
  keyingMode,
  chromaKeyPickActive,
  stabilization,
  analysisProgress,
  masks,
  privacyRedactions,
  colorCurves,
  threeWayColor,
  videoRestoration,
  qualityEnhancement,
  deinterlaceSuggestion,
  blendMode,
  projection,
  panorama,
  commit,
  addKeyframe,
  runEffectCommand,
  chooseLut,
  commitChromaKeyColors,
  updateChromaKeyColor,
  addChromaKeyColor,
  removeChromaKeyColor,
  toggleChromaKeyPicker,
  runStabilizationAnalysis,
  updateVideoRestoration,
  updateQualityEnhancement,
  updatePanorama,
  applyColorMatch,
  runPrivacyBlurDetection,
  addMask,
  updateMask,
  removeMask,
}: ClipInspectorBodyProps) {
  return (
    <>
      {/* Projection / Panorama */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.projection}>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.projection}
            <select
              className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              value={projection} data-testid="clip-projection-select"
              onChange={(event) => commit({ projection: event.target.value as ClipProjection, panorama })}
            >
              <option value="flat">{zhCN.inspector.projection.flat}</option>
              <option value="equirectangular">{zhCN.inspector.projection.equirectangular}</option>
              <option value="cubemap">{zhCN.inspector.projection.cubemap}</option>
            </select>
          </label>
          {projection !== 'flat' ? (
            <>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.fields.panoramaOutput}
                <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={panorama.outputProjection} data-testid="clip-panorama-output-select" onChange={(event) => updatePanorama({ outputProjection: event.target.value as ClipPanoramaOutputProjection })}>
                  <option value="flat">{zhCN.inspector.panoramaOutput.flat}</option>
                  <option value="equirectangular">{zhCN.inspector.panoramaOutput.equirectangular}</option>
                </select>
              </label>
              <RangeNumberField label={zhCN.inspector.fields.yaw} value={panorama.yaw} min={-180} max={180} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(yaw) => updatePanorama({ yaw })} testId="clip-panorama-yaw-input" />
              <RangeNumberField label={zhCN.inspector.fields.pitch} value={panorama.pitch} min={-90} max={90} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(pitch) => updatePanorama({ pitch })} testId="clip-panorama-pitch-input" />
              <RangeNumberField label={zhCN.inspector.fields.roll} value={panorama.roll} min={-180} max={180} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(roll) => updatePanorama({ roll })} testId="clip-panorama-roll-input" />
              <RangeNumberField label={zhCN.inspector.fields.fov} value={panorama.fov} min={60} max={120} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(fov) => updatePanorama({ fov })} testId="clip-panorama-fov-input" />
            </>
          ) : null}
        </Section>
      ) : null}

      {/* Chroma Key */}
      {(clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence') ? (
        <Section title={zhCN.inspector.sections.chromaKey}>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.keyingMode}
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={keyingMode} data-testid="keying-mode-select" onChange={(event) => { const mode = event.target.value as ChromaKeyMode | 'none'; commit({ chromaKey: { ...chromaKey, enabled: mode !== 'none', mode: mode === 'none' ? chromaKey.mode : mode } }); }}>
              <option value="none">{zhCN.inspector.keyingModes.none}</option>
              <option value="chroma-key">{zhCN.inspector.keyingModes['chroma-key']}</option>
              <option value="luma-key">{zhCN.inspector.keyingModes['luma-key']}</option>
              <option value="difference-matte">{zhCN.inspector.keyingModes['difference-matte']}</option>
            </select>
          </label>
          {keyingMode === 'chroma-key' ? (
            <ChromaKeyControls chromaKey={chromaKey} chromaKeyPickActive={chromaKeyPickActive} commit={commit} updateChromaKeyColor={updateChromaKeyColor} addChromaKeyColor={addChromaKeyColor} removeChromaKeyColor={removeChromaKeyColor} toggleChromaKeyPicker={toggleChromaKeyPicker} />
          ) : null}
          {keyingMode === 'luma-key' ? (
            <div className="space-y-2" data-testid="luma-key-controls">
              <RangeNumberField label={zhCN.inspector.fields.lumaThreshold} value={chromaKey.lumaThreshold} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(lumaThreshold) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaThreshold } })} testId="luma-key-threshold" />
              <RangeNumberField label={zhCN.inspector.fields.lumaTolerance} value={chromaKey.lumaTolerance} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(lumaTolerance) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaTolerance } })} testId="luma-key-tolerance" />
              <RangeNumberField label={zhCN.inspector.fields.lumaSoftness} value={chromaKey.lumaSoftness} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(lumaSoftness) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'luma-key', lumaSoftness } })} testId="luma-key-softness" />
            </div>
          ) : null}
          {keyingMode === 'difference-matte' ? (
            <div className="space-y-2" data-testid="difference-matte-controls">
              <NumberField label={zhCN.inspector.fields.referenceTime} value={chromaKey.differenceReferenceTime} min={0} max={clip.duration} step={1 / Math.max(1, projectSettings.fps)} onCommit={(differenceReferenceTime) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceReferenceTime } })} testId="difference-matte-reference-time" />
              <RangeNumberField label={zhCN.inspector.fields.differenceThreshold} value={chromaKey.differenceThreshold} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(differenceThreshold) => commit({ chromaKey: { ...chromaKey, enabled: true, mode: 'difference-matte', differenceThreshold } })} testId="difference-matte-threshold" />
            </div>
          ) : null}
        </Section>
      ) : null}

      {/* Stabilization */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.stabilization}>
          <ToggleField label={zhCN.inspector.fields.enabled} checked={stabilization.enabled} onCommit={(enabled) => commit({ stabilization: { ...stabilization, enabled } })} testId="stabilization-toggle" />
          <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="stabilization-status">
            {analysisProgress !== undefined && analysisProgress < 1 ? zhCN.inspector.fields.stabilizationProgress(analysisProgress) : stabilization.analyzed ? zhCN.inspector.fields.stabilizationAnalyzed : zhCN.inspector.fields.stabilizationNotAnalyzed}
          </div>
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel" type="button" data-testid="analyze-stabilization-button" onClick={() => void runStabilizationAnalysis()}>{zhCN.inspector.fields.analyzeStabilization}</button>
          <RangeNumberField label={zhCN.inspector.fields.smoothing} value={stabilization.smoothing} min={1} max={100} step={1} format={(value) => value.toFixed(0)} onCommit={(smoothing) => commit({ stabilization: { ...stabilization, smoothing } })} testId="stabilization-smoothing" />
          <RangeNumberField label={zhCN.inspector.fields.zoom} value={stabilization.zoom} min={0} max={5} step={0.1} format={(value) => value.toFixed(1)} onCommit={(zoom) => commit({ stabilization: { ...stabilization, zoom } })} testId="stabilization-zoom" />
        </Section>
      ) : null}

      {/* Color Match */}
      {(clip.type === 'video' || clip.type === 'image') ? (
        <Section title={zhCN.inspector.sections.colorMatch}>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            <span>{zhCN.inspector.fields.referenceClip}</span>
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:cursor-not-allowed disabled:opacity-60" value={colorMatchReferenceClipId} disabled={colorMatchReferenceClips.length === 0 || colorMatchBusy} onChange={(event) => setColorMatchReferenceClipId(event.target.value)} data-testid="color-match-reference-select">
              {colorMatchReferenceClips.length === 0 ? (<option value="">{zhCN.inspector.colorMatch.noReference}</option>) : null}
              {colorMatchReferenceClips.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
            </select>
          </label>
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!colorMatchReferenceClipId || colorMatchBusy} onClick={() => void applyColorMatch()} data-testid="apply-color-match-button">{colorMatchBusy ? zhCN.inspector.colorMatch.applying : zhCN.inspector.colorMatch.apply}</button>
        </Section>
      ) : null}

      {/* Masks & Privacy */}
      {(clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence') ? (
        <Section title={zhCN.inspector.sections.masks}>
          <PrivacyBlurPanel effect={privacyBlurEffect} modelConfigured={Boolean(privacyDetectionModelPath.trim())} busy={privacyBlurBusy} disabled={clip.type === 'nested-sequence'} onEffectChange={setPrivacyBlurEffect} onRun={() => void runPrivacyBlurDetection()} />
          <MasksEditor masks={masks} onAdd={addMask} onUpdate={updateMask} onRemove={removeMask} />
          <PrivacyRedactionPanel privacyRedactions={privacyRedactions} commit={commit} />
        </Section>
      ) : null}

      {/* Video Restoration */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.videoRestoration}>
          <VideoRestorationControls videoRestoration={videoRestoration} deinterlaceSuggestion={deinterlaceSuggestion} asset={asset} updateVideoRestoration={updateVideoRestoration} />
        </Section>
      ) : null}

      {/* Quality Enhancement */}
      {clip.type === 'video' ? (
        <Section title={zhCN.inspector.sections.qualityEnhancement}>
          <ToggleField label={zhCN.inspector.qualityEnhancement.superResolution} checked={qualityEnhancement.superResolution} onCommit={(superResolution) => updateQualityEnhancement({ superResolution })} testId="quality-enhancement-super-resolution-toggle" />
          <ToggleField label={zhCN.inspector.qualityEnhancement.deblock} checked={qualityEnhancement.deblock} onCommit={(deblock) => updateQualityEnhancement({ deblock })} testId="quality-enhancement-deblock-toggle" />
          <ToggleField label={zhCN.inspector.qualityEnhancement.colorBoost} checked={qualityEnhancement.colorBoost} onCommit={(colorBoost) => updateQualityEnhancement({ colorBoost })} testId="quality-enhancement-color-boost-toggle" />
          <ToggleField label={zhCN.inspector.qualityEnhancement.frameCompensation} checked={qualityEnhancement.frameCompensation} onCommit={(frameCompensation) => updateQualityEnhancement({ frameCompensation })} testId="quality-enhancement-frame-compensation-toggle" />
        </Section>
      ) : null}

      {/* Color Correction */}
      {clip.type !== 'audio' ? (
        <Section title={zhCN.inspector.fields.colorCorrection}>
          <label className="block rounded-md border border-line bg-panel p-2 text-xs font-medium text-[var(--color-text-secondary)]">
            <span>{zhCN.inspector.fields.inputColorSpace}</span>
            <select className="mt-1 w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5" value={colorCorrection.inputColorSpace ?? 'rec709'} onChange={(event) => commit({ colorCorrection: { inputColorSpace: event.target.value as InputColorSpace } })} data-testid="clip-input-color-space-select">
              {INPUT_COLOR_SPACES.map((colorSpace) => (<option key={colorSpace} value={colorSpace}>{formatInputColorSpaceLabel(colorSpace)}</option>))}
            </select>
          </label>
          <RangeNumberField label={zhCN.inspector.fields.brightness} value={colorCorrection.brightness} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(brightness) => commit({ colorCorrection: { brightness } })} testId="clip-brightness-input" />
          <RangeNumberField label={zhCN.inspector.fields.contrast} value={colorCorrection.contrast} min={0} max={2} step={0.01} format={(value) => value.toFixed(2)} onCommit={(contrast) => commit({ colorCorrection: { contrast } })} />
          <RangeNumberField label={zhCN.inspector.fields.saturation} value={colorCorrection.saturation} min={0} max={2} step={0.01} format={(value) => value.toFixed(2)} onCommit={(saturation) => commit({ colorCorrection: { saturation } })} />
          <RangeNumberField label={zhCN.inspector.fields.hue} value={colorCorrection.hue} min={-180} max={180} step={1} format={(value) => `${Math.round(value)}°`} onCommit={(hue) => commit({ colorCorrection: { hue } })} />
          <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="clip-lut-control">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--color-text-secondary)]">LUT</span>
              {colorCorrection.lutPath ? (
                <button className="rounded border border-line bg-[var(--color-bg-elevated)] p-1 hover:bg-[var(--color-bg-elevated)]" type="button" title={zhCN.inspector.fields.clearLut} data-testid="clear-lut-button" onClick={() => commit({ colorCorrection: { lutPath: null } })}><X size={14} /></button>
              ) : null}
            </div>
            <div className="mb-2 truncate" title={colorCorrection.lutPath ?? undefined} data-testid="clip-lut-path">{formatLutPath(colorCorrection.lutPath)}</div>
            <button className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-[var(--color-bg-elevated)]" type="button" data-testid="choose-lut-button" onClick={() => void chooseLut()}><Palette size={14} />{zhCN.inspector.fields.loadLut}</button>
          </div>
          <button className="w-full rounded-md border border-line px-2 py-1.5 text-sm font-medium hover:bg-panel" type="button" onClick={() => commit({ colorCorrection: { ...DEFAULT_COLOR_CORRECTION } })}>{zhCN.common.reset}</button>
          <AIColorGradingPanel clip={clip} sourcePath={asset?.path ?? ''} selectedClipLocked={selectedClipLocked} />
          <AILookMatchPanel clip={clip} />
        </Section>
      ) : null}

      {/* Color Curves */}
      {clip.type !== 'audio' ? (
        <Section title={zhCN.inspector.sections.curves}>
          <CurveEditor curves={colorCurves} onCommit={(nextCurves) => commit({ colorCorrection: { colorCurves: nextCurves } })} />
        </Section>
      ) : null}

      {/* Color Wheels */}
      {clip.type !== 'audio' ? (
        <Section title={zhCN.inspector.sections.colorWheels}>
          <ThreeWayColorEditor threeWayColor={threeWayColor} onCommit={(nextColor) => commit({ colorCorrection: { threeWayColor: nextColor } })} />
        </Section>
      ) : null}

      {/* Color Grading */}
      {clip.type !== 'audio' ? (
        <Section title="调色">
          <ColorGradingWorkspace graph={clip.colorGradingGraph} onGraphChange={(graph) => commit({ colorGradingGraph: graph })} />
        </Section>
      ) : null}

      {/* Professional Color Grading */}
      {clip.type !== 'audio' ? (
        <Section title="专业调色面板">
          <ProfessionalColorGradingPanel clip={clip} onCommitColorCorrection={(patch) => commit({ colorCorrection: patch })} onChooseLUT={() => void chooseLut()} />
        </Section>
      ) : null}

      {/* Effects */}
      {clip.type !== 'audio' ? (
        <Section title={zhCN.inspector.sections.effects}>
          <EffectsEditor
            effects={clip.effects ?? []}
            onAdd={(type) => runEffectCommand(new AddEffectCommand(timelineAccessor, clip.id, { type, params: DEFAULT_EFFECT_PARAMS[type] }))}
            onRemove={(effectId) => runEffectCommand(new RemoveEffectCommand(timelineAccessor, clip.id, effectId))}
            onUpdate={(effectId, patch) => runEffectCommand(new UpdateEffectCommand(timelineAccessor, clip.id, effectId, patch))}
            onReorder={(effectIds) => runEffectCommand(new ReorderEffectsCommand(timelineAccessor, clip.id, effectIds))}
          />
        </Section>
      ) : null}

    </>
  );
}

/** Chroma key color list + controls */
function ChromaKeyControls({ chromaKey, chromaKeyPickActive, commit, updateChromaKeyColor, addChromaKeyColor, removeChromaKeyColor, toggleChromaKeyPicker }: Pick<ClipInspectorBodyProps, 'chromaKey' | 'chromaKeyPickActive' | 'commit' | 'updateChromaKeyColor' | 'addChromaKeyColor' | 'removeChromaKeyColor' | 'toggleChromaKeyPicker'>) {
  return (
    <>
      <div className="space-y-2" data-testid="chroma-key-color-list">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.fields.chromaKeyColor}</span>
          <div className="flex items-center gap-1">
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" title={zhCN.inspector.chromaKey.addSampleColor} disabled={chromaKey.colors.length >= MAX_CHROMA_KEY_COLORS} onClick={addChromaKeyColor} data-testid="chroma-key-add-color"><Plus size={15} /></button>
            <button className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-[var(--color-text-secondary)] hover:bg-panel ${chromaKeyPickActive ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-[var(--color-bg-elevated)]'}`} type="button" title={zhCN.inspector.chromaKey.pickFromPreview} onClick={toggleChromaKeyPicker} data-testid="chroma-key-pick-preview" data-active={chromaKeyPickActive ? 'true' : 'false'}><Pipette size={15} /></button>
          </div>
        </div>
        {chromaKey.colors.map((color, index) => (
          <div key={`chroma-key-color-${index}`} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ColorField label={zhCN.inspector.chromaKey.sampleColor(index + 1)} value={rgbToHex(color)} onCommit={(value) => updateChromaKeyColor(index, hexToRgb(value))} testId={index === 0 ? 'chroma-key-color' : `chroma-key-color-${index}`} />
            </div>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" title={zhCN.inspector.chromaKey.removeSampleColor} disabled={chromaKey.colors.length <= 1} onClick={() => removeChromaKeyColor(index)} data-testid={`chroma-key-remove-color-${index}`}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <RangeNumberField label={zhCN.inspector.fields.similarity} value={chromaKey.similarity} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(similarity) => commit({ chromaKey: { ...chromaKey, similarity } })} testId="chroma-key-similarity" />
      <RangeNumberField label={zhCN.inspector.fields.blend} value={chromaKey.blend} min={0} max={1} step={0.01} format={(value) => value.toFixed(2)} onCommit={(blend) => commit({ chromaKey: { ...chromaKey, blend } })} testId="chroma-key-blend" />
      <RangeNumberField label={zhCN.inspector.fields.erosion} value={chromaKey.erosion} min={-5} max={5} step={1} format={(value) => `${value}px`} onCommit={(erosion) => commit({ chromaKey: { ...chromaKey, erosion } })} testId="chroma-key-erosion" />
      <ToggleField label={zhCN.inspector.fields.spillSuppression} checked={chromaKey.spillSuppression} onCommit={(spillSuppression) => commit({ chromaKey: { ...chromaKey, spillSuppression } })} testId="chroma-key-spill-suppression" />
    </>
  );
}

/** Privacy redaction list */
function PrivacyRedactionPanel({ privacyRedactions, commit }: Pick<ClipInspectorBodyProps, 'privacyRedactions' | 'commit'>) {
  return (
    <div className="mt-2 space-y-2" data-testid="privacy-redaction-panel">
      <div className="text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.privacyRedaction.title}</div>
      {privacyRedactions.map((r) => (
        <div key={r.id} className="rounded-md border border-line p-2 space-y-1" data-testid={`privacy-redaction-item-${r.id}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">{zhCN.inspector.privacyRedaction.regions[r.type] ?? r.type}</span>
            <div className="flex items-center gap-1">
              <button className="rounded p-1 text-xs hover:bg-panel" type="button" title={zhCN.inspector.privacyRedaction.toggle} data-testid={`privacy-redaction-toggle-${r.id}`} onClick={() => { const updated = privacyRedactions.map((pr) => pr.id === r.id ? { ...pr, enabled: !pr.enabled } : pr); commit({ privacyRedactions: updated }); }}>{r.enabled ? '✓' : '✗'}</button>
              <button className="rounded p-1 text-xs text-red-500 hover:bg-red-50" type="button" title={zhCN.inspector.privacyRedaction.remove} data-testid={`privacy-redaction-remove-${r.id}`} onClick={() => { commit({ privacyRedactions: privacyRedactions.filter((pr) => pr.id !== r.id) }); }}><Trash2 size={12} /></button>
            </div>
          </div>
          <label className="block text-xs text-[var(--color-text-secondary)]">
            <span>{zhCN.inspector.privacyRedaction.blurStrength}</span>
            <input type="range" min={0} max={1} step={0.05} value={r.blurStrength} className="mt-1 w-full" data-testid={`privacy-redaction-blur-${r.id}`} onChange={(e) => { const updated = privacyRedactions.map((pr) => pr.id === r.id ? { ...pr, blurStrength: Number(e.target.value) } : pr); commit({ privacyRedactions: updated }); }} />
          </label>
        </div>
      ))}
      <button className="w-full rounded-md border border-dashed border-line px-2 py-1.5 text-xs text-[var(--color-text-muted)] hover:border-brand hover:text-brand" type="button" data-testid="privacy-redaction-add" onClick={() => { commit({ privacyRedactions: [...privacyRedactions, { id: createId('redaction'), type: 'face', keyframes: [{ time: 0, x: 0.25, y: 0.25, w: 0.2, h: 0.25 }], blurStrength: 1, enabled: true }] }); }}>+ {zhCN.inspector.privacyRedaction.addRegion}</button>
    </div>
  );
}

/** Video restoration controls */
function VideoRestorationControls({ videoRestoration, deinterlaceSuggestion, asset, updateVideoRestoration }: Pick<ClipInspectorBodyProps, 'videoRestoration' | 'deinterlaceSuggestion' | 'asset' | 'updateVideoRestoration'>) {
  return (
    <>
      <div className="rounded-md border border-line bg-panel p-2">
        <ToggleField label={zhCN.inspector.fields.deinterlace} checked={videoRestoration.deinterlace.enabled} onCommit={(enabled) => updateVideoRestoration({ deinterlace: { ...videoRestoration.deinterlace, enabled } })} testId="video-restoration-deinterlace-toggle" />
        <label className="mt-2 block text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.inspector.fields.deinterlaceMode}
          <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={videoRestoration.deinterlace.mode} data-testid="video-restoration-deinterlace-mode" onChange={(event) => updateVideoRestoration({ deinterlace: { ...videoRestoration.deinterlace, mode: Number(event.target.value) as VideoDeinterlaceMode } })}>
            <option value={0}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendFrame}</option>
            <option value={1}>{zhCN.inspector.videoRestoration.deinterlaceModes.sendField}</option>
          </select>
        </label>
        {deinterlaceSuggestion !== null && !videoRestoration.deinterlace.enabled ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" data-testid="video-restoration-deinterlace-suggestion">
            <div>{zhCN.inspector.videoRestoration.deinterlaceSuggestion(asset?.fieldOrder ?? '')}</div>
            <button className="mt-2 rounded-md border border-amber-300 bg-[var(--color-bg-elevated)] px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100" type="button" data-testid="video-restoration-apply-deinterlace-suggestion" onClick={() => updateVideoRestoration({ deinterlace: { enabled: true, mode: deinterlaceSuggestion } })}>{zhCN.inspector.videoRestoration.applySuggestion}</button>
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-line bg-panel p-2">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.inspector.fields.temporalDenoisePreset}
          <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={videoRestoration.temporalDenoise.preset} data-testid="video-restoration-temporal-preset" onChange={(event) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, preset: event.target.value as VideoDenoisePreset } })}>
            <option value="off">{zhCN.inspector.videoRestoration.presets.off}</option>
            <option value="low">{zhCN.inspector.videoRestoration.presets.low}</option>
            <option value="medium">{zhCN.inspector.videoRestoration.presets.medium}</option>
            <option value="high">{zhCN.inspector.videoRestoration.presets.high}</option>
            <option value="custom">{zhCN.inspector.videoRestoration.presets.custom}</option>
          </select>
        </label>
        {videoRestoration.temporalDenoise.preset === 'custom' ? (
          <div className="mt-3 space-y-2" data-testid="video-restoration-temporal-custom">
            <RangeNumberField label={zhCN.inspector.fields.lumaSpatial} value={videoRestoration.temporalDenoise.lumaSpatial} min={0} max={20} step={0.1} format={(value) => value.toFixed(1)} onCommit={(lumaSpatial) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, lumaSpatial } })} testId="video-restoration-luma-spatial" />
            <RangeNumberField label={zhCN.inspector.fields.chromaSpatial} value={videoRestoration.temporalDenoise.chromaSpatial} min={0} max={20} step={0.1} format={(value) => value.toFixed(1)} onCommit={(chromaSpatial) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, chromaSpatial } })} testId="video-restoration-chroma-spatial" />
            <RangeNumberField label={zhCN.inspector.fields.lumaTmp} value={videoRestoration.temporalDenoise.lumaTmp} min={0} max={20} step={0.1} format={(value) => value.toFixed(1)} onCommit={(lumaTmp) => updateVideoRestoration({ temporalDenoise: { ...videoRestoration.temporalDenoise, lumaTmp } })} testId="video-restoration-luma-tmp" />
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-line bg-panel p-2">
        <ToggleField label={zhCN.inspector.fields.spatialDenoise} checked={videoRestoration.spatialDenoise.enabled} onCommit={(enabled) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, enabled } })} testId="video-restoration-spatial-toggle" />
        {videoRestoration.spatialDenoise.enabled ? (
          <div className="mt-2 space-y-2" data-testid="video-restoration-spatial-controls">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{zhCN.inspector.videoRestoration.spatialWarning}</div>
            <RangeNumberField label={zhCN.inspector.fields.spatialStrength} value={videoRestoration.spatialDenoise.strength} min={0} max={30} step={0.1} format={(value) => value.toFixed(1)} onCommit={(strength) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, strength } })} testId="video-restoration-spatial-strength" />
            <RangeNumberField label={zhCN.inspector.fields.patchSize} value={videoRestoration.spatialDenoise.patchSize} min={1} max={99} step={2} format={(value) => value.toFixed(0)} onCommit={(patchSize) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, patchSize } })} testId="video-restoration-patch-size" />
            <RangeNumberField label={zhCN.inspector.fields.researchSize} value={videoRestoration.spatialDenoise.researchSize} min={1} max={99} step={2} format={(value) => value.toFixed(0)} onCommit={(researchSize) => updateVideoRestoration({ spatialDenoise: { ...videoRestoration.spatialDenoise, researchSize } })} testId="video-restoration-research-size" />
          </div>
        ) : null}
      </div>
    </>
  );
}

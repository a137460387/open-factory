import React from 'react';
import {
  getTimelineDuration,
  richTextToPlainText,
  DEFAULT_TEXT_ARC,
  DEFAULT_TEXT_LAYOUT,
  DEFAULT_TEXT_OPEN_TYPE_FEATURES,
  DEFAULT_TEXT_PATH,
  TEXT_ANIMATION_DIRECTIONS,
  TEXT_ANIMATION_PRESETS,
  normalizeSequenceFrameRate,
  type TextBoxFitMode,
  type TextAnimationDirection,
  type TextAnimationPreset,
} from '@open-factory/editor-core';
import { Mic } from 'lucide-react';
import { t, zhCN } from '../../i18n/strings';
import { generateTtsVoiceover } from '../../lib/ttsVoiceover';
import { isTranslationConfigured } from '../../store/translationSettingsStore';
import {
  Section,
  TextField,
  TextAreaField,
  NumberField,
  RangeField,
  RangeNumberField,
  ColorField,
  ToggleField,
} from './InspectorFields';
import {
  SubtitleStyleTemplatesPanel,
  SubtitleProofreadingPanel,
  SubtitleRetimingPanel,
  getKenBurnsEndScale,
} from './InspectorEditors';
import { RichTextEditor } from './RichTextEditor';
import { SubtitleAIPolishPanel } from './SubtitleAIPolishPanel';
import { ChapterTitleAIPanel } from './ChapterTitleAIPanel';
import { AISubtitleStylePanel } from './AISubtitleStylePanel';
import { MotionGraphicPanel } from './MotionGraphicPanel';
import type { ClipInspectorBodyProps } from './ClipInspectorBody';

export function PropertyPanel(props: ClipInspectorBodyProps) {
  const {
    clip,
    selectedClipLocked,
    media,
    playheadTime,
    projectSettings,
    asset,
    clipStartTimecode,
    clipDurationTimecode,
    assetDurationTimecode,
    textPath,
    textLayout,
    textOpenTypeFeatures,
    textArc,
    textAnimationPreset,
    setTextAnimationPreset,
    textAnimationDuration,
    setTextAnimationDuration,
    textAnimationDirection,
    setTextAnimationDirection,
    textAnimationKeyframeCount,
    commit,
    addKeyframe,
    setKenBurns,
    updateKenBurnsEndScale,
    updateTextPath,
    updateTextLayout,
    updateTextOpenTypeFeatures,
    updateTextArc,
    applyTextAnimation,
  } = props;
  return (
    <>
      {/* Basic Properties */}
      <Section title={zhCN.inspector.sections.clip}>
        {selectedClipLocked ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
            {zhCN.inspector.locked}
          </div>
        ) : null}
        <TextField label={zhCN.inspector.fields.name} value={clip.name} onCommit={(name) => commit({ name })} />
        <NumberField label={zhCN.inspector.fields.start} value={clip.start} min={0} step={0.033} onCommit={(start) => commit({ start })} />
        <NumberField label={zhCN.inspector.fields.duration} value={clip.duration} min={0.033} step={0.033} onCommit={(duration) => commit({ duration })} />
        {asset ? (
          <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
            <div className="truncate font-medium text-[var(--color-text-secondary)]">{asset.name}</div>
            <div>
              {asset.missing ? zhCN.inspector.missingFile : `${asset.width || '-'} x ${asset.height || '-'} | ${assetDurationTimecode}`}
            </div>
          </div>
        ) : null}
      </Section>

      {clip.type === 'motion-graphic' ? (
        <MotionGraphicPanel clip={clip} selectedClipLocked={selectedClipLocked} playheadTime={playheadTime} />
      ) : null}

      {/* Transform */}
      <Section title={zhCN.inspector.sections.transform}>
        <NumberField label="X" value={clip.transform.x} step={1} onCommit={(x) => commit({ transform: { x } })} hideLabel testId="clip-transform-x-input" />
        <NumberField label="Y" value={clip.transform.y} step={1} onCommit={(y) => commit({ transform: { y } })} hideLabel testId="clip-transform-y-input" />
        <RangeField label={zhCN.inspector.fields.scale} value={clip.transform.scale} min={0.1} max={4} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onCommit={(scale) => commit({ transform: { scale } })} hideLabel testId="clip-scale-slider" />
        <NumberField label={zhCN.inspector.fields.rotation} value={clip.transform.rotation} min={-180} max={180} step={1} onCommit={(rotation) => commit({ transform: { rotation } })} testId="clip-rotation-input" />
      </Section>

      {/* Blend Mode */}
      {(clip.type === 'video' || clip.type === 'image') ? (
        <Section title={t('inspector.sections.blend')}>
          <RangeField label={zhCN.inspector.fields.opacity} value={clip.transform.opacity} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(opacity) => commit({ transform: { opacity } })} testId="clip-opacity-slider" />
        </Section>
      ) : null}

      {/* Image Sequence */}
      {clip.type === 'image' && asset?.imageSequence ? (
        <Section title={zhCN.inspector.sections.imageSequence}>
          <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
            {asset.imageSequence.frameCount} PNG · {asset.imageSequence.pattern}
          </div>
          <RangeNumberField
            label={zhCN.inspector.fields.sequenceFrameRate}
            value={normalizeSequenceFrameRate(clip.sequenceFrameRate ?? asset.imageSequence.frameRate) ?? asset.imageSequence.frameRate}
            min={1} max={120} step={1} format={(value) => `${value.toFixed(0)} fps`}
            onCommit={(frameRate) => commit({ sequenceFrameRate: frameRate, duration: asset.imageSequence!.frameCount / frameRate })}
            testId="image-sequence-framerate"
          />
        </Section>
      ) : null}

      {/* Text / Subtitle / Credits */}
      {(clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'credits') ? (
        <Section title={clip.type === 'subtitle' ? zhCN.inspector.sections.subtitle : clip.type === 'credits' ? zhCN.inspector.sections.credits : zhCN.inspector.sections.text}>
          {clip.type === 'text' ? (
            <RichTextEditor clip={clip} disabled={selectedClipLocked} onCommit={(richText) => commit({ text: richTextToPlainText(richText, clip.text), richText })} />
          ) : (
            <TextAreaField label={zhCN.inspector.fields.text} value={clip.text} onCommit={(text) => commit({ text })} testId="clip-text-input" />
          )}
          <NumberField label={zhCN.inspector.fields.fontSize} value={clip.style.fontSize} min={8} step={1} onCommit={(fontSize) => commit({ style: { fontSize } })} />
          <TextField label={zhCN.inspector.fields.fontFamily} value={clip.style.fontFamily} onCommit={(fontFamily) => commit({ style: { fontFamily } })} />
          <ColorField label={zhCN.inspector.fields.color} value={clip.style.color} onCommit={(color) => commit({ style: { color } })} testId={clip.type === 'subtitle' ? 'subtitle-color-input' : undefined} />
          <ColorField label={zhCN.inspector.fields.background} value={clip.style.backgroundColor} onCommit={(backgroundColor) => commit({ style: { backgroundColor } })} testId="clip-background-color-input" />
          <RangeField label={zhCN.inspector.fields.backgroundOpacity} value={clip.style.backgroundOpacity} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(backgroundOpacity) => commit({ style: { backgroundOpacity } })} testId="clip-background-opacity-slider" />
          {clip.type === 'credits' ? (
            <>
              <NumberField label={zhCN.inspector.fields.rollSpeed} value={clip.rollSpeed} min={1} max={1000} step={1} onCommit={(rollSpeed) => commit({ rollSpeed })} testId="credits-roll-speed-input" />
              <NumberField label={zhCN.inspector.fields.lineSpacing} value={clip.style.lineSpacing} min={0} max={120} step={1} onCommit={(lineSpacing) => commit({ style: { lineSpacing } })} testId="credits-line-spacing-input" />
              <NumberField label={zhCN.inspector.fields.horizontalMargin} value={clip.style.horizontalMargin} min={0} max={960} step={1} onCommit={(horizontalMargin) => commit({ style: { horizontalMargin } })} testId="credits-horizontal-margin-input" />
            </>
          ) : null}
          {clip.type === 'subtitle' ? (
            <SubtitleDetailsPanel {...props} />
          ) : null}
          {clip.type === 'text' ? (
            <TextAdvancedPanel
              clip={clip} selectedClipLocked={selectedClipLocked}
              textPath={textPath} textLayout={textLayout} textOpenTypeFeatures={textOpenTypeFeatures} textArc={textArc}
              textAnimationPreset={textAnimationPreset} setTextAnimationPreset={setTextAnimationPreset}
              textAnimationDuration={textAnimationDuration} setTextAnimationDuration={setTextAnimationDuration}
              textAnimationDirection={textAnimationDirection} setTextAnimationDirection={setTextAnimationDirection}
              textAnimationKeyframeCount={textAnimationKeyframeCount}
              commit={commit} addKeyframe={addKeyframe}
              updateTextPath={updateTextPath} updateTextLayout={updateTextLayout}
              updateTextOpenTypeFeatures={updateTextOpenTypeFeatures} updateTextArc={updateTextArc}
              applyTextAnimation={applyTextAnimation}
            />
          ) : null}
          <ToggleField label={zhCN.inspector.fields.bold} checked={clip.style.bold} onCommit={(bold) => commit({ style: { bold } })} />
          <ToggleField label={zhCN.inspector.fields.italic} checked={clip.style.italic} onCommit={(italic) => commit({ style: { italic } })} />
          {(clip.type === 'text' || clip.type === 'subtitle') ? (
            <button
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel"
              type="button" data-testid="text-clip-tts-voiceover"
              onClick={() => generateTtsVoiceover([{ id: clip.id, text: clip.text, start: clip.start, duration: clip.duration }])}
            >
              <Mic size={14} />{zhCN.aiTts.textToVoiceover}
            </button>
          ) : null}
        </Section>
      ) : null}

      {/* Ken Burns */}
      {clip.type === 'image' ? (
        <Section title={zhCN.inspector.sections.kenBurns}>
          <ToggleField label={zhCN.inspector.sections.kenBurns} checked={Boolean(clip.kenBurns)} onCommit={setKenBurns} testId="ken-burns-toggle" />
          {clip.kenBurns ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
                <div className="mb-1 font-semibold">{zhCN.inspector.fields.startScale}</div>
                <div>{Math.round((clip.keyframes?.scaleX?.[0]?.value ?? clip.transform.scale) * 100)}%</div>
              </div>
              <div className="rounded-md border border-line bg-panel p-2 text-xs text-[var(--color-text-secondary)]">
                <div className="mb-1 font-semibold">{zhCN.inspector.fields.endScale}</div>
                <RangeNumberField
                  label={zhCN.inspector.fields.endScaleControl} value={getKenBurnsEndScale(clip)}
                  min={0.1} max={4} step={0.05} format={(value) => `${Math.round(value * 100)}%`}
                  onCommit={updateKenBurnsEndScale}
                />
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

/** Subtitle-specific detail panel (CC, speaker, data subtitle, styles, proofreading, retiming, AI polish) */
function SubtitleDetailsPanel({
  clip, selectedClipLocked, media, projectSettings, selectedSubtitleClips, project,
  allTimelineSubtitleClips, projectSpeakers, translationSettings, translationApiKeyError,
  subtitleTranslationProgress, subtitleStyleTemplates, customSoundDescOpen, setCustomSoundDescOpen,
  subtitleTrack, subtitleType, activeSpeaker, activeSpeakerEntry, soundDescSelectValue, soundDescriptionOptions,
  commit, commitSubtitleType, commitCcSpeaker, commitCcSoundDesc,
  addActiveSpeakerToLibrary, removeActiveSpeakerFromLibrary, updateActiveSpeakerColor,
  bindDataSubtitleSource, updateDataSubtitleTemplate, clearDataSubtitleSource,
  translateSubtitleTrack, applySubtitleStyleTemplate, saveCurrentSubtitleStyleTemplate,
  deleteSubtitleStyleTemplate, addSubtitleStyleTemplateToSharedLibrary,
}: ClipInspectorBodyProps) {
  const subClip = clip as Extract<import('@open-factory/editor-core').Clip, { type: 'subtitle' }>;

  return (
    <>
      {/* CC Panel */}
      <div className="space-y-3 rounded-md border border-line bg-[var(--color-bg-elevated)] p-2" data-testid="subtitle-cc-panel">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
          {zhCN.inspector.closedCaptions.kind}
          <select
            className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            value={subtitleType} data-testid="subtitle-type-select"
            onChange={(event) => commitSubtitleType(event.target.value === 'cc' ? 'cc' : 'subtitle')}
          >
            <option value="subtitle">{zhCN.inspector.closedCaptions.standard}</option>
            <option value="cc">{zhCN.inspector.closedCaptions.cc}</option>
          </select>
        </label>
        {subtitleType === 'cc' ? (
          <>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.closedCaptions.speaker}
              <input
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                defaultValue={activeSpeaker} list={`subtitle-speakers-${clip.id}`}
                placeholder={zhCN.inspector.closedCaptions.speakerPlaceholder} data-testid="subtitle-speaker-input"
                onBlur={(event) => commitCcSpeaker(event.target.value)}
              />
              <datalist id={`subtitle-speakers-${clip.id}`}>
                {projectSpeakers.map((speaker) => (<option key={speaker.id} value={speaker.name} />))}
              </datalist>
            </label>
            {projectSpeakers.length > 0 ? (
              <div className="space-y-1" data-testid="subtitle-speaker-library">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{zhCN.inspector.closedCaptions.speakerLibrary}</div>
                <div className="flex flex-wrap gap-1">
                  {projectSpeakers.map((speaker) => (
                    <button key={speaker.id} className="rounded border border-line px-2 py-1 text-xs hover:bg-panel" type="button" data-testid="subtitle-speaker-chip" onClick={() => commitCcSpeaker(speaker.name)}>{speaker.name}</button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40" type="button" disabled={!activeSpeaker || Boolean(activeSpeakerEntry)} data-testid="subtitle-add-speaker-button" onClick={addActiveSpeakerToLibrary}>{zhCN.inspector.closedCaptions.addSpeaker}</button>
              <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:opacity-40" type="button" disabled={!activeSpeakerEntry} data-testid="subtitle-remove-speaker-button" onClick={removeActiveSpeakerFromLibrary}>{zhCN.inspector.closedCaptions.removeSpeaker}</button>
            </div>
            {activeSpeakerEntry ? (
              <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                {zhCN.inspector.closedCaptions.speakerColor}
                <input className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1" type="color" value={activeSpeakerEntry.color ?? '#2563eb'} data-testid="subtitle-speaker-color-input" onChange={(event) => updateActiveSpeakerColor(event.target.value)} />
              </label>
            ) : null}
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
              {zhCN.inspector.closedCaptions.soundDesc}
              <select
                className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                value={soundDescSelectValue} data-testid="subtitle-sound-desc-select"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'custom') { setCustomSoundDescOpen(true); return; }
                  setCustomSoundDescOpen(false);
                  commitCcSoundDesc(value || undefined);
                }}
              >
                <option value="">{zhCN.inspector.closedCaptions.soundDescNone}</option>
                {soundDescriptionOptions.map((item) => (<option key={item} value={item}>{item}</option>))}
                <option value="custom">{zhCN.inspector.closedCaptions.soundDescCustom}</option>
              </select>
            </label>
            {soundDescSelectValue === 'custom' || customSoundDescOpen ? (
              <TextField label={zhCN.inspector.closedCaptions.customSoundDesc} value={subClip.soundDesc ?? ''} testId="subtitle-custom-sound-desc-input" onCommit={(soundDesc) => { setCustomSoundDescOpen(false); commitCcSoundDesc(soundDesc); }} />
            ) : null}
          </>
        ) : null}
      </div>

      {/* Data Subtitle */}
      <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="data-subtitle-section" open>
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.sections.dataSubtitle}</summary>
        <div className="space-y-2 border-t border-line p-2">
          <TextAreaField label={zhCN.inspector.fields.dataSubtitleTemplate} value={subClip.dataSubtitle?.template ?? subClip.text} testId="data-subtitle-template-input" onCommit={updateDataSubtitleTemplate} />
          <div className="rounded bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="data-subtitle-source-summary">
            {subClip.dataSubtitle ? zhCN.inspector.dataSubtitle.summary(subClip.dataSubtitle.sourceType, subClip.dataSubtitle.rows.length) : zhCN.inspector.dataSubtitle.notBound}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={selectedClipLocked} onClick={() => void bindDataSubtitleSource()} data-testid="data-subtitle-bind-button">{zhCN.inspector.dataSubtitle.bind}</button>
            <button className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={selectedClipLocked || !subClip.dataSubtitle} onClick={clearDataSubtitleSource} data-testid="data-subtitle-clear-button">{zhCN.inspector.dataSubtitle.clear}</button>
          </div>
        </div>
      </details>

      <SubtitleStyleTemplatesPanel templates={subtitleStyleTemplates} onApply={applySubtitleStyleTemplate} onSave={saveCurrentSubtitleStyleTemplate} onDelete={deleteSubtitleStyleTemplate} onAddToSharedLibrary={(template) => void addSubtitleStyleTemplateToSharedLibrary(template)} />
      <AISubtitleStylePanel clip={subClip} media={media} subtitleTrack={subtitleTrack} selectedClipLocked={selectedClipLocked} />
      <ColorField label={zhCN.inspector.fields.outlineColor} value={subClip.style.outlineColor} onCommit={(outlineColor) => commit({ style: { outlineColor } })} testId="subtitle-outline-color-input" />
      <NumberField label={zhCN.inspector.fields.outlineWidth} value={subClip.style.outlineWidth} min={0} max={12} step={1} onCommit={(outlineWidth) => commit({ style: { outlineWidth } })} testId="subtitle-outline-width-input" />
      <ColorField label={zhCN.inspector.fields.shadowColor} value={subClip.style.shadowColor} onCommit={(shadowColor) => commit({ style: { shadowColor } })} testId="subtitle-shadow-color-input" />
      <NumberField label={zhCN.inspector.fields.shadowOffset} value={subClip.style.shadowOffset} min={0} max={24} step={1} onCommit={(shadowOffset) => commit({ style: { shadowOffset } })} testId="subtitle-shadow-offset-input" />
      <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!isTranslationConfigured(translationSettings) || Boolean(subtitleTranslationProgress)} data-testid="subtitle-translate-button" onClick={() => void translateSubtitleTrack()}>
        {subtitleTranslationProgress ? zhCN.inspector.translation.progress(subtitleTranslationProgress.completed, subtitleTranslationProgress.total) : zhCN.inspector.translation.button}
      </button>
      {!isTranslationConfigured(translationSettings) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800" data-testid="subtitle-translation-not-configured">{translationApiKeyError || zhCN.inspector.translation.notConfigured}</div>
      ) : null}
      {subtitleTranslationProgress ? (
        <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="subtitle-translation-progress">{zhCN.inspector.translation.progress(subtitleTranslationProgress.completed, subtitleTranslationProgress.total)}</div>
      ) : null}
      <NumberField label={zhCN.inspector.fields.bottomMargin} value={subClip.style.yOffset} min={0} step={1} onCommit={(yOffset) => commit({ style: { yOffset } })} />
      <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
        {zhCN.inspector.fields.exportMode}
        <select className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={subClip.subtitleMode} data-testid="subtitle-mode-select" onChange={(event) => commit({ subtitleMode: event.target.value === 'soft-sub' ? 'soft-sub' : 'burn-in' })}>
          <option value="burn-in">{zhCN.inspector.subtitleMode.burnIn}</option>
          <option value="soft-sub">{zhCN.inspector.subtitleMode.softSub}</option>
        </select>
      </label>
      <SubtitleProofreadingPanel clip={subClip} selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [subClip]} selectedClipLocked={selectedClipLocked} projectSettings={projectSettings} />
      <SubtitleRetimingPanel clip={subClip} selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [subClip]} projectSettings={projectSettings} />
      <SubtitleAIPolishPanel selectedSubtitleClips={selectedSubtitleClips.length > 0 ? selectedSubtitleClips : [subClip]} selectedClipLocked={selectedClipLocked} />
      <ChapterTitleAIPanel allSubtitleClips={allTimelineSubtitleClips} totalDuration={getTimelineDuration(project.timeline)} selectedClipLocked={selectedClipLocked} />
    </>
  );
}

/** Text-specific advanced panel (typography, path, animation) */
function TextAdvancedPanel(props: {
  clip: Extract<import('@open-factory/editor-core').Clip, { type: 'text' }>;
  selectedClipLocked: boolean;
  textPath: ClipInspectorBodyProps['textPath'];
  textLayout: ClipInspectorBodyProps['textLayout'];
  textOpenTypeFeatures: ClipInspectorBodyProps['textOpenTypeFeatures'];
  textArc: ClipInspectorBodyProps['textArc'];
  textAnimationPreset: TextAnimationPreset;
  setTextAnimationPreset: (v: TextAnimationPreset) => void;
  textAnimationDuration: number;
  setTextAnimationDuration: (v: number) => void;
  textAnimationDirection: TextAnimationDirection;
  setTextAnimationDirection: (v: TextAnimationDirection) => void;
  textAnimationKeyframeCount: number;
  commit: (patch: Record<string, unknown>) => void;
  addKeyframe: ClipInspectorBodyProps['addKeyframe'];
  updateTextPath: ClipInspectorBodyProps['updateTextPath'];
  updateTextLayout: ClipInspectorBodyProps['updateTextLayout'];
  updateTextOpenTypeFeatures: ClipInspectorBodyProps['updateTextOpenTypeFeatures'];
  updateTextArc: ClipInspectorBodyProps['updateTextArc'];
  applyTextAnimation: () => void;
}) {
  const {
    clip, selectedClipLocked, textPath, textLayout, textOpenTypeFeatures, textArc,
    textAnimationPreset, setTextAnimationPreset, textAnimationDuration, setTextAnimationDuration,
    textAnimationDirection, setTextAnimationDirection, textAnimationKeyframeCount,
    addKeyframe, updateTextPath, updateTextLayout, updateTextOpenTypeFeatures, updateTextArc, applyTextAnimation,
  } = props;

  return (
    <>
      {/* Typography */}
      <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="advanced-text-layout-section" open>
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.sections.typography}</summary>
        <div className="space-y-3 border-t border-line p-2">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.textFitMode}
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={textLayout?.fitMode ?? DEFAULT_TEXT_LAYOUT.fitMode} disabled={selectedClipLocked} data-testid="text-fit-mode-select" onChange={(event) => updateTextLayout({ fitMode: event.target.value as TextBoxFitMode })}>
              <option value="fixed">{zhCN.inspector.textLayout.fitModes.fixed}</option>
              <option value="auto-height">{zhCN.inspector.textLayout.fitModes.autoHeight}</option>
              <option value="auto-scale">{zhCN.inspector.textLayout.fitModes.autoScale}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={zhCN.inspector.fields.boxWidth} value={textLayout?.boxWidth ?? DEFAULT_TEXT_LAYOUT.boxWidth} min={24} max={4096} step={1} disabled={selectedClipLocked} onCommit={(boxWidth) => updateTextLayout({ boxWidth })} testId="text-box-width-input" />
            <NumberField label={zhCN.inspector.fields.boxHeight} value={textLayout?.boxHeight ?? DEFAULT_TEXT_LAYOUT.boxHeight} min={24} max={4096} step={1} disabled={selectedClipLocked} onCommit={(boxHeight) => updateTextLayout({ boxHeight })} testId="text-box-height-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={zhCN.inspector.fields.paragraphSpacing} value={textLayout?.paragraphSpacing ?? DEFAULT_TEXT_LAYOUT.paragraphSpacing} min={0} max={240} step={1} disabled={selectedClipLocked} onCommit={(paragraphSpacing) => updateTextLayout({ paragraphSpacing })} testId="text-paragraph-spacing-input" />
            <NumberField label={zhCN.inspector.fields.firstLineIndent} value={textLayout?.firstLineIndent ?? DEFAULT_TEXT_LAYOUT.firstLineIndent} min={-960} max={960} step={1} disabled={selectedClipLocked} onCommit={(firstLineIndent) => updateTextLayout({ firstLineIndent })} testId="text-first-line-indent-input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ToggleField label={zhCN.inspector.fields.openTypeLiga} checked={textOpenTypeFeatures?.liga ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.liga} disabled={selectedClipLocked} onCommit={(liga) => updateTextOpenTypeFeatures({ liga })} testId="text-opentype-liga-toggle" />
            <ToggleField label={zhCN.inspector.fields.openTypeSmcp} checked={textOpenTypeFeatures?.smcp ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.smcp} disabled={selectedClipLocked} onCommit={(smcp) => updateTextOpenTypeFeatures({ smcp })} testId="text-opentype-smcp-toggle" />
            <ToggleField label={zhCN.inspector.fields.openTypeTnum} checked={textOpenTypeFeatures?.tnum ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.tnum} disabled={selectedClipLocked} onCommit={(tnum) => updateTextOpenTypeFeatures({ tnum })} testId="text-opentype-tnum-toggle" />
            <ToggleField label={zhCN.inspector.fields.openTypeSwsh} checked={textOpenTypeFeatures?.swsh ?? DEFAULT_TEXT_OPEN_TYPE_FEATURES.swsh} disabled={selectedClipLocked} onCommit={(swsh) => updateTextOpenTypeFeatures({ swsh })} testId="text-opentype-swsh-toggle" />
          </div>
          <ToggleField label={zhCN.inspector.fields.arcTextMode} checked={textArc?.enabled ?? DEFAULT_TEXT_ARC.enabled} disabled={selectedClipLocked} onCommit={(enabled) => updateTextArc({ enabled })} testId="arc-text-toggle" />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={zhCN.inspector.fields.arcTextRadius} value={textArc?.radius ?? DEFAULT_TEXT_ARC.radius} min={24} max={4000} step={1} disabled={selectedClipLocked} onCommit={(radius) => updateTextArc({ radius })} testId="arc-text-radius-input" />
            <NumberField label={zhCN.inspector.fields.arcTextStartAngle} value={textArc?.startAngle ?? DEFAULT_TEXT_ARC.startAngle} min={-360} max={360} step={1} disabled={selectedClipLocked} onCommit={(startAngle) => updateTextArc({ startAngle })} testId="arc-text-start-angle-input" />
          </div>
          <ToggleField label={zhCN.inspector.fields.arcTextRotateCharacters} checked={textArc?.rotateCharacters ?? DEFAULT_TEXT_ARC.rotateCharacters} disabled={selectedClipLocked} onCommit={(rotateCharacters) => updateTextArc({ rotateCharacters })} testId="arc-text-rotate-toggle" />
        </div>
      </details>

      {/* Path Text */}
      <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="path-text-section" open>
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.sections.pathText}</summary>
        <div className="space-y-3 border-t border-line p-2">
          <ToggleField label={zhCN.inspector.fields.pathTextMode} checked={textPath?.enabled ?? false} onCommit={(enabled) => updateTextPath({ enabled })} testId="path-text-toggle" />
          <RangeNumberField label={zhCN.inspector.fields.pathTextStartOffset} value={textPath?.startOffset ?? DEFAULT_TEXT_PATH.startOffset} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onCommit={(startOffset) => updateTextPath({ startOffset })} testId="path-text-start-offset-input" />
          <RangeNumberField label={zhCN.inspector.fields.pathTextLetterSpacing} value={textPath?.letterSpacing ?? DEFAULT_TEXT_PATH.letterSpacing} min={0} max={80} step={1} format={(value) => `${Math.round(value)}px`} onCommit={(letterSpacing) => updateTextPath({ letterSpacing })} testId="path-text-letter-spacing-input" />
          <ToggleField label={zhCN.inspector.fields.pathTextRotateCharacters} checked={textPath?.rotateCharacters ?? true} onCommit={(rotateCharacters) => updateTextPath({ rotateCharacters })} testId="path-text-rotate-toggle" />
          <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="path-text-point-summary">{zhCN.inspector.fields.pathPointCount(textPath?.path.length ?? DEFAULT_TEXT_PATH.path.length)}</div>
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel" type="button" data-testid="path-text-offset-keyframe-button" onClick={() => addKeyframe('pathStartOffset', textPath?.startOffset ?? DEFAULT_TEXT_PATH.startOffset)}>{zhCN.inspector.pathText.addOffsetKeyframe}</button>
        </div>
      </details>

      {/* Text Animation */}
      <details className="rounded-md border border-line bg-[var(--color-bg-elevated)]" data-testid="text-animation-section" open>
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">{zhCN.inspector.sections.textAnimation}</summary>
        <div className="space-y-3 border-t border-line p-2">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.animationPreset}
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={textAnimationPreset} data-testid="text-animation-preset-select" onChange={(event) => setTextAnimationPreset(event.target.value as TextAnimationPreset)}>
              {TEXT_ANIMATION_PRESETS.map((preset) => (<option key={preset} value={preset}>{zhCN.inspector.textAnimation.presets[preset]}</option>))}
            </select>
          </label>
          <RangeNumberField label={zhCN.inspector.fields.animationDuration} value={textAnimationDuration} min={0.1} max={2} step={0.1} format={(value) => `${value.toFixed(1)}s`} onCommit={setTextAnimationDuration} testId="text-animation-duration-input" />
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {zhCN.inspector.fields.animationDirection}
            <select className="mt-1 w-full rounded-lg border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]" value={textAnimationDirection} data-testid="text-animation-direction-select" onChange={(event) => setTextAnimationDirection(event.target.value as TextAnimationDirection)}>
              {TEXT_ANIMATION_DIRECTIONS.map((direction) => (<option key={direction} value={direction}>{zhCN.inspector.textAnimation.directions[direction]}</option>))}
            </select>
          </label>
          <div className="rounded-md bg-panel p-2 text-xs text-[var(--color-text-secondary)]" data-testid="text-animation-keyframe-summary">{zhCN.inspector.textAnimation.keyframeCount(textAnimationKeyframeCount)}</div>
          <button className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-panel" type="button" data-testid="apply-text-animation-button" onClick={applyTextAnimation}>{zhCN.inspector.textAnimation.apply}</button>
        </div>
      </details>
    </>
  );
}

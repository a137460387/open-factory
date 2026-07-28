import {CLIP_GROUP_COLORS, CLIP_GROUP_COLOR_HEX, TIMELINE_LABEL_COLORS, getTimelineLabelColorHex, isFrameRateMismatch, type Clip, type ClipGroup, type ClipGroupColor, type MediaAsset, type MediaVersionEntry, type TimelineLabelColor} from '@open-factory/editor-core';
import {clsx} from 'clsx';
import {zhCN} from '../../i18n/strings';
import {canGenerateSubtitlesForClip} from '../../lib/whisper';
import type {ClipMenuState} from './TimelineMenus';

export function ClipActionMenu({
  menu,
  clip,
  asset,
  versionEntries,
  group,
  projectFrameRate,
  canCreateGroup,
  whisperReady,
  whisperUnavailableMessage,
  onSilence,
  onScene,
  onGenerateCover,
  onGenerateSubtitles,
  onAlignSubtitles,
  onTtsVoiceover,
  onReplaceMedia,
  onSwitchVersion,
  onConvertFrameRate,
  onPack,
  onAiReframe,
  onAiTransitionRecommend,
  onAnomalyDetect,
  onCreateGroup,
  onUngroup,
  onDeleteGroup,
  onGroupColor,
  onClipColor,
  onDelete,
  onRippleDelete,
  onRoughCutCompare,
  onClose,
}: {
  menu: ClipMenuState;
  clip?: Clip;
  asset?: MediaAsset;
  versionEntries: MediaVersionEntry[];
  group?: ClipGroup;
  projectFrameRate: number;
  canCreateGroup: boolean;
  whisperReady: boolean;
  whisperUnavailableMessage?: string;
  onSilence(): void;
  onScene(): void;
  onGenerateCover(): void;
  onGenerateSubtitles(): void;
  onAlignSubtitles(): void;
  onTtsVoiceover(): void;
  onReplaceMedia(): void;
  onSwitchVersion(mediaId: string): void;
  onConvertFrameRate(): void;
  onPack(): void;
  onAiReframe(): void;
  onAiTransitionRecommend(): void;
  onAnomalyDetect(): void;
  onCreateGroup(): void;
  onUngroup(group: ClipGroup): void;
  onDeleteGroup(group: ClipGroup): void;
  onGroupColor(group: ClipGroup, color: ClipGroupColor): void;
  onClipColor(clipId: string, color: TimelineLabelColor | null): void;
  onDelete(): void;
  onRippleDelete(): void;
  onRoughCutCompare?(): void;
  onClose(): void;
}) {
  const canDetectSilence = Boolean(clip && (clip.type === 'audio' || (clip.type === 'video' && asset?.hasAudio)));
  const canDetectScene = clip?.type === 'video';
  const canGenerateCover = clip?.type === 'video' && asset?.type === 'video';
  const canGenerateSubtitles = canGenerateSubtitlesForClip(clip, asset, whisperReady);
  const canAlignSubtitles = clip?.type === 'subtitle';
  const canTtsVoiceover = clip?.type === 'subtitle';
  const canReplaceMedia = Boolean(clip && (clip.type === 'video' || clip.type === 'audio' || clip.type === 'image'));
  const canConvertFrameRate = Boolean(
    asset?.type === 'video' && (asset.variableFrameRate || isFrameRateMismatch(asset.frameRate, projectFrameRate)),
  );
  const currentMediaId = clip && 'mediaId' in clip ? clip.mediaId : undefined;
  return (
    <div
      className="fixed z-50 max-h-[80vh] w-[230px] overflow-y-auto rounded-md border border-line bg-[var(--color-bg-elevated)] p-2 text-xs shadow-soft"
      style={{ left: menu.x, top: menu.y }}
      data-testid="clip-action-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectSilence}
        data-testid="clip-action-silence"
        onClick={onSilence}
      >
        {zhCN.timeline.silenceAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canDetectScene}
        data-testid="clip-action-scene"
        onClick={onScene}
      >
        {zhCN.timeline.sceneAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canGenerateCover}
        data-testid="clip-action-generate-cover"
        onClick={onGenerateCover}
      >
        {zhCN.timeline.generateCoverFramesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canGenerateSubtitles}
        title={!canGenerateSubtitles ? whisperUnavailableMessage : undefined}
        data-testid="clip-action-generate-subtitles"
        onClick={onGenerateSubtitles}
      >
        {zhCN.timeline.generateSubtitlesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canAlignSubtitles}
        data-testid="clip-action-align-subtitles"
        onClick={onAlignSubtitles}
      >
        {zhCN.timeline.alignSubtitlesAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canTtsVoiceover}
        data-testid="clip-action-tts-voiceover"
        onClick={onTtsVoiceover}
      >
        {zhCN.aiTts.subtitleToVoiceover}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-ai-reframe"
        onClick={onAiReframe}
      >
        {zhCN.toolbar.aiSmartReframe}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-ai-transition"
        onClick={onAiTransitionRecommend}
      >
        {zhCN.toolbar.aiRecommendTransition}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={clip?.type !== 'video'}
        data-testid="clip-action-anomaly-detect"
        onClick={onAnomalyDetect}
      >
        {zhCN.toolbar.detectAnomalies}
      </button>
      {onRoughCutCompare ? (
        <button
          className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
          type="button"
          disabled={clip?.type !== 'video'}
          data-testid="clip-action-rough-cut-compare"
          onClick={onRoughCutCompare}
        >
          生成粗剪方案
        </button>
      ) : null}
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canReplaceMedia}
        data-testid="clip-action-replace-media"
        onClick={onReplaceMedia}
      >
        {zhCN.timeline.replaceMediaAction}
      </button>
      {versionEntries.length > 1 ? (
        <div className="rounded-md border border-line bg-panel px-2 py-2" data-testid="clip-media-version-menu">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.switchMediaVersionAction}
          </div>
          <div className="grid gap-1">
            {versionEntries.map((entry) => (
              <button
                key={entry.id}
                className={clsx(
                  'flex min-w-0 items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-[var(--color-bg-elevated)] disabled:opacity-60',
                  currentMediaId === entry.assetId
                    ? 'bg-[var(--color-bg-elevated)] font-semibold text-brand'
                    : 'text-[var(--color-text-secondary)]',
                )}
                type="button"
                disabled={currentMediaId === entry.assetId}
                data-testid={`clip-switch-version-${entry.assetId}`}
                onClick={() => onSwitchVersion(entry.assetId)}
              >
                <span>{entry.label}</span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canConvertFrameRate}
        data-testid="clip-action-convert-frame-rate"
        onClick={onConvertFrameRate}
      >
        {zhCN.timeline.convertFrameRateAction}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!clip}
        data-testid="clip-action-pack-nested"
        onClick={onPack}
      >
        {zhCN.timeline.packNestedSequence}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="clip-action-delete"
        onClick={onDelete}
      >
        {zhCN.timeline.deleteSelectedClip}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        data-testid="clip-action-ripple-delete"
        onClick={onRippleDelete}
      >
        {zhCN.timeline.rippleDeleteClip}
      </button>
      <div className="my-1 border-t border-line" />
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!canCreateGroup}
        data-testid="clip-action-create-group"
        onClick={onCreateGroup}
      >
        {zhCN.timeline.clipGroupCreate}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left hover:bg-panel disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-ungroup"
        onClick={() => group && onUngroup(group)}
      >
        {zhCN.timeline.clipGroupUngroup}
      </button>
      <button
        className="block w-full rounded px-2 py-2 text-left text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        type="button"
        disabled={!group}
        data-testid="clip-action-delete-group"
        onClick={() => group && onDeleteGroup(group)}
      >
        {zhCN.timeline.clipGroupDelete}
      </button>
      {clip ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-label-color-options">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.clipLabelColor}
          </div>
          <div className="flex flex-wrap gap-1">
            {TIMELINE_LABEL_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${clip.colorLabel === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.timelineLabelColorNames[color]}
                style={{ backgroundColor: getTimelineLabelColorHex(color) }}
                data-testid={`clip-label-color-${color}`}
                onClick={() => onClipColor(clip.id, color)}
              />
            ))}
          </div>
          <button
            className="mt-1 rounded border border-line px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-panel"
            type="button"
            data-testid="clip-label-color-clear"
            onClick={() => onClipColor(clip.id, null)}
          >
            {zhCN.timeline.defaultLabelColor}
          </button>
        </div>
      ) : null}
      {group ? (
        <div className="px-2 pb-1 pt-2" data-testid="clip-group-color-options">
          <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {zhCN.timeline.clipGroupColor}
          </div>
          <div className="flex gap-1">
            {CLIP_GROUP_COLORS.map((color) => (
              <button
                key={color}
                className={`h-5 w-5 rounded-full border ${group.color === color ? 'border-line ring-2 ring-[var(--color-border)]' : 'border-white'}`}
                type="button"
                title={zhCN.timeline.clipGroupColorNames[color]}
                style={{ backgroundColor: CLIP_GROUP_COLOR_HEX[color] }}
                data-testid={`clip-group-color-${color}`}
                onClick={() => onGroupColor(group, color)}
              />
            ))}
          </div>
        </div>
      ) : null}
      <button
        className="mt-1 block w-full rounded px-2 py-1.5 text-left text-[var(--color-text-muted)] hover:bg-panel"
        type="button"
        onClick={onClose}
      >
        {zhCN.timeline.close}
      </button>
    </div>
  );
}

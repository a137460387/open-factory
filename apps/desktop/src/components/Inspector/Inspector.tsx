import { useMemo } from 'react';
import type { Clip, ClipGroup, MediaAsset, ProjectSettings, ProjectSpeaker } from '@open-factory/editor-core';
import {
  BatchUpdateClipGroupClipsCommand,
  UpdateClipCommand,
  UpdateProjectSpeakerLabelsCommand,
  performSpeakerDiarization,
  MIN_CLIP_SPEED,
  MAX_CLIP_SPEED,
  getClipSpeed,
  getTimelineDuration,
  normalizeColorCorrection,
  normalizeClipGroups,
  findCompleteClipGroup,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { commandManager, projectAccessor, timelineAccessor } from '../../store/commandManager';
import { showToast } from '../../lib/toast';
import { SubtitleAIPolishPanel } from './SubtitleAIPolishPanel';
import { ChapterTitleAIPanel } from './ChapterTitleAIPanel';
import { useEditorStore, type SelectedKeyframeRef } from '../../store/editorStore';
import { PanelTitle, Section, NumberField, RangeField, RangeNumberField } from './InspectorFields';
import { SubtitleProofreadingPanel, SubtitleRetimingPanel } from './InspectorEditors';
import { useClipInspectorState } from './useClipInspectorState';
import { ClipInspectorBody } from './ClipInspectorBody';

interface InspectorProps {
  clip?: Clip;
  selectedClips?: Clip[];
  selectedCount: number;
  selectedClipLocked: boolean;
  selectedKeyframe?: SelectedKeyframeRef;
  selectedKeyframes?: SelectedKeyframeRef[];
  media: MediaAsset[];
  playheadTime: number;
  projectSettings: ProjectSettings;
}

export function Inspector({
  clip,
  selectedClips = [],
  selectedCount,
  selectedClipLocked,
  selectedKeyframe,
  selectedKeyframes = [],
  media,
  playheadTime,
  projectSettings,
}: InspectorProps) {
  const project = useEditorStore((state) => state.project);
  const selectedSubtitleClips = selectedClips.filter(
    (item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle',
  );
  const allTimelineSubtitleClips = useMemo(() => {
    return project.timeline.tracks
      .flatMap((track) => track.clips)
      .filter((c): c is Extract<Clip, { type: 'subtitle' }> => c.type === 'subtitle')
      .sort((a, b) => a.start - b.start);
  }, [project.timeline.tracks]);
  function handleSpeakerDiarization(): void {
    if (allTimelineSubtitleClips.length === 0) return;
    const segments = allTimelineSubtitleClips.map((c) => ({
      id: c.id,
      start: c.start,
      end: c.start + c.duration,
      text: c.text ?? '',
      zeroCrossingRate: 0.3 + ((c.start * 10) % 5) * 0.1,
    }));
    const result = performSpeakerDiarization(segments);
    for (const assignment of result.assignments) {
      commandManager.execute(
        new UpdateClipCommand(timelineAccessor, assignment.segmentId, { speakerId: assignment.speakerId }),
      );
    }
    const existingLabels = project.speakerLabels ?? {};
    const mergedLabels: Record<number, string> = { ...existingLabels };
    for (const [id, label] of Object.entries(result.speakerLabels)) {
      if (!(Number(id) in mergedLabels)) {
        mergedLabels[Number(id)] = label;
      }
    }
    commandManager.execute(new UpdateProjectSpeakerLabelsCommand(projectAccessor, mergedLabels));
    showToast({
      kind: 'success',
      title: zhCN.subtitleSpeakerDiarization.complete(Object.keys(result.speakerLabels).length),
      message: '',
    });
  }
  const selectedGroup = useMemo(() => {
    const groups = normalizeClipGroups(
      project.clipGroups,
      project.timeline.tracks.flatMap((track) => track.clips.map((item) => item.id)),
    );
    return findCompleteClipGroup(
      groups,
      selectedClips.map((item) => item.id),
    );
  }, [project.clipGroups, project.timeline.tracks, selectedClips]);
  if (!clip && selectedCount > 1) {
    if (selectedGroup) {
      return (
        <ClipGroupInspectorPanel group={selectedGroup} clips={selectedClips} selectedClipLocked={selectedClipLocked} />
      );
    }
    if (selectedSubtitleClips.length === selectedCount) {
      return (
        <aside className="flex min-h-0 flex-col bg-panel">
          <PanelTitle />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <SubtitleProofreadingPanel
              selectedSubtitleClips={selectedSubtitleClips}
              selectedClipLocked={selectedClipLocked}
              projectSettings={projectSettings}
            />
            <SubtitleRetimingPanel selectedSubtitleClips={selectedSubtitleClips} projectSettings={projectSettings} />
            <SubtitleAIPolishPanel
              selectedSubtitleClips={selectedSubtitleClips}
              selectedClipLocked={selectedClipLocked}
            />
            {allTimelineSubtitleClips.length > 0 ? (
              <button
                className="mt-2 w-full rounded border border-line px-3 py-2 text-xs hover:bg-panel"
                onClick={handleSpeakerDiarization}
                data-testid="subtitle-speaker-diarization-btn"
              >
                {zhCN.subtitleSpeakerDiarization.button}
              </button>
            ) : null}
            <ChapterTitleAIPanel
              allSubtitleClips={allTimelineSubtitleClips}
              totalDuration={getTimelineDuration(project.timeline)}
              selectedClipLocked={selectedClipLocked}
            />
          </div>
        </aside>
      );
    }
    return (
      <aside className="flex min-h-0 flex-col bg-panel">
        <PanelTitle />
        <div
          className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--color-text-muted)]"
          data-testid="inspector-multiple-selection-state"
        >
          {zhCN.inspector.multipleSelected(selectedCount)}
        </div>
      </aside>
    );
  }

  if (!clip) {
    return (
      <aside className="flex min-h-0 flex-col bg-panel">
        <PanelTitle />
        <div
          className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--color-text-muted)]"
          data-testid="inspector-empty-state"
        >
          {zhCN.inspector.empty}
        </div>
      </aside>
    );
  }

  return (
    <ClipInspector
      clip={clip}
      selectedCount={selectedCount}
      selectedClipLocked={selectedClipLocked}
      selectedKeyframe={selectedKeyframe}
      selectedKeyframes={selectedKeyframes}
      media={media}
      playheadTime={playheadTime}
      projectSettings={projectSettings}
      selectedSubtitleClips={selectedSubtitleClips}
    />
  );
}

function ClipGroupInspectorPanel({
  group,
  clips,
  selectedClipLocked,
}: {
  group: ClipGroup;
  clips: Clip[];
  selectedClipLocked: boolean;
}) {
  const t = zhCN.inspector.clipGroup;
  const firstClip = clips[0];
  const volumeClip = clips.find((item): item is Extract<Clip, { volume: number }> => 'volume' in item);
  const speedClip = clips.find(
    (item) => item.type === 'video' || item.type === 'audio' || item.type === 'nested-sequence',
  );
  const colorCorrection = normalizeColorCorrection(firstClip?.colorCorrection);
  const commit = (patch: ConstructorParameters<typeof BatchUpdateClipGroupClipsCommand>[2]) => {
    try {
      commandManager.execute(new BatchUpdateClipGroupClipsCommand(projectAccessor, group.id, patch));
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  return (
    <aside className="flex min-h-0 flex-col bg-panel">
      <PanelTitle />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-testid="inspector-clip-group-panel">
        <Section title={t.title}>
          <div
            className="rounded-md border border-line bg-panel p-3 text-sm text-[var(--color-text-secondary)]"
            data-testid="inspector-clip-group-state"
          >
            <div className="font-semibold">{t.summary(clips.length)}</div>
            <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{group.name}</div>
          </div>
        </Section>
        {volumeClip ? (
          <Section title={t.audio}>
            <RangeField
              label={zhCN.inspector.fields.volume}
              value={volumeClip.volume}
              min={0}
              max={2}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onCommit={(volume) => commit({ volume })}
              testId="clip-group-volume-input"
            />
          </Section>
        ) : null}
        {speedClip ? (
          <Section title={zhCN.inspector.sections.speed}>
            <RangeNumberField
              label={zhCN.inspector.fields.speed}
              value={getClipSpeed(speedClip)}
              min={MIN_CLIP_SPEED}
              max={MAX_CLIP_SPEED}
              step={0.05}
              format={(value) => `${value.toFixed(2)}x`}
              disabled={selectedClipLocked}
              onCommit={(speed) => commit({ speed })}
              testId="clip-group-speed-input"
            />
          </Section>
        ) : null}
        <Section title={zhCN.inspector.fields.colorCorrection}>
          <NumberField
            label={zhCN.inspector.fields.brightness}
            value={colorCorrection.brightness}
            min={-1}
            max={1}
            step={0.05}
            onCommit={(brightness) => commit({ colorCorrection: { brightness } })}
            testId="clip-group-brightness-input"
          />
          <NumberField
            label={zhCN.inspector.fields.contrast}
            value={colorCorrection.contrast}
            min={0}
            max={3}
            step={0.05}
            onCommit={(contrast) => commit({ colorCorrection: { contrast } })}
          />
          <NumberField
            label={zhCN.inspector.fields.saturation}
            value={colorCorrection.saturation}
            min={0}
            max={3}
            step={0.05}
            onCommit={(saturation) => commit({ colorCorrection: { saturation } })}
          />
        </Section>
      </div>
    </aside>
  );
}

function ClipInspector({
  clip,
  selectedClipLocked,
  selectedKeyframe,
  selectedKeyframes = [],
  media,
  playheadTime,
  projectSettings,
  selectedSubtitleClips,
}: InspectorProps & { clip: Clip; selectedSubtitleClips: Array<Extract<Clip, { type: 'subtitle' }>> }) {
  const state = useClipInspectorState({
    clip,
    selectedClipLocked,
    selectedKeyframe,
    selectedKeyframes,
    media,
    playheadTime,
    projectSettings,
    selectedSubtitleClips,
  });

  return (
    <ClipInspectorBody
      clip={clip}
      selectedClipLocked={selectedClipLocked}
      selectedKeyframe={selectedKeyframe}
      selectedKeyframes={selectedKeyframes}
      media={media}
      playheadTime={playheadTime}
      projectSettings={projectSettings}
      selectedSubtitleClips={selectedSubtitleClips}
      {...state}
    />
  );
}

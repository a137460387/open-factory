import {
  AddTrackCommand,
  BrollInsertCommand,
  DialogueRoughCutCommand,
  RemoveSilenceCommand,
  RhythmAssembleCommand,
  SplitClipAtTimesCommand,
  buildBrollInsertClips,
  createTrack,
  getClipSpeed,
  round,
  type Clip,
  type MediaAsset,
  type Project,
  type SilentRange,
  type SmartRoughCutBrollCandidate,
  type SmartRoughCutVisualClip,
  type Timeline,
  type Track,
} from '@open-factory/editor-core';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { zhCN } from '../../i18n/strings';
import { detectClipDialogue } from '../../lib/dialogueDetection';
import { detectClipSilence } from '../../lib/silenceDetection';
import { detectSceneChanges } from '../../lib/tauri-bridge';
import {
  buildWhisperSubtitleTrackForClip,
  canGenerateSubtitlesForClip,
  getWhisperAvailability,
  type WhisperAvailability,
} from '../../lib/whisper';
import { showToast } from '../../lib/toast';
import { commandManager, timelineAccessor } from '../../store/commandManager';
import { useEditorStore } from '../../store/editorStore';
import { useWhisperSettingsStore } from '../../store/whisperSettingsStore';
import {
  createInitialSmartRoughCutState,
  createSmartRoughCutSelection,
  getSelectedSmartRoughCutIds,
  markSmartRoughCutStepComplete,
  markSmartRoughCutStepError,
  markSmartRoughCutStepRunning,
  setAllSmartRoughCutSelection,
  type SmartRoughCutStep,
  type SmartRoughCutSelection,
  type SmartRoughCutStepStatus,
} from './smart-rough-cut-state';

interface SmartRoughCutPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
}

interface SceneCandidate {
  id: string;
  start: number;
  end: number;
  splitTime?: number;
  thumbnail?: string;
}

interface SilenceCandidate {
  id: string;
  range: SilentRange;
}

type SmartRoughCutTab = 'basic' | 'dialogue' | 'broll' | 'rhythm';

export function SmartRoughCutPanel({ selectedClip, media }: SmartRoughCutPanelProps) {
  const [state, setState] = useState(createInitialSmartRoughCutState);
  const [pendingScene, setPendingScene] = useState<{
    clipId: string;
    items: SceneCandidate[];
    selection: SmartRoughCutSelection;
  }>();
  const [pendingSilence, setPendingSilence] = useState<{
    clipId: string;
    items: SilenceCandidate[];
    selection: SmartRoughCutSelection;
  }>();
  const [activeTab, setActiveTab] = useState<SmartRoughCutTab>('basic');
  const [brollTrackId, setBrollTrackId] = useState('');
  const [rhythmTrackId, setRhythmTrackId] = useState('');
  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({
    ready: false,
    error: zhCN.whisper.notConfigured,
  });
  const whisperExecutablePath = useWhisperSettingsStore((item) => item.executablePath);
  const whisperModelPath = useWhisperSettingsStore((item) => item.modelPath);
  const project = useEditorStore((item) => item.project);
  const selectedClipIds = useEditorStore((item) => item.selectedClipIds);
  const setSelectedClipId = useEditorStore((item) => item.setSelectedClipId);
  const timeline = project.timeline;
  const asset = useMemo(() => getClipMediaAsset(selectedClip, media), [selectedClip, media]);
  const selectedTimelineClips = useMemo(
    () => getTimelineClips(timeline).filter((clip) => selectedClipIds.includes(clip.id)),
    [selectedClipIds, timeline],
  );
  const selectedVisualClips = useMemo(() => selectedTimelineClips.filter(isVisualClip), [selectedTimelineClips]);
  const mainVisualClips = useMemo(
    () => getPrimaryVisualClips(timeline, selectedVisualClips),
    [selectedVisualClips, timeline],
  );
  const videoTracks = useMemo(() => timeline.tracks.filter((track) => track.type === 'video'), [timeline]);
  const rhythmBeatTimes = useMemo(
    () => getRhythmBeatTimes(project, selectedTimelineClips),
    [project, selectedTimelineClips],
  );
  const anyRunning = Object.values(state.steps).some((step) => step.status === 'running');
  const canRunScene = selectedClip?.type === 'video' && Boolean(asset);
  const canRunSilence = Boolean(
    selectedClip && asset && (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)),
  );
  const canRunWhisper = canGenerateSubtitlesForClip(selectedClip, asset, whisperAvailability.ready);
  const canRunDialogue = Boolean(
    selectedClip && asset && (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)),
  );
  const canRunBroll = mainVisualClips.length > 0 && buildBrollCandidates(media, selectedTimelineClips).length > 0;
  const canRunRhythm = selectedVisualClips.length > 0 && rhythmBeatTimes.length >= 2;

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then(
      (availability) => {
        if (!disposed) {
          setWhisperAvailability(availability);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [whisperExecutablePath, whisperModelPath]);

  useEffect(() => {
    if (rhythmTrackId && videoTracks.some((track) => track.id === rhythmTrackId)) {
      return;
    }
    setRhythmTrackId(selectedVisualClips[0]?.trackId ?? videoTracks[0]?.id ?? '');
  }, [rhythmTrackId, selectedVisualClips, videoTracks]);

  async function runSceneDetection(): Promise<void> {
    await runStep('scene', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('scene');
      if (clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.sceneUnavailable);
      }
      const speed = getClipSpeed(clip);
      const sourceStart = clip.trimStart;
      const sourceEnd = sourceStart + clip.duration * speed;
      const result = await detectSceneChanges({
        path: mediaAsset.path,
        threshold: 0.3,
        duration: mediaAsset.duration || clip.duration,
      });
      const splitTimes = result.sceneTimes
        .filter((time) => time > sourceStart + 0.000001 && time < sourceEnd - 0.000001)
        .map((time) => round((time - sourceStart) / speed));
      const items = buildSceneCandidates(splitTimes, clip.duration, mediaAsset.thumbnail);
      setPendingScene({
        clipId: clip.id,
        items,
        selection: createSmartRoughCutSelection(items.map((item) => item.id)),
      });
      return {};
    });
  }

  async function runSilenceDetection(): Promise<void> {
    await runStep('silence', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('silence');
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.silenceUnavailable);
      }
      if (clip.type === 'video' && !mediaAsset.hasAudio) {
        throw new Error(zhCN.smartRoughCut.silenceUnavailable);
      }
      const ranges = await detectClipSilence(clip, mediaAsset, {
        thresholdDb: -40,
        minSilenceDuration: 0.5,
        marginDuration: 0.1,
      });
      const items = ranges.map((range, index) => ({ id: `silence-${index}`, range }));
      setPendingSilence({
        clipId: clip.id,
        items,
        selection: createSmartRoughCutSelection(items.map((item) => item.id)),
      });
      return {};
    });
  }

  function applySceneSplit(): void {
    if (!pendingScene) {
      return;
    }
    try {
      const selectedIds = new Set(getSelectedSmartRoughCutIds(pendingScene.selection));
      const splitTimes = pendingScene.items
        .filter((item) => selectedIds.has(item.id) && typeof item.splitTime === 'number')
        .map((item) => item.splitTime!);
      if (splitTimes.length > 0) {
        commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, pendingScene.clipId, splitTimes));
      }
      setState((current) => markSmartRoughCutStepComplete(current, 'scene', { sceneSplits: splitTimes.length }));
      setPendingScene(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, 'scene', message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.scene), message });
    }
  }

  function applySilenceRemoval(): void {
    if (!pendingSilence) {
      return;
    }
    try {
      const selectedIds = new Set(getSelectedSmartRoughCutIds(pendingSilence.selection));
      const ranges = pendingSilence.items.filter((item) => selectedIds.has(item.id)).map((item) => item.range);
      if (ranges.length > 0) {
        commandManager.execute(new RemoveSilenceCommand(timelineAccessor, pendingSilence.clipId, ranges));
      }
      setState((current) =>
        markSmartRoughCutStepComplete(current, 'silence', { removedSilenceSeconds: sumSilentDuration(ranges) }),
      );
      setPendingSilence(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, 'silence', message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps.silence), message });
    }
  }

  async function runWhisper(): Promise<void> {
    await runStep('whisper', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('whisper');
      const availability = await getWhisperAvailability({
        executablePath: whisperExecutablePath,
        modelPath: whisperModelPath,
      });
      if (!availability.ready) {
        throw new Error(availability.error ?? zhCN.whisper.notConfigured);
      }
      if ((clip.type !== 'audio' && clip.type !== 'video') || !canGenerateSubtitlesForClip(clip, mediaAsset, true)) {
        throw new Error(zhCN.smartRoughCut.whisperUnavailable);
      }
      const track = await buildWhisperSubtitleTrackForClip(
        clip,
        mediaAsset,
        useEditorStore.getState().project.timeline,
        {
          executablePath: whisperExecutablePath,
          modelPath: whisperModelPath,
        },
      );
      if (track.clips.length === 0) {
        throw new Error(zhCN.whisper.noSubtitleCues);
      }
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      setSelectedClipId(track.clips[0]?.id);
      return { subtitleClips: track.clips.length };
    });
  }

  async function runDialogueRoughCut(): Promise<void> {
    await runStep('dialogue', async () => {
      const { clip, mediaAsset } = requireSelectedMedia('dialogue');
      if (clip.type !== 'audio' && clip.type !== 'video') {
        throw new Error(zhCN.smartRoughCut.dialogueUnavailable);
      }
      if (clip.type === 'video' && !mediaAsset.hasAudio) {
        throw new Error(zhCN.smartRoughCut.dialogueUnavailable);
      }
      const intervals = await detectClipDialogue(clip, mediaAsset, 'medium');
      const command = new DialogueRoughCutCommand(timelineAccessor, clip.id, intervals);
      commandManager.execute(command);
      setSelectedClipId(`${clip.id}-dialogue-1`);
      return { dialogueClips: command.clipCount };
    });
  }

  async function runBrollInsert(): Promise<void> {
    await runStep('broll', async () => {
      const candidates = buildBrollCandidates(media, selectedTimelineClips);
      const targetTrackId = brollTrackId || 'track-broll-auto';
      ensureVideoTrack(targetTrackId, zhCN.smartRoughCut.steps.broll);
      const clips = buildBrollInsertClips(mainVisualClips, candidates, targetTrackId);
      if (clips.length === 0) {
        throw new Error(zhCN.smartRoughCut.brollUnavailable);
      }
      commandManager.execute(new BrollInsertCommand(timelineAccessor, clips));
      setSelectedClipId(clips[0]?.id);
      return { brollClips: clips.length };
    });
  }

  async function runRhythmAssemble(): Promise<void> {
    await runStep('rhythm', async () => {
      const targetTrackId = rhythmTrackId || selectedVisualClips[0]?.trackId || videoTracks[0]?.id;
      if (!targetTrackId || selectedVisualClips.length === 0 || rhythmBeatTimes.length < 2) {
        throw new Error(zhCN.smartRoughCut.rhythmUnavailable);
      }
      const command = new RhythmAssembleCommand(
        timelineAccessor,
        selectedVisualClips.map((clip) => clip.id),
        rhythmBeatTimes,
        targetTrackId,
      );
      commandManager.execute(command);
      setSelectedClipId(`${selectedVisualClips[0].id}-rhythm-1`);
      return { rhythmClips: command.clipCount };
    });
  }

  async function runStep(step: SmartRoughCutStep, execute: () => Promise<Partial<typeof state.report>>): Promise<void> {
    setState((current) => markSmartRoughCutStepRunning(current, step));
    try {
      const reportPatch = await execute();
      setState((current) => markSmartRoughCutStepComplete(current, step, reportPatch));
      showToast({ kind: 'success', title: zhCN.smartRoughCut.stepComplete(zhCN.smartRoughCut.steps[step]) });
    } catch (error) {
      const message = error instanceof Error ? error.message : zhCN.timeline.timelineRejectedMessage;
      setState((current) => markSmartRoughCutStepError(current, step, message));
      showToast({ kind: 'warning', title: zhCN.smartRoughCut.stepFailed(zhCN.smartRoughCut.steps[step]), message });
    }
  }

  function requireSelectedMedia(step: SmartRoughCutStep): { clip: Clip; mediaAsset: MediaAsset } {
    if (!selectedClip || !asset) {
      throw new Error(
        step === 'scene'
          ? zhCN.smartRoughCut.sceneUnavailable
          : step === 'silence'
            ? zhCN.smartRoughCut.silenceUnavailable
            : step === 'dialogue'
              ? zhCN.smartRoughCut.dialogueUnavailable
              : zhCN.smartRoughCut.whisperUnavailable,
      );
    }
    return { clip: selectedClip, mediaAsset: asset };
  }

  function ensureVideoTrack(trackId: string, name: string): void {
    if (timelineAccessor.getTimeline().tracks.some((track) => track.id === trackId)) {
      return;
    }
    commandManager.execute(
      new AddTrackCommand(timelineAccessor, createTrack({ id: trackId, type: 'video', name, clips: [] })),
    );
  }

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="smart-rough-cut-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{zhCN.smartRoughCut.title}</h2>
        <div className="mt-1 truncate text-xs text-slate-500" data-testid="smart-rough-cut-selected">
          {selectedClip ? selectedClip.name : zhCN.smartRoughCut.noSelection}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div
          className="mb-3 grid grid-cols-4 gap-1 rounded-md border border-line bg-panel p-1"
          data-testid="smart-rough-cut-tabs"
        >
          {(['basic', 'dialogue', 'broll', 'rhythm'] as SmartRoughCutTab[]).map((tab) => (
            <button
              key={tab}
              className={`rounded px-2 py-1.5 text-xs font-medium ${activeTab === tab ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white'}`}
              type="button"
              data-testid={`smart-rough-cut-tab-${tab}`}
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            >
              {zhCN.smartRoughCut.tabs[tab]}
            </button>
          ))}
        </div>
        {activeTab === 'basic' ? (
          <div>
            <SmartStep
              title={zhCN.smartRoughCut.steps.scene}
              description={zhCN.smartRoughCut.sceneDescription}
              status={state.steps.scene.status}
              error={state.steps.scene.error}
              testId="smart-scene"
              buttonLabel={zhCN.smartRoughCut.detectScene}
              disabled={anyRunning || !canRunScene}
              onRun={() => void runSceneDetection()}
            >
              {pendingScene ? (
                <SceneResultList
                  items={pendingScene.items}
                  selection={pendingScene.selection}
                  onSelectionChange={(selection) =>
                    setPendingScene((current) => (current ? { ...current, selection } : current))
                  }
                  onApply={applySceneSplit}
                />
              ) : null}
            </SmartStep>
            <SmartStep
              title={zhCN.smartRoughCut.steps.silence}
              description={zhCN.smartRoughCut.silenceDescription}
              status={state.steps.silence.status}
              error={state.steps.silence.error}
              testId="smart-silence"
              buttonLabel={zhCN.smartRoughCut.detectSilence}
              disabled={anyRunning || !canRunSilence}
              onRun={() => void runSilenceDetection()}
            >
              {pendingSilence ? (
                <SilenceResultList
                  items={pendingSilence.items}
                  selection={pendingSilence.selection}
                  onSelectionChange={(selection) =>
                    setPendingSilence((current) => (current ? { ...current, selection } : current))
                  }
                  onApply={applySilenceRemoval}
                />
              ) : null}
            </SmartStep>
            <SmartStep
              title={zhCN.smartRoughCut.steps.whisper}
              description={
                whisperAvailability.ready
                  ? zhCN.smartRoughCut.whisperDescription
                  : (whisperAvailability.error ?? zhCN.whisper.notConfigured)
              }
              status={state.steps.whisper.status}
              error={state.steps.whisper.error}
              testId="smart-whisper"
              buttonLabel={zhCN.smartRoughCut.generateSubtitles}
              disabled={anyRunning || !canRunWhisper}
              onRun={() => void runWhisper()}
            />
          </div>
        ) : null}
        {activeTab === 'dialogue' ? (
          <SmartStep
            title={zhCN.smartRoughCut.steps.dialogue}
            description={zhCN.smartRoughCut.dialogueDescription}
            status={state.steps.dialogue.status}
            error={state.steps.dialogue.error}
            testId="smart-dialogue"
            buttonLabel={zhCN.smartRoughCut.generateDialogueCut}
            disabled={anyRunning || !canRunDialogue}
            onRun={() => void runDialogueRoughCut()}
          />
        ) : null}
        {activeTab === 'broll' ? (
          <SmartStep
            title={zhCN.smartRoughCut.steps.broll}
            description={zhCN.smartRoughCut.brollDescription}
            status={state.steps.broll.status}
            error={state.steps.broll.error}
            testId="smart-broll"
            buttonLabel={zhCN.smartRoughCut.insertBroll}
            disabled={anyRunning || !canRunBroll}
            onRun={() => void runBrollInsert()}
          >
            <TrackSelect
              value={brollTrackId}
              tracks={videoTracks}
              autoLabel={zhCN.smartRoughCut.steps.broll}
              testId="smart-broll-track"
              onChange={setBrollTrackId}
            />
          </SmartStep>
        ) : null}
        {activeTab === 'rhythm' ? (
          <SmartStep
            title={zhCN.smartRoughCut.steps.rhythm}
            description={`${zhCN.smartRoughCut.rhythmDescription} ${zhCN.smartRoughCut.beatCount(rhythmBeatTimes.length)}`}
            status={state.steps.rhythm.status}
            error={state.steps.rhythm.error}
            testId="smart-rhythm"
            buttonLabel={zhCN.smartRoughCut.assembleRhythm}
            disabled={anyRunning || !canRunRhythm}
            onRun={() => void runRhythmAssemble()}
          >
            <TrackSelect
              value={rhythmTrackId}
              tracks={videoTracks}
              testId="smart-rhythm-track"
              onChange={setRhythmTrackId}
            />
          </SmartStep>
        ) : null}
        <div
          className="mt-3 rounded-md border border-line bg-panel p-3 text-xs text-slate-600"
          data-testid="smart-rough-cut-report"
        >
          {zhCN.smartRoughCut.report(
            state.report.removedSilenceSeconds.toFixed(1),
            state.report.sceneSplits,
            state.report.subtitleClips,
            state.report.dialogueClips,
            state.report.brollClips,
            state.report.rhythmClips,
          )}
        </div>
      </div>
    </section>
  );
}

function SmartStep({
  title,
  description,
  status,
  error,
  testId,
  buttonLabel,
  disabled,
  onRun,
  children,
}: {
  title: string;
  description: string;
  status: SmartRoughCutStepStatus;
  error?: string;
  testId: string;
  buttonLabel: string;
  disabled: boolean;
  onRun(): void;
  children?: ReactNode;
}) {
  return (
    <section className="mb-3 rounded-md border border-line bg-white p-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{title}</h3>
        <span
          className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
          data-testid={`${testId}-status`}
          data-status={status}
        >
          {zhCN.smartRoughCut.statuses[status]}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
      <button
        className="mt-2 w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
        type="button"
        disabled={disabled}
        data-testid={`${testId}-button`}
        onClick={onRun}
      >
        {buttonLabel}
      </button>
      {children}
    </section>
  );
}

function TrackSelect({
  value,
  tracks,
  autoLabel,
  testId,
  onChange,
}: {
  value: string;
  tracks: Track[];
  autoLabel?: string;
  testId: string;
  onChange(value: string): void;
}) {
  return (
    <label className="mt-2 block text-xs text-slate-600">
      <span className="mb-1 block font-medium text-slate-700">{zhCN.smartRoughCut.targetTrack}</span>
      <select
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      >
        {autoLabel ? <option value="">{autoLabel}</option> : null}
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SceneResultList({
  items,
  selection,
  onSelectionChange,
  onApply,
}: {
  items: SceneCandidate[];
  selection: SmartRoughCutSelection;
  onSelectionChange(selection: SmartRoughCutSelection): void;
  onApply(): void;
}) {
  const selectedCount = getSelectedSmartRoughCutIds(selection).length;
  return (
    <SelectableResultList
      testId="smart-scene"
      summary={zhCN.smartRoughCut.scenePreview(
        items.flatMap((item) => (typeof item.splitTime === 'number' ? [item.splitTime] : [])),
      )}
      selection={selection}
      selectedCount={selectedCount}
      totalCount={items.length}
      applyLabel={zhCN.smartRoughCut.applySelectedScene}
      onSelectionChange={onSelectionChange}
      onApply={onApply}
    >
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-2 rounded border border-line bg-white p-2"
          data-testid={`smart-scene-item-${item.id}`}
        >
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={selection[item.id] ?? false}
            onChange={(event) => onSelectionChange({ ...selection, [item.id]: event.target.checked })}
            data-testid={`smart-scene-checkbox-${item.id}`}
          />
          <span className="h-10 w-16 flex-none overflow-hidden rounded bg-slate-200">
            {item.thumbnail ? (
              <img className="h-full w-full object-cover" src={item.thumbnail} alt="" loading="lazy" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 text-slate-700">
            {zhCN.smartRoughCut.sceneRange(formatSeconds(item.start), formatSeconds(item.end))}
          </span>
        </label>
      ))}
    </SelectableResultList>
  );
}

function SilenceResultList({
  items,
  selection,
  onSelectionChange,
  onApply,
}: {
  items: SilenceCandidate[];
  selection: SmartRoughCutSelection;
  onSelectionChange(selection: SmartRoughCutSelection): void;
  onApply(): void;
}) {
  const selectedIds = new Set(getSelectedSmartRoughCutIds(selection));
  const selectedRanges = items.filter((item) => selectedIds.has(item.id)).map((item) => item.range);
  return (
    <SelectableResultList
      testId="smart-silence"
      summary={zhCN.smartRoughCut.silencePreview(selectedRanges.length, sumSilentDuration(selectedRanges).toFixed(1))}
      selection={selection}
      selectedCount={selectedRanges.length}
      totalCount={items.length}
      applyLabel={zhCN.smartRoughCut.applySelectedSilence}
      onSelectionChange={onSelectionChange}
      onApply={onApply}
    >
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center gap-2 rounded border border-line bg-white p-2"
          data-testid={`smart-silence-item-${item.id}`}
        >
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={selection[item.id] ?? false}
            onChange={(event) => onSelectionChange({ ...selection, [item.id]: event.target.checked })}
            data-testid={`smart-silence-checkbox-${item.id}`}
          />
          <span className="min-w-0 flex-1 text-slate-700">
            {zhCN.smartRoughCut.silenceRange(
              formatSeconds(item.range.start),
              formatSeconds(item.range.end),
              formatSeconds(item.range.duration),
            )}
          </span>
        </label>
      ))}
    </SelectableResultList>
  );
}

function SelectableResultList({
  testId,
  summary,
  selection,
  selectedCount,
  totalCount,
  applyLabel,
  onSelectionChange,
  onApply,
  children,
}: {
  testId: string;
  summary: string;
  selection: SmartRoughCutSelection;
  selectedCount: number;
  totalCount: number;
  applyLabel: string;
  onSelectionChange(selection: SmartRoughCutSelection): void;
  onApply(): void;
  children: ReactNode;
}) {
  return (
    <div
      className="mt-2 rounded-md border border-line bg-panel p-2 text-xs text-slate-600"
      data-testid={`${testId}-preview`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>{summary}</div>
        <div className="whitespace-nowrap text-[11px] text-slate-500">
          {zhCN.smartRoughCut.selectedCount(selectedCount, totalCount)}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="rounded-md border border-line bg-white px-2 py-1 font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid={`${testId}-select-all`}
          onClick={() => onSelectionChange(setAllSmartRoughCutSelection(selection, true))}
        >
          {zhCN.smartRoughCut.selectAll}
        </button>
        <button
          className="rounded-md border border-line bg-white px-2 py-1 font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid={`${testId}-select-none`}
          onClick={() => onSelectionChange(setAllSmartRoughCutSelection(selection, false))}
        >
          {zhCN.smartRoughCut.selectNone}
        </button>
      </div>
      <div className="mt-2 max-h-40 space-y-1 overflow-auto">{children}</div>
      <button
        className="mt-2 rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel"
        type="button"
        disabled={selectedCount === 0}
        data-testid={`${testId}-apply-button`}
        onClick={onApply}
      >
        {applyLabel}
      </button>
    </div>
  );
}

function getClipMediaAsset(clip: Clip | undefined, media: MediaAsset[]): MediaAsset | undefined {
  if (!clip || !('mediaId' in clip)) {
    return undefined;
  }
  return media.find((asset) => asset.id === clip.mediaId);
}

function getTimelineClips(timeline: Timeline): Clip[] {
  return timeline.tracks.flatMap((track) => track.clips);
}

function isVisualClip(clip: Clip): clip is SmartRoughCutVisualClip {
  return clip.type === 'video' || clip.type === 'image';
}

function getPrimaryVisualClips(
  timeline: Timeline,
  selectedVisualClips: SmartRoughCutVisualClip[],
): SmartRoughCutVisualClip[] {
  if (selectedVisualClips.length > 0) {
    return selectedVisualClips;
  }
  return (timeline.tracks.find((track) => track.type === 'video')?.clips ?? []).filter(isVisualClip);
}

function buildBrollCandidates(media: MediaAsset[], selectedClips: Clip[]): SmartRoughCutBrollCandidate[] {
  const selectedMediaIds = new Set(selectedClips.flatMap((clip) => ('mediaId' in clip ? [clip.mediaId] : [])));
  const preferred = media.filter(
    (asset) => (asset.type === 'video' || asset.type === 'image') && !asset.missing && !selectedMediaIds.has(asset.id),
  );
  const fallback =
    preferred.length > 0
      ? preferred
      : media.filter((asset) => (asset.type === 'video' || asset.type === 'image') && !asset.missing);
  return fallback.map((asset) => ({ kind: 'media', asset }));
}

function getRhythmBeatTimes(project: Project, selectedClips: Clip[]): number[] {
  const projectBeats = (project.beatMarkers ?? []).map((marker) => marker.time);
  if (projectBeats.length >= 2) {
    return projectBeats;
  }
  return selectedClips
    .flatMap((clip) => (clip.beatMarkers ?? []).map((marker) => round(clip.start + marker.time)))
    .sort((left, right) => left - right);
}

function sumSilentDuration(ranges: SilentRange[]): number {
  return round(ranges.reduce((total, range) => total + range.duration, 0));
}

function buildSceneCandidates(splitTimes: number[], duration: number, thumbnail?: string): SceneCandidate[] {
  const points = Array.from(new Set(splitTimes.map((time) => round(Math.min(duration, Math.max(0, time))))))
    .filter((time) => time > 0.000001 && time < duration - 0.000001)
    .sort((left, right) => left - right);
  const boundaries = [0, ...points, duration];
  return boundaries.slice(0, -1).map((start, index) => ({
    id: `scene-${index}`,
    start,
    end: boundaries[index + 1],
    splitTime: index < points.length ? boundaries[index + 1] : undefined,
    thumbnail,
  }));
}

function formatSeconds(value: number): string {
  return `${round(value).toFixed(2)}s`;
}

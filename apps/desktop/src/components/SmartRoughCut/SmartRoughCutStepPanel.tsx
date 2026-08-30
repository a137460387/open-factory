/**
 * 智能粗剪分步编排面板
 *
 * 分步编排 scene/silence/whisper/dialogue（broll/rhythm 保留扩展位）：
 * 每步独立运行按钮 + 状态徽标 + 结果预览 + 逐项勾选 + 命令化应用，底部累计报告。
 * 编排逻辑在 useSmartRoughCut（状态机并入 smartRoughCutOrchestratorStore.stepState），
 * 纯函数在 smart-rough-cut-utils，本文件只负责渲染。
 */
import type { Clip, MediaAsset, Track } from '@open-factory/editor-core';
import { useState, type ReactNode } from 'react';
import { zhCN } from '../../i18n/strings';
import {
  getSelectedSmartRoughCutIds,
  setAllSmartRoughCutSelection,
  type SmartRoughCutSelection,
  type SmartRoughCutStepStatus,
} from './smart-rough-cut-state';
import { formatSeconds, sumSilentDuration, type SceneCandidate, type SilenceCandidate } from './smart-rough-cut-utils';
import { useSmartRoughCut } from './useSmartRoughCut';
import { SemanticSuggestionList } from './SemanticSuggestionList';
import { SemanticSuggestionReviewDialog } from './SemanticSuggestionReviewDialog';
import type { SemanticRoughCutSuggestion } from './semantic-suggestion';

interface SmartRoughCutStepPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
}

type SmartRoughCutTab = 'basic' | 'dialogue' | 'broll' | 'rhythm';

export function SmartRoughCutStepPanel({ selectedClip, media }: SmartRoughCutStepPanelProps) {
  const [activeTab, setActiveTab] = useState<SmartRoughCutTab>('basic');
  // 审阅目标在打开时快照：采纳会以新 id 切片替换原 clip，实时 selectedClip
  // 随之失联；快照保证审阅/反馈不因时间线变更被卸载
  const [reviewTarget, setReviewTarget] = useState<{ suggestion: SemanticRoughCutSuggestion; clip: Clip } | null>(null);
  const {
    stepState,
    pendingScene,
    setPendingScene,
    pendingSilence,
    setPendingSilence,
    whisperAvailability,
    anyRunning,
    canRunScene,
    canRunSilence,
    canRunWhisper,
    canRunDialogue,
    canRunBroll,
    canRunRhythm,
    videoTracks,
    rhythmBeatTimes,
    brollTrackId,
    setBrollTrackId,
    rhythmTrackId,
    setRhythmTrackId,
    sceneThreshold,
    setSceneThreshold,
    silenceMinDb,
    setSilenceMinDb,
    silenceMinDuration,
    setSilenceMinDuration,
    silenceMargin,
    setSilenceMargin,
    dialogueSensitivity,
    setDialogueSensitivity,
    setPlayheadTime,
    semanticSuggestions,
    semanticReady,
    runSceneDetection,
    runSilenceDetection,
    runWhisper,
    runDialogueRoughCut,
    runBrollInsert,
    runRhythmAssemble,
    applySceneSplit,
    applySilenceRemoval,
    applySemanticSuggestion,
  } = useSmartRoughCut(selectedClip, media);

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
              status={stepState.steps.scene.status}
              error={stepState.steps.scene.error}
              testId="smart-scene"
              buttonLabel={zhCN.smartRoughCut.detectScene}
              disabled={anyRunning || !canRunScene}
              onRun={() => void runSceneDetection()}
            >
              <ParamSlider
                testId="smart-scene-threshold"
                label="阈值"
                value={sceneThreshold}
                min={0.1}
                max={0.5}
                step={0.05}
                disabled={anyRunning}
                onChange={setSceneThreshold}
              />
              {pendingScene ? (
                <SceneResultList
                  items={pendingScene.items}
                  selection={pendingScene.selection}
                  onSelectionChange={(selection) =>
                    setPendingScene((current) => (current ? { ...current, selection } : current))
                  }
                  onApply={applySceneSplit}
                  onPreviewTime={setPlayheadTime}
                />
              ) : null}
            </SmartStep>
            <SmartStep
              title={zhCN.smartRoughCut.steps.silence}
              description={zhCN.smartRoughCut.silenceDescription}
              status={stepState.steps.silence.status}
              error={stepState.steps.silence.error}
              testId="smart-silence"
              buttonLabel={zhCN.smartRoughCut.detectSilence}
              disabled={anyRunning || !canRunSilence}
              onRun={() => void runSilenceDetection()}
            >
              <ParamSlider
                testId="smart-silence-min-db"
                label="阈值 dB"
                value={silenceMinDb}
                min={-60}
                max={-20}
                step={5}
                disabled={anyRunning}
                onChange={setSilenceMinDb}
              />
              <ParamSlider
                testId="smart-silence-min-duration"
                label="最短时长"
                value={silenceMinDuration}
                min={0.1}
                max={2}
                step={0.1}
                disabled={anyRunning}
                onChange={setSilenceMinDuration}
              />
              <ParamSlider
                testId="smart-silence-margin"
                label="边距"
                value={silenceMargin}
                min={0}
                max={0.5}
                step={0.05}
                disabled={anyRunning}
                onChange={setSilenceMargin}
              />
              {pendingSilence ? (
                <SilenceResultList
                  items={pendingSilence.items}
                  selection={pendingSilence.selection}
                  onSelectionChange={(selection) =>
                    setPendingSilence((current) => (current ? { ...current, selection } : current))
                  }
                  onApply={applySilenceRemoval}
                  onPreviewTime={setPlayheadTime}
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
              status={stepState.steps.whisper.status}
              error={stepState.steps.whisper.error}
              testId="smart-whisper"
              buttonLabel={zhCN.smartRoughCut.generateSubtitles}
              disabled={anyRunning || !canRunWhisper}
              onRun={() => void runWhisper()}
            />
            <SemanticSuggestionList
              suggestions={semanticSuggestions}
              ready={semanticReady}
              onPreviewTime={setPlayheadTime}
              onReview={(suggestion) => {
                if (selectedClip) {
                  setReviewTarget({ suggestion, clip: selectedClip });
                }
              }}
            />
          </div>
        ) : null}
        {activeTab === 'dialogue' ? (
          <SmartStep
            title={zhCN.smartRoughCut.steps.dialogue}
            description={zhCN.smartRoughCut.dialogueDescription}
            status={stepState.steps.dialogue.status}
            error={stepState.steps.dialogue.error}
            testId="smart-dialogue"
            buttonLabel={zhCN.smartRoughCut.generateDialogueCut}
            disabled={anyRunning || !canRunDialogue}
            onRun={() => void runDialogueRoughCut()}
          >
            <div
              className="mt-2 flex gap-1 rounded-md border border-line bg-panel p-1"
              data-testid="smart-dialogue-sensitivity"
              data-value={dialogueSensitivity}
            >
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                    dialogueSensitivity === level ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                  type="button"
                  disabled={anyRunning}
                  data-testid={`smart-dialogue-sensitivity-${level}`}
                  aria-pressed={dialogueSensitivity === level}
                  onClick={() => setDialogueSensitivity(level)}
                >
                  {level === 'low' ? '低' : level === 'medium' ? '中' : '高'}
                </button>
              ))}
            </div>
          </SmartStep>
        ) : null}
        {activeTab === 'broll' ? (
          <SmartStep
            title={zhCN.smartRoughCut.steps.broll}
            description={zhCN.smartRoughCut.brollDescription}
            status={stepState.steps.broll.status}
            error={stepState.steps.broll.error}
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
            status={stepState.steps.rhythm.status}
            error={stepState.steps.rhythm.error}
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
            stepState.report.removedSilenceSeconds.toFixed(1),
            stepState.report.sceneSplits,
            stepState.report.subtitleClips,
            stepState.report.dialogueClips,
            stepState.report.brollClips,
            stepState.report.rhythmClips,
          )}
        </div>
      </div>
      {reviewTarget ? (
        <SemanticSuggestionReviewDialog
          suggestion={reviewTarget.suggestion}
          clip={reviewTarget.clip}
          onApply={applySemanticSuggestion}
          onClose={() => setReviewTarget(null)}
        />
      ) : null}
    </section>
  );
}

function ParamSlider({
  testId,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  testId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange(value: number): void;
}) {
  return (
    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
      <span className="w-14 flex-none font-medium text-slate-700">{label}</span>
      <input
        className="min-w-0 flex-1 accent-brand"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-12 flex-none text-right tabular-nums text-slate-500">{value}</span>
    </label>
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
  onPreviewTime,
}: {
  items: SceneCandidate[];
  selection: SmartRoughCutSelection;
  onSelectionChange(selection: SmartRoughCutSelection): void;
  onApply(): void;
  onPreviewTime(time: number): void;
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
          onMouseEnter={() => onPreviewTime(item.start)}
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
  onPreviewTime,
}: {
  items: SilenceCandidate[];
  selection: SmartRoughCutSelection;
  onSelectionChange(selection: SmartRoughCutSelection): void;
  onApply(): void;
  onPreviewTime(time: number): void;
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
          onMouseEnter={() => onPreviewTime(item.range.start)}
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
  children?: ReactNode;
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

/**
 * 智能粗剪编排器面板
 *
 * 统一工作流：一键运行全部 AI 分析 → 预览建议 → 拖拽调整 → 一键应用到时间线。
 * 遵循 v4.26.0 模块化架构：独立 Store + 子组件 + lazy chunk。
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Clip,
  MediaAsset,
  SmartRoughCutAnalysisData,
  SmartRoughCutSuggestion,
} from '@open-factory/editor-core';
import {
  getSelectedSuggestions,
  buildOrchestrationInput,
} from '@open-factory/editor-core';
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
} from '@open-factory/editor-core';
import type { Timeline, Track, SilentRange, SmartRoughCutVisualClip } from '@open-factory/editor-core';
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
  useSmartRoughCutOrchestratorStore,
  type OrchestratorPhase,
} from '../../store/smartRoughCutOrchestratorStore';
import { WorkflowStepper } from './WorkflowStepper';
import { SuggestionList } from './SuggestionList';
import { OrchestrationReport } from './OrchestrationReport';

interface SmartRoughCutOrchestratorPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
}

type PanelTab = 'workflow' | 'suggestions' | 'report';

export function SmartRoughCutOrchestratorPanel({
  selectedClip,
  media,
}: SmartRoughCutOrchestratorPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('workflow');
  const [targetTrackId, setTargetTrackId] = useState('');

  const phase = useSmartRoughCutOrchestratorStore((s) => s.phase);
  const progress = useSmartRoughCutOrchestratorStore((s) => s.progress);
  const progressMessage = useSmartRoughCutOrchestratorStore((s) => s.progressMessage);
  const suggestions = useSmartRoughCutOrchestratorStore((s) => s.suggestions);
  const report = useSmartRoughCutOrchestratorStore((s) => s.report);
  const error = useSmartRoughCutOrchestratorStore((s) => s.error);
  const runOrchestration = useSmartRoughCutOrchestratorStore((s) => s.runOrchestration);
  const setProgress = useSmartRoughCutOrchestratorStore((s) => s.setProgress);
  const setPhase = useSmartRoughCutOrchestratorStore((s) => s.setPhase);
  const setError = useSmartRoughCutOrchestratorStore((s) => s.setError);
  const reset = useSmartRoughCutOrchestratorStore((s) => s.reset);

  const project = useEditorStore((s) => s.project);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const timeline = project.timeline;

  const whisperExecutablePath = useWhisperSettingsStore((s) => s.executablePath);
  const whisperModelPath = useWhisperSettingsStore((s) => s.modelPath);

  const [whisperAvailability, setWhisperAvailability] = useState<WhisperAvailability>({
    ready: false,
    error: 'Whisper 未配置',
  });

  const videoTracks = useMemo(() => timeline.tracks.filter((t) => t.type === 'video'), [timeline]);
  const asset = useMemo(
    () => (selectedClip && 'mediaId' in selectedClip ? media.find((a) => a.id === selectedClip.mediaId) : undefined),
    [selectedClip, media],
  );

  const selectedSuggestions = useMemo(() => getSelectedSuggestions(suggestions), [suggestions]);
  const canRun = Boolean(selectedClip && asset) && phase !== 'analyzing' && phase !== 'applying';
  const canApply = phase === 'ready' && selectedSuggestions.length > 0;

  useEffect(() => {
    let disposed = false;
    void getWhisperAvailability({ executablePath: whisperExecutablePath, modelPath: whisperModelPath }).then((availability) => {
      if (!disposed) setWhisperAvailability(availability);
    });
    return () => { disposed = true; };
  }, [whisperExecutablePath, whisperModelPath]);

  useEffect(() => {
    if (targetTrackId && videoTracks.some((t) => t.id === targetTrackId)) return;
    setTargetTrackId(videoTracks[0]?.id ?? '');
  }, [targetTrackId, videoTracks]);

  // ── 一键运行分析 ──
  const handleRunAnalysis = useCallback(async () => {
    if (!selectedClip || !asset) return;

    setPhase('analyzing');
    setProgress(0, '准备分析...');
    const analysisData: SmartRoughCutAnalysisData = {};

    try {
      // 1. 场景检测 (25%)
      if (selectedClip.type === 'video') {
        setProgress(5, '检测场景切换...');
        const sceneResult = await detectSceneChanges({
          path: asset.path,
          threshold: 0.3,
          duration: asset.duration || selectedClip.duration,
        });
        const speed = getClipSpeed(selectedClip);
        const sourceStart = selectedClip.trimStart;
        const sourceEnd = sourceStart + selectedClip.duration * speed;
        const boundaries = sceneResult.sceneTimes
          .filter((t) => t > sourceStart + 0.000001 && t < sourceEnd - 0.000001)
          .map((t) => ({
            time: round((t - sourceStart) / speed),
            score: 0.7,
            histogramDiff: 0.5,
            motionDiff: 0.3,
            threshold: 0.35,
          }));
        analysisData.scenes = [
          {
            mediaId: asset.id,
            result: {
              boundaries,
              segments: boundaries.map((b, i) => ({
                start: i === 0 ? 0 : boundaries[i - 1].time,
                end: b.time,
                sceneType: 'indoor' as const,
                avgBrightness: 0.5,
                avgMotion: 0.3,
              })),
              thresholdCurve: [],
              sampleCount: boundaries.length,
            },
          },
        ];
      }
      setProgress(25, '场景检测完成');

      // 2. 静音检测 (25%)
      if (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)) {
        setProgress(30, '检测静音段...');
        const mediaClip = selectedClip as Extract<Clip, { type: 'audio' }> | Extract<Clip, { type: 'video' }>;
        const ranges = await detectClipSilence(mediaClip, asset, {
          thresholdDb: -40,
          minSilenceDuration: 0.5,
          marginDuration: 0.1,
        });
        if (ranges.length > 0) {
          analysisData.silences = [{ mediaId: asset.id, clipId: selectedClip.id, ranges }];
        }
      }
      setProgress(50, '静音检测完成');

      // 3. 对话检测 (15%)
      if (selectedClip.type === 'audio' || (selectedClip.type === 'video' && asset.hasAudio)) {
        setProgress(55, '检测对话段...');
        const mediaClip = selectedClip as Extract<Clip, { type: 'audio' }> | Extract<Clip, { type: 'video' }>;
        const intervals = await detectClipDialogue(mediaClip, asset, 'medium');
        if (intervals.length > 0) {
          analysisData.dialogues = [{ mediaId: asset.id, clipId: selectedClip.id, intervals }];
        }
      }
      setProgress(65, '对话检测完成');

      // 4. Whisper 字幕 (15%)
      if (canGenerateSubtitlesForClip(selectedClip, asset, whisperAvailability.ready)) {
        setProgress(70, '生成字幕...');
        const availability = await getWhisperAvailability({
          executablePath: whisperExecutablePath,
          modelPath: whisperModelPath,
        });
        if (availability.ready) {
          const mediaClip = selectedClip as Extract<Clip, { type: 'audio' }> | Extract<Clip, { type: 'video' }>;
          const track = await buildWhisperSubtitleTrackForClip(
            mediaClip,
            asset,
            timeline,
            { executablePath: whisperExecutablePath, modelPath: whisperModelPath },
          );
          if (track.clips.length > 0) {
            analysisData.subtitles = [
              {
                mediaId: asset.id,
                clipId: selectedClip.id,
                cueCount: track.clips.length,
                totalDuration: track.clips.reduce((sum, c) => sum + c.duration, 0),
              },
            ];
          }
        }
      }
      setProgress(85, '字幕生成完成');

      // 5. 节拍检测 (10%)
      const projectBeats = (project.beatMarkers ?? []).map((m) => m.time);
      if (projectBeats.length >= 2) {
        analysisData.beats = { beatTimes: projectBeats };
      }
      setProgress(95, '节拍分析完成');

      // 6. 运行编排
      setProgress(100, '生成剪辑建议...');
      runOrchestration(analysisData);

      setActiveTab('suggestions');
      showToast({ kind: 'success', title: '分析完成', message: `生成 ${analysisData.scenes?.[0]?.result.boundaries.length ?? 0} 个场景切点` });
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      setError(message);
      showToast({ kind: 'warning', title: '分析失败', message });
    }
  }, [
    selectedClip,
    asset,
    whisperAvailability,
    whisperExecutablePath,
    whisperModelPath,
    timeline,
    project,
    runOrchestration,
    setProgress,
    setPhase,
    setError,
  ]);

  // ── 一键应用到时间线 ──
  const handleApply = useCallback(() => {
    if (selectedSuggestions.length === 0) return;

    setPhase('applying');
    let appliedCount = 0;

    try {
      // 按类型分组应用
      const sceneSplits = selectedSuggestions.filter((s) => s.type === 'scene_split');
      const silenceRemovals = selectedSuggestions.filter((s) => s.type === 'silence_remove');
      const dialogueExtractions = selectedSuggestions.filter((s) => s.type === 'dialogue_extract');
      const rhythmCuts = selectedSuggestions.filter((s) => s.type === 'rhythm_cut');
      const subtitleAdds = selectedSuggestions.filter((s) => s.type === 'subtitle_add');

      // 场景分割
      if (sceneSplits.length > 0 && selectedClip) {
        const splitTimes = sceneSplits.map((s) => s.timeStart).sort((a, b) => a - b);
        commandManager.execute(new SplitClipAtTimesCommand(timelineAccessor, selectedClip.id, splitTimes));
        appliedCount += splitTimes.length;
      }

      // 静音删除
      if (silenceRemovals.length > 0 && selectedClip) {
        const ranges: SilentRange[] = silenceRemovals.map((s) => ({
          start: s.timeStart,
          end: s.timeEnd,
          duration: s.timeEnd - s.timeStart,
        }));
        commandManager.execute(new RemoveSilenceCommand(timelineAccessor, selectedClip.id, ranges));
        appliedCount += ranges.length;
      }

      // 对话提取
      if (dialogueExtractions.length > 0 && selectedClip) {
        for (const suggestion of dialogueExtractions) {
          const intervals = (suggestion.metadata['intervals'] as Array<{ start: number; end: number }>) ?? [];
          if (intervals.length > 0) {
            const command = new DialogueRoughCutCommand(timelineAccessor, selectedClip.id, intervals);
            commandManager.execute(command);
            appliedCount += command.clipCount;
          }
        }
      }

      // 节奏剪辑
      if (rhythmCuts.length > 0) {
        for (const suggestion of rhythmCuts) {
          const beatTimes = suggestion.metadata['beatTimes'] as number[] | undefined;
          if (beatTimes && selectedClip) {
            const trackId = targetTrackId || (selectedClip as { trackId?: string }).trackId || videoTracks[0]?.id;
            if (trackId) {
              const command = new RhythmAssembleCommand(
                timelineAccessor,
                [selectedClip.id],
                beatTimes,
                trackId,
              );
              commandManager.execute(command);
              appliedCount += command.clipCount;
            }
          }
        }
      }

      setPhase('done');
      showToast({
        kind: 'success',
        title: '应用完成',
        message: `已应用 ${appliedCount} 项剪辑操作`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '应用失败';
      setError(message);
      showToast({ kind: 'warning', title: '应用失败', message });
    }
  }, [selectedSuggestions, selectedClip, targetTrackId, videoTracks, setPhase, setError]);

  return (
    <section className="flex min-h-0 flex-col bg-white" data-testid="smart-rough-cut-orchestrator-panel">
      {/* 标题栏 */}
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">🧠 智能粗剪编排</h2>
        <div className="mt-1 truncate text-xs text-slate-500" data-testid="orchestrator-selected">
          {selectedClip ? selectedClip.name : '请选择音频或视频片段'}
        </div>
      </div>

      {/* 标签页 */}
      <div
        className="grid grid-cols-3 gap-1 border-b border-line bg-panel p-1"
        data-testid="orchestrator-tabs"
      >
        {([
          { key: 'workflow' as const, label: '工作流' },
          { key: 'suggestions' as const, label: `建议 (${suggestions.length})` },
          { key: 'report' as const, label: '报告' },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`rounded px-2 py-1.5 text-xs font-medium ${
              activeTab === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            data-testid={`orchestrator-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {activeTab === 'workflow' && (
          <div className="space-y-3">
            <WorkflowStepper
              phase={phase}
              progress={progress}
              progressMessage={progressMessage}
              error={error}
            />

            {/* 运行按钮 */}
            <button
              className="w-full rounded-md bg-brand px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              type="button"
              disabled={!canRun}
              onClick={() => void handleRunAnalysis()}
              data-testid="orchestrator-run-button"
            >
              {phase === 'analyzing' ? '分析中...' : '🚀 一键运行全部分析'}
            </button>

            {/* 选项说明 */}
            <div className="rounded-md border border-line bg-panel p-3 text-[11px] text-slate-500">
              <div className="mb-1 font-medium text-slate-600">分析步骤：</div>
              <div>1. 🎬 场景检测（视频）</div>
              <div>2. 🔇 静音检测（音频）</div>
              <div>3. 🗣 对话检测（音频）</div>
              <div>4. 💬 Whisper 字幕（可选）</div>
              <div>5. 🎵 节拍分析</div>
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            <SuggestionList />

            {/* 一键应用 */}
            <div className="space-y-2">
              {videoTracks.length > 1 && (
                <label className="block text-xs text-slate-600">
                  <span className="mb-1 block font-medium text-slate-700">目标轨道</span>
                  <select
                    className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
                    value={targetTrackId}
                    onChange={(e) => setTargetTrackId(e.target.value)}
                    data-testid="orchestrator-target-track"
                  >
                    {videoTracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                className="w-full rounded-md bg-brand px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                type="button"
                disabled={!canApply}
                onClick={handleApply}
                data-testid="orchestrator-apply-button"
              >
                {phase === 'applying' ? '应用中...' : `✨ 一键应用 ${selectedSuggestions.length} 项建议到时间线`}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div>
            {report ? (
              <OrchestrationReport report={report} />
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                请先运行分析以生成报告。
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import {
  createOperationRecording,
  serializeOperationRecording,
  parseOperationRecording,
  buildOperationReplaySchedule,
  getOperationProjectAtStep,
  generateOperationRecordingSlidesHtml,
  recordOperationCommand,
  type OperationRecordingFile,
} from '@open-factory/editor-core';
import { LoadProjectCommand, createId } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { showToast } from '../lib/toast';
import { commandManager, projectAccessor, timelineAccessor, addOnExecuteListener } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import {
  saveFileDialog as bridgeSaveFileDialog,
  writeFile as bridgeWriteFile,
  readFile as bridgeReadFile,
  openFileDialog as bridgeOpenFileDialog,
} from '../lib/tauri-bridge';
import {
  appendMacroHistoryEntry,
  buildMacroCommands,
  findMacroTargetClip,
  writeClipMacros,
  snapshotCommand,
  type ClipMacro,
  type CommandSnapshot,
  type MacroHistoryEntry,
} from '../macros/clip-macros';

/**
 * 从 EditorShell 中提取的宏录制与操作录制回调。
 * 涵盖宏录制/执行/历史、操作录制/回放/导出，约 250 行。
 */
export function useEditorShellOperationRecording(): {
  recordMacroHistory: (entry: MacroHistoryEntry) => Promise<void>;
  startMacroRecording: () => void;
  stopMacroRecording: () => Promise<void>;
  executeMacro: (macro: ClipMacro) => Promise<void>;
  startOperationRecording: () => void;
  stopOperationRecording: () => void;
  saveOperationRecording: () => Promise<void>;
  loadOperationRecording: () => Promise<void>;
  pauseOperationReplay: () => void;
  replayOperationRecording: () => void;
  jumpOperationRecording: (stepIndex: number) => void;
  exportOperationRecordingSlides: () => Promise<void>;
} {
  const macroRecorderRef = useRef<{ active: boolean; replaying: boolean; steps: CommandSnapshot[] }>({
    active: false,
    replaying: false,
    steps: [],
  });
  const operationRecorderRef = useRef<{ active: boolean; replaying: boolean; recording?: OperationRecordingFile }>({
    active: false,
    replaying: false,
  });
  const operationReplayTimersRef = useRef<number[]>([]);

  // 拦截命令执行，记录到宏录制或操作录制中
  useEffect(() => {
    return addOnExecuteListener((command) => {
      // 宏录制
      const macroRecorder = macroRecorderRef.current;
      if (macroRecorder.active && !macroRecorder.replaying) {
        const snapshot = snapshotCommand(command);
        if (snapshot) {
          macroRecorder.steps.push(snapshot);
          useEditorFeatureStore.getState().setMacroRecordingStepCount(macroRecorder.steps.length);
        }
      }
      // 操作录制
      const opRecorder = operationRecorderRef.current;
      if (opRecorder.active && !opRecorder.replaying && opRecorder.recording) {
        opRecorder.recording = recordOperationCommand(opRecorder.recording, command, useEditorStore.getState().project);
        useEditorFeatureStore.getState().setOperationRecording(opRecorder.recording);
      }
    });
  }, []);

  // ===== 宏录制 =====
  const recordMacroHistory = useCallback(async (entry: MacroHistoryEntry) => {
    const setMacroHistory = useEditorFeatureStore.getState().setMacroHistory;
    try {
      setMacroHistory(await appendMacroHistoryEntry(entry));
    } catch (error) {
      console.warn(zhCN.macros.history.title, error);
    }
  }, []);

  const startMacroRecording = useCallback(() => {
    macroRecorderRef.current = { active: true, replaying: false, steps: [] };
    useEditorFeatureStore.getState().setMacroRecordingActive(true);
    useEditorFeatureStore.getState().setMacroRecordingStepCount(0);
    showToast({
      kind: 'info',
      title: zhCN.settings.macros.recordingStarted,
      message: zhCN.settings.macros.recordingStartedMessage,
    });
  }, []);

  const stopMacroRecording = useCallback(async () => {
    const recorder = macroRecorderRef.current;
    if (!recorder.active) {
      return;
    }
    recorder.active = false;
    useEditorFeatureStore.getState().setMacroRecordingActive(false);
    useEditorFeatureStore.getState().setMacroRecordingStepCount(recorder.steps.length);
    const steps = recorder.steps;
    if (steps.length === 0) {
      showToast({
        kind: 'warning',
        title: zhCN.settings.macros.recordingStopped,
        message: zhCN.settings.macros.recordingEmpty,
      });
      return;
    }
    const defaultName = zhCN.settings.macros.recordingDefaultName(
      new Date().toLocaleString('zh-CN', { hour12: false }),
    );
    const name = window.prompt(zhCN.settings.macros.recordNamePrompt, defaultName)?.trim();
    if (!name) {
      return;
    }
    const macros = useEditorSettingsStore.getState().macros;
    try {
      const saved = await writeClipMacros([
        ...macros,
        {
          id: createId('macro'),
          name,
          description: zhCN.settings.macros.savedRecordingMessage(steps.length),
          steps,
        },
      ]);
      useEditorSettingsStore.getState().setMacros(saved);
      showToast({
        kind: 'success',
        title: zhCN.settings.macros.savedRecording,
        message: zhCN.settings.macros.savedRecordingMessage(steps.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.settings.macros.saveFailed,
        message: error instanceof Error ? error.message : zhCN.settings.macros.saveFailedMessage,
      });
    }
  }, []);

  const executeMacro = useCallback(
    async (macro: ClipMacro) => {
      const state = useEditorStore.getState();
      const target = findMacroTargetClip(state.project.timeline, state.selectedClipIds, state.playheadTime);
      const baseEntry = {
        id: createId('macro-history'),
        macroId: macro.id,
        macroName: macro.name,
        triggeredAt: new Date().toISOString(),
        shortcut: macro.shortcut,
      };
      if (!target) {
        await recordMacroHistory({ ...baseEntry, success: false, error: zhCN.settings.macros.noTargetClip });
        showToast({
          kind: 'warning',
          title: zhCN.settings.macros.noTargetClip,
          message: zhCN.settings.macros.noTargetClipMessage,
        });
        return;
      }
      try {
        const commands = buildMacroCommands(timelineAccessor, macro, target.id);
        if (commands.length === 0) {
          throw new Error(zhCN.settings.macros.invalidSteps);
        }
        macroRecorderRef.current.replaying = true;
        try {
          for (const command of commands) {
            commandManager.execute(command);
          }
        } finally {
          macroRecorderRef.current.replaying = false;
        }
        useEditorStore.getState().setSelectedClipId(target.id);
        await recordMacroHistory({ ...baseEntry, targetClipId: target.id, targetClipName: target.name, success: true });
        showToast({ kind: 'success', title: zhCN.settings.macros.executed, message: `${macro.name} · ${target.name}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : zhCN.settings.macros.executeFailed;
        await recordMacroHistory({
          ...baseEntry,
          targetClipId: target.id,
          targetClipName: target.name,
          success: false,
          error: message,
        });
        showToast({ kind: 'warning', title: zhCN.settings.macros.executeFailed, message });
      }
    },
    [recordMacroHistory],
  );

  // ===== 操作录制 =====
  const clearOperationReplayTimers = useCallback(() => {
    for (const timer of operationReplayTimersRef.current) {
      window.clearTimeout(timer);
    }
    operationReplayTimersRef.current = [];
  }, []);

  const applyOperationRecordingStep = useCallback((recording: OperationRecordingFile, stepIndex: number) => {
    const projectAtStep = getOperationProjectAtStep(recording, stepIndex);
    operationRecorderRef.current.replaying = true;
    try {
      commandManager.execute(
        new LoadProjectCommand(projectAccessor, projectAtStep, zhCN.operationRecording.replayCommand),
      );
    } finally {
      operationRecorderRef.current.replaying = false;
    }
    useEditorFeatureStore.getState().setOperationRecordingStep(stepIndex);
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setSelectedClipId(undefined);
  }, []);

  const startOperationRecording = useCallback(() => {
    clearOperationReplayTimers();
    const nextRecording = createOperationRecording(useEditorStore.getState().project);
    operationRecorderRef.current = { active: true, replaying: false, recording: nextRecording };
    useEditorFeatureStore.getState().setOperationRecording(nextRecording);
    useEditorFeatureStore.getState().setOperationRecordingActive(true);
    useEditorFeatureStore.getState().setOperationRecordingStep(-1);
    useEditorFeatureStore.getState().setOperationReplayRunning(false);
    showToast({
      kind: 'info',
      title: zhCN.operationRecording.recordingStarted,
      message: zhCN.operationRecording.recordingStartedMessage,
    });
  }, [clearOperationReplayTimers]);

  const stopOperationRecording = useCallback(() => {
    operationRecorderRef.current.active = false;
    useEditorFeatureStore.getState().setOperationRecordingActive(false);
    showToast({
      kind: operationRecorderRef.current.recording?.commands.length ? 'success' : 'warning',
      title: zhCN.operationRecording.recordingStopped,
      message: zhCN.operationRecording.summary(operationRecorderRef.current.recording?.commands.length ?? 0),
    });
  }, []);

  const saveOperationRecording = useCallback(async () => {
    const operationRecording = useEditorFeatureStore.getState().operationRecording;
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    try {
      const path = await bridgeSaveFileDialog('timeline-demo.ofrecording.json', [
        { name: zhCN.operationRecording.fileDialogName, extensions: ['ofrecording.json', 'json'] },
      ]);
      if (!path) {
        return;
      }
      await bridgeWriteFile(path, serializeOperationRecording(recording));
      showToast({
        kind: 'success',
        title: zhCN.operationRecording.savedTitle,
        message: zhCN.operationRecording.savedMessage(path),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.operationRecording.saveFailed,
        message: error instanceof Error ? error.message : zhCN.operationRecording.saveFailedMessage,
      });
    }
  }, []);

  const loadOperationRecording = useCallback(async () => {
    try {
      const [path] = await bridgeOpenFileDialog(false, [
        { name: zhCN.operationRecording.fileDialogName, extensions: ['ofrecording.json', 'json'] },
      ]);
      if (!path) {
        return;
      }
      const parsed = parseOperationRecording(await bridgeReadFile(path));
      if (!parsed) {
        throw new Error(zhCN.operationRecording.invalidFile);
      }
      clearOperationReplayTimers();
      operationRecorderRef.current = { active: false, replaying: false, recording: parsed };
      useEditorFeatureStore.getState().setOperationRecording(parsed);
      useEditorFeatureStore.getState().setOperationRecordingActive(false);
      useEditorFeatureStore.getState().setOperationReplayRunning(false);
      useEditorFeatureStore.getState().setOperationRecordingStep(-1);
      applyOperationRecordingStep(parsed, -1);
      showToast({
        kind: 'success',
        title: zhCN.operationRecording.loadedTitle,
        message: zhCN.operationRecording.summary(parsed.commands.length),
      });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.operationRecording.loadFailed,
        message: error instanceof Error ? error.message : zhCN.operationRecording.loadFailedMessage,
      });
    }
  }, [applyOperationRecordingStep, clearOperationReplayTimers]);

  const pauseOperationReplay = useCallback(() => {
    clearOperationReplayTimers();
    useEditorFeatureStore.getState().setOperationReplayRunning(false);
  }, [clearOperationReplayTimers]);

  const replayOperationRecording = useCallback(() => {
    const operationRecording = useEditorFeatureStore.getState().operationRecording;
    const operationReplaySpeed = useEditorFeatureStore.getState().operationReplaySpeed;
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    clearOperationReplayTimers();
    useEditorFeatureStore.getState().setOperationReplayRunning(true);
    applyOperationRecordingStep(recording, -1);
    let elapsedMs = 0;
    for (const step of buildOperationReplaySchedule(recording, operationReplaySpeed)) {
      elapsedMs += step.delayMs;
      const timer = window.setTimeout(() => {
        applyOperationRecordingStep(recording, step.index);
        if (step.index === recording.commands.length - 1) {
          operationReplayTimersRef.current = [];
          useEditorFeatureStore.getState().setOperationReplayRunning(false);
          showToast({ kind: 'success', title: zhCN.operationRecording.replayFinished });
        }
      }, elapsedMs);
      operationReplayTimersRef.current.push(timer);
    }
  }, [applyOperationRecordingStep, clearOperationReplayTimers]);

  const jumpOperationRecording = useCallback(
    (stepIndex: number) => {
      const operationRecording = useEditorFeatureStore.getState().operationRecording;
      const recording = operationRecorderRef.current.recording ?? operationRecording;
      if (!recording) {
        return;
      }
      clearOperationReplayTimers();
      useEditorFeatureStore.getState().setOperationReplayRunning(false);
      applyOperationRecordingStep(recording, stepIndex);
    },
    [applyOperationRecordingStep, clearOperationReplayTimers],
  );

  const exportOperationRecordingSlides = useCallback(async () => {
    const operationRecording = useEditorFeatureStore.getState().operationRecording;
    const recording = operationRecorderRef.current.recording ?? operationRecording;
    if (!recording || recording.commands.length === 0) {
      return;
    }
    try {
      const path = await bridgeSaveFileDialog('timeline-demo-slides.html', [
        { name: zhCN.operationRecording.slidesFileDialogName, extensions: ['html'] },
      ]);
      if (!path) {
        return;
      }
      await bridgeWriteFile(path, generateOperationRecordingSlidesHtml(recording, 2));
      showToast({ kind: 'success', title: zhCN.operationRecording.exportedTitle, message: path });
    } catch (error) {
      showToast({
        kind: 'error',
        title: zhCN.operationRecording.exportFailed,
        message: error instanceof Error ? error.message : zhCN.operationRecording.exportFailedMessage,
      });
    }
  }, []);

  return {
    recordMacroHistory,
    startMacroRecording,
    stopMacroRecording,
    executeMacro,
    startOperationRecording,
    stopOperationRecording,
    saveOperationRecording,
    loadOperationRecording,
    pauseOperationReplay,
    replayOperationRecording,
    jumpOperationRecording,
    exportOperationRecordingSlides,
  };
}

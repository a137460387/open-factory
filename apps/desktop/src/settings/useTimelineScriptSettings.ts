import {useState, useCallback, useMemo} from 'react';
import {zhCN} from '../i18n/strings';
import {showToast} from '../lib/toast';
import {BUILTIN_TIMELINE_SCRIPTS, RunScriptCommand, createTimelineScriptSnapshot, getTimelineScriptApiFunctionNames, getTimelineScriptExportRequests, type BuiltinTimelineScript, type Project, type TimelineScriptOperation} from '@open-factory/editor-core';
import {commandManager, timelineAccessor} from '../store/commandManager';
import {runTimelineScriptInWorker} from '../scripting/timeline-script-runtime';
import {deleteTimelineScript, exportTimelineScriptToDialog, importTimelineScriptFromDialog, loadTimelineScripts, saveTimelineScript, type TimelineScriptFile} from '../scripting/timeline-scripts';

export function useTimelineScriptSettings(t: {loadFailed: string; loadFailedMessage: string; defaultScriptName: string; saved: string; saveFailed: string; saveFailedMessage: string; deleted: string; deleteFailed: string; deleteFailedMessage: string; imported: string; importFailed: string; importFailedMessage: string; exported: string; exportFailed: string; exportFailedMessage: string; runFailed: string; runFailedMessage: string; runCommand: string; operationSummary: (n: number) => string; exportSummary: (n: number) => string; elapsed: (ms: number) => string; examples: Record<string, {name: string}>}, project: Project) {
  const [timelineScripts, setTimelineScripts] = useState<TimelineScriptFile[]>([]);
  const [selectedTimelineScriptId, setSelectedTimelineScriptId] = useState<string>(BUILTIN_TIMELINE_SCRIPTS[0]?.id ?? 'draft-script');
  const [timelineScriptName, setTimelineScriptName] = useState('');
  const [timelineScriptCode, setTimelineScriptCode] = useState('');
  const [timelineScriptPath, setTimelineScriptPath] = useState<string>();
  const [timelineScriptRunning, setTimelineScriptRunning] = useState(false);
  const [timelineScriptOutput, setTimelineScriptOutput] = useState<string[]>([]);
  const [timelineScriptError, setTimelineScriptError] = useState<string>();

  const timelineScriptApiNames = useMemo(() => getTimelineScriptApiFunctionNames(), []);
  const firstBuiltinScript = BUILTIN_TIMELINE_SCRIPTS[0];

  const loadTimelineScriptsPanel = useCallback(async () => {
    try {
      const files = await loadTimelineScripts();
      setTimelineScripts(files);
    } catch (scriptError) {
      showToast({
        kind: 'warning',
        title: t.loadFailed,
        message: scriptError instanceof Error ? scriptError.message : t.loadFailedMessage,
      });
    }
  }, [t.loadFailed, t.loadFailedMessage]);

  const selectBuiltinTimelineScript = useCallback((script: BuiltinTimelineScript) => {
    const label = t.examples[script.id as keyof typeof t.examples];
    setSelectedTimelineScriptId(script.id);
    setTimelineScriptName(label.name);
    setTimelineScriptCode(script.code);
    setTimelineScriptPath(undefined);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }, [t.examples]);

  const selectTimelineScriptFile = useCallback((file: TimelineScriptFile) => {
    setSelectedTimelineScriptId(file.id);
    setTimelineScriptName(file.name);
    setTimelineScriptCode(file.code);
    setTimelineScriptPath(file.path);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }, []);

  const createNewTimelineScript = useCallback(() => {
    setSelectedTimelineScriptId('draft-script');
    setTimelineScriptName(t.defaultScriptName);
    setTimelineScriptCode('');
    setTimelineScriptPath(undefined);
    setTimelineScriptError(undefined);
    setTimelineScriptOutput([]);
  }, [t.defaultScriptName]);

  const saveCurrentTimelineScript = useCallback(async () => {
    try {
      const saved = await saveTimelineScript(timelineScriptName, timelineScriptCode, timelineScriptPath);
      setTimelineScripts((files) =>
        [saved, ...files.filter((file) => file.path !== saved.path && file.path !== timelineScriptPath)].sort(
          (left, right) => left.name.localeCompare(right.name),
        ),
      );
      selectTimelineScriptFile(saved);
      showToast({kind: 'success', title: t.saved, message: saved.name});
    } catch (saveError) {
      showToast({
        kind: 'warning',
        title: t.saveFailed,
        message: saveError instanceof Error ? saveError.message : t.saveFailedMessage,
      });
    }
  }, [timelineScriptName, timelineScriptCode, timelineScriptPath, selectTimelineScriptFile, t.saved, t.saveFailed, t.saveFailedMessage]);

  const deleteCurrentTimelineScript = useCallback(async () => {
    if (!timelineScriptPath) return;
    try {
      await deleteTimelineScript(timelineScriptPath);
      setTimelineScripts((files) => files.filter((file) => file.path !== timelineScriptPath));
      if (firstBuiltinScript) {
        selectBuiltinTimelineScript(firstBuiltinScript);
      } else {
        createNewTimelineScript();
      }
      showToast({kind: 'success', title: t.deleted});
    } catch (deleteError) {
      showToast({
        kind: 'warning',
        title: t.deleteFailed,
        message: deleteError instanceof Error ? deleteError.message : t.deleteFailedMessage,
      });
    }
  }, [timelineScriptPath, firstBuiltinScript, selectBuiltinTimelineScript, createNewTimelineScript, t.deleted, t.deleteFailed, t.deleteFailedMessage]);

  const importTimelineScript = useCallback(async () => {
    try {
      const imported = await importTimelineScriptFromDialog();
      if (!imported) return;
      setTimelineScripts((files) =>
        [imported, ...files.filter((file) => file.path !== imported.path)].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      selectTimelineScriptFile(imported);
      showToast({kind: 'success', title: t.imported, message: imported.name});
    } catch (importError) {
      showToast({
        kind: 'warning',
        title: t.importFailed,
        message: importError instanceof Error ? importError.message : t.importFailedMessage,
      });
    }
  }, [selectTimelineScriptFile, t.imported, t.importFailed, t.importFailedMessage]);

  const exportTimelineScript = useCallback(async () => {
    try {
      const outputPath = await exportTimelineScriptToDialog(timelineScriptName, timelineScriptCode);
      if (outputPath) {
        showToast({kind: 'success', title: t.exported, message: outputPath});
      }
    } catch (exportError) {
      showToast({
        kind: 'warning',
        title: t.exportFailed,
        message: exportError instanceof Error ? exportError.message : t.exportFailedMessage,
      });
    }
  }, [timelineScriptName, timelineScriptCode, t.exported, t.exportFailed, t.exportFailedMessage]);

  const runCurrentTimelineScript = useCallback(async () => {
    try {
      setTimelineScriptRunning(true);
      setTimelineScriptError(undefined);
      setTimelineScriptOutput([]);
      const result = await runTimelineScriptInWorker({
        script: timelineScriptCode,
        snapshot: createTimelineScriptSnapshot(project),
      });
      const exportRequests = getTimelineScriptExportRequests(result.operations);
      const timelineOperations = result.operations.filter(
        (operation): operation is Exclude<TimelineScriptOperation, {type: 'exportProject'}> =>
          operation.type !== 'exportProject',
      );
      if (timelineOperations.length > 0) {
        commandManager.execute(new RunScriptCommand(timelineAccessor, timelineOperations, t.runCommand));
      }
      setTimelineScriptOutput([
        ...result.logs,
        t.operationSummary(timelineOperations.length),
        ...(exportRequests.length > 0 ? [t.exportSummary(exportRequests.length)] : []),
        t.elapsed(result.durationMs),
      ]);
    } catch (scriptError) {
      const message = scriptError instanceof Error ? scriptError.message : t.runFailedMessage;
      setTimelineScriptError(message);
      setTimelineScriptOutput([message]);
      showToast({kind: 'warning', title: t.runFailed, message});
    } finally {
      setTimelineScriptRunning(false);
    }
  }, [timelineScriptCode, project, t.runCommand, t.operationSummary, t.exportSummary, t.elapsed, t.runFailed, t.runFailedMessage]);

  return {
    timelineScripts,
    selectedTimelineScriptId,
    timelineScriptName,
    timelineScriptCode,
    timelineScriptPath,
    timelineScriptRunning,
    timelineScriptOutput,
    timelineScriptError,
    timelineScriptApiNames,
    firstBuiltinScript,
    setTimelineScriptName,
    setTimelineScriptCode,
    loadTimelineScriptsPanel,
    selectBuiltinTimelineScript,
    selectTimelineScriptFile,
    createNewTimelineScript,
    saveCurrentTimelineScript,
    deleteCurrentTimelineScript,
    importTimelineScript,
    exportTimelineScript,
    runCurrentTimelineScript,
  };
}

import { useCallback, useMemo } from 'react';
import type { SubtitleClip } from '@open-factory/editor-core';
import {
  serializeSubtitleClipsToSrt,
  serializeSubtitleClipsToVtt,
  serializeSubtitleClipsToAss,
} from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useEditorStore } from '../../store/editorStore';
import { saveFileDialog, writeFile, openPath } from '../../lib/tauri-bridge';
import { showToast } from '../../lib/toast';
import type { ExportState } from './useSubtitleWorkflow';

const t = zhCN.aiSubtitleWorkflow.export;

const FORMAT_OPTIONS: Array<{ value: ExportState['format']; label: string; extension: string }> = [
  { value: 'srt', label: 'SRT', extension: 'srt' },
  { value: 'vtt', label: 'VTT', extension: 'vtt' },
  { value: 'ass', label: 'ASS', extension: 'ass' },
];

const MODE_OPTIONS: Array<{ value: ExportState['mode']; label: string }> = [
  { value: 'soft-sub', label: t.softSub },
  { value: 'burn-in', label: t.burnIn },
];

interface ExportStageProps {
  exportState: ExportState;
  onUpdate: (patch: Partial<ExportState>) => void;
  onComplete: (outputPath: string) => void;
}

export function ExportStage({ exportState, onUpdate, onComplete }: ExportStageProps) {
  const project = useEditorStore((s) => s.project);
  const timeline = project.timeline;

  const subtitleClips = useMemo(() => {
    const clips: SubtitleClip[] = [];
    for (const track of timeline.tracks) {
      if (track.type === 'subtitle') {
        for (const clip of track.clips) {
          if (clip.type === 'subtitle') {
            clips.push(clip as SubtitleClip);
          }
        }
      }
    }
    return clips;
  }, [timeline]);

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === exportState.format) ?? FORMAT_OPTIONS[0];

  const handleExport = useCallback(async () => {
    if (subtitleClips.length === 0) return;

    onUpdate({ status: 'running', error: null });

    try {
      let content: string;
      switch (exportState.format) {
        case 'vtt':
          content = serializeSubtitleClipsToVtt(subtitleClips);
          break;
        case 'ass':
          content = serializeSubtitleClipsToAss(subtitleClips);
          break;
        case 'srt':
        default:
          content = serializeSubtitleClipsToSrt(subtitleClips);
          break;
      }

      if (exportState.mode === 'burn-in') {
        showToast({
          kind: 'info',
          title: t.exportComplete,
          message: '烧录模式将由主导出系统处理，请使用导出面板进行视频烧录。',
        });
        onUpdate({ status: 'idle' });
        return;
      }

      const defaultPath = `${project.name || 'subtitles'}.${selectedFormat.extension}`;
      const filePath = await saveFileDialog(defaultPath, [
        { name: `${selectedFormat.label} 字幕文件`, extensions: [selectedFormat.extension] },
      ]);

      if (!filePath) {
        onUpdate({ status: 'idle' });
        return;
      }

      await writeFile(filePath, content);

      showToast({ kind: 'success', title: t.exportComplete });
      onUpdate({ status: 'done', outputPath: filePath });
      onComplete(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.exportFailed;
      onUpdate({ status: 'error', error: message });
      showToast({ kind: 'error', title: t.exportFailed, message });
    }
  }, [subtitleClips, exportState.format, exportState.mode, selectedFormat, project.name, onUpdate, onComplete]);

  const handleOpenFolder = useCallback(() => {
    if (!exportState.outputPath) return;
    const folder = exportState.outputPath.replace(/[\\/][^\\/]+$/, '');
    void openPath(folder);
  }, [exportState.outputPath]);

  return (
    <div className="space-y-3" data-testid="subtitle-workflow-export-stage">
      {/* Format selector */}
      <div className="space-y-2">
        <label className="block text-xs text-[var(--color-text-secondary)]">{t.format}</label>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                exportState.format === option.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'border border-line bg-[var(--color-bg-elevated)] hover:bg-panel'
              }`}
              type="button"
              onClick={() => onUpdate({ format: option.value })}
              disabled={exportState.status === 'running'}
              data-testid={`subtitle-workflow-export-format-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode selector */}
      <div className="space-y-2">
        <label className="block text-xs text-[var(--color-text-secondary)]">{t.mode}</label>
        <div className="grid grid-cols-2 gap-1.5">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                exportState.mode === option.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'border border-line bg-[var(--color-bg-elevated)] hover:bg-panel'
              }`}
              type="button"
              onClick={() => onUpdate({ mode: option.value })}
              disabled={exportState.status === 'running'}
              data-testid={`subtitle-workflow-export-mode-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clip count */}
      <div className="text-xs text-[var(--color-text-muted)]">{subtitleClips.length} 条字幕</div>

      {/* Export button */}
      {exportState.status !== 'done' && (
        <button
          className="w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={subtitleClips.length === 0 || exportState.status === 'running'}
          onClick={() => void handleExport()}
          data-testid="subtitle-workflow-export-button"
        >
          {exportState.status === 'running' ? t.exporting : t.startExport}
        </button>
      )}

      {/* Error state */}
      {exportState.status === 'error' && exportState.error && (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700"
          data-testid="subtitle-workflow-export-error"
        >
          {exportState.error}
        </div>
      )}

      {/* Result display */}
      {exportState.status === 'done' && exportState.outputPath && (
        <div
          className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3"
          data-testid="subtitle-workflow-export-result"
        >
          <div className="text-xs font-medium text-emerald-700">{t.exportComplete}</div>
          <div className="break-all text-xs text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-muted)]">{t.outputPath}: </span>
            {exportState.outputPath}
          </div>
          <button
            className="w-full rounded-md border border-line bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs font-medium hover:bg-panel"
            type="button"
            onClick={handleOpenFolder}
            data-testid="subtitle-workflow-export-open-folder"
          >
            {t.openFolder}
          </button>
        </div>
      )}
    </div>
  );
}

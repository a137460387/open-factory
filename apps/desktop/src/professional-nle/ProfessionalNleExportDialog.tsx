import { useState } from 'react';
import { exportProfessionalNle, type ProfessionalNleExportFormat, type ProfessionalNleMediaMode, type Project } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { copyFile, saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

interface ProfessionalNleExportDialogProps {
  project: Project;
  onClose(): void;
  onCompleted?(path: string): void;
}

export function ProfessionalNleExportDialog({ project, onClose, onCompleted }: ProfessionalNleExportDialogProps) {
  const t = zhCN.professionalNleExport;
  const [format, setFormat] = useState<ProfessionalNleExportFormat>('aaf');
  const [mediaMode, setMediaMode] = useState<ProfessionalNleMediaMode>('link');
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    try {
      setBusy(true);
      const extension = format === 'fcp-xml' ? 'xml' : format;
      const path = await saveFileDialog(`${sanitizeFileBaseName(project.name)}.${extension}`, [{ name: t.filterName(format), extensions: [extension] }]);
      if (!path) {
        return;
      }
      const mediaPathMap = mediaMode === 'copy' ? await copyProjectMedia(project, path) : undefined;
      await writeFile(path, exportProfessionalNle(project, format, { mediaMode, mediaPathMap }));
      showToast({ kind: 'success', title: t.success, message: path });
      onCompleted?.(path);
      onClose();
    } catch (error) {
      showToast({ kind: 'error', title: t.failed, message: error instanceof Error ? error.message : t.failedMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="professional-nle-export-dialog">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          <p className="text-sm text-slate-500">{t.description}</p>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            <span>{t.format}</span>
            <select
              className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
              value={format}
              onChange={(event) => setFormat(normalizeFormat(event.target.value))}
              data-testid="professional-nle-format-select"
            >
              <option value="aaf">{t.formats.aaf}</option>
              <option value="omf">{t.formats.omf}</option>
              <option value="fcp-xml">{t.formats.fcpXml}</option>
            </select>
          </label>
          <fieldset className="rounded-md border border-line bg-panel p-3">
            <legend className="px-1 text-xs font-semibold text-slate-700">{t.mediaMode}</legend>
            <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <input className="h-4 w-4 accent-brand" type="radio" name="professional-nle-media-mode" checked={mediaMode === 'link'} onChange={() => setMediaMode('link')} data-testid="professional-nle-media-link-radio" />
              <span>{t.mediaModes.link}</span>
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input className="h-4 w-4 accent-brand" type="radio" name="professional-nle-media-mode" checked={mediaMode === 'copy'} onChange={() => setMediaMode('copy')} data-testid="professional-nle-media-copy-radio" />
              <span>{t.mediaModes.copy}</span>
            </label>
          </fieldset>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel" type="button" onClick={onClose} disabled={busy}>
            {zhCN.common.cancel}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-[#176858] disabled:opacity-50" type="button" onClick={() => void exportFile()} disabled={busy} data-testid="professional-nle-export-save-button">
            {busy ? t.exporting : t.export}
          </button>
        </div>
      </div>
    </div>
  );
}

async function copyProjectMedia(project: Project, outputPath: string): Promise<Map<string, string>> {
  const outputDir = dirname(outputPath);
  const mediaDir = `${outputDir.replace(/[\\/]+$/, '')}/media`;
  const copied = new Map<string, string>();
  let index = 0;
  for (const asset of project.media) {
    if (!asset.path || copied.has(asset.path)) {
      continue;
    }
    const destination = `${mediaDir}/${uniqueMediaFileName(asset.path, asset.name, index)}`;
    index += 1;
    await copyFile(asset.path, destination);
    copied.set(asset.path, destination);
  }
  return copied;
}

function normalizeFormat(value: string): ProfessionalNleExportFormat {
  return value === 'omf' || value === 'fcp-xml' ? value : 'aaf';
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '.';
}

function uniqueMediaFileName(path: string, name: string, index: number): string {
  const source = name.trim() || path.split(/[\\/]/).pop() || `media-${index + 1}`;
  const sanitized = sanitizeFileName(source);
  const suffix = `-${String(index + 1).padStart(3, '0')}`;
  const extensionIndex = sanitized.lastIndexOf('.');
  return extensionIndex > 0 ? `${sanitized.slice(0, extensionIndex)}${suffix}${sanitized.slice(extensionIndex)}` : `${sanitized}${suffix}`;
}

function sanitizeFileBaseName(name: string): string {
  return sanitizeFileName(name.replace(/\.(aaf|omf|xml)$/i, '') || 'open-factory-nle-export').replace(/\.[^.]+$/, '');
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_').replace(/\s+/g, ' ').trim() || 'open-factory';
}

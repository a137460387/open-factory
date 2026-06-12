import { getProjectSequences, type Clip, type MediaAsset, type Project } from '../model';
import { getTimelineDuration } from '../timeline';
import { normalizePath } from './relative-paths';

export interface OfflineMediaFileStatus {
  path: string;
  exists: boolean;
  size?: number;
}

export interface OfflineMediaReportOptions {
  estimatedExportSizeBytes?: number;
  generatedAt?: string;
}

export interface OfflineMediaReportRow {
  assetId: string;
  assetName: string;
  assetType: MediaAsset['type'];
  path: string;
  exists: boolean;
  sizeBytes: number;
  hasProxy: boolean;
  timelineAppearances: number;
}

export interface OfflineMediaReportTotals {
  durationSeconds: number;
  mediaSizeBytes: number;
  estimatedExportSizeBytes: number;
  missingCount: number;
}

export interface OfflineMediaReport {
  projectName: string;
  generatedAt: string;
  rows: OfflineMediaReportRow[];
  totals: OfflineMediaReportTotals;
}

export interface ProjectArchivePreflight {
  missingRows: OfflineMediaReportRow[];
  missingPaths: string[];
}

export function collectOfflineMediaReportPaths(project: Project): string[] {
  const paths = new Map<string, string>();
  for (const asset of project.media) {
    addPath(paths, asset.path);
    for (const framePath of asset.imageSequence?.paths ?? []) {
      addPath(paths, framePath);
    }
    addPath(paths, asset.proxyPath);
  }
  return Array.from(paths.values());
}

export function buildOfflineMediaReport(project: Project, fileStatuses: OfflineMediaFileStatus[] = [], options: OfflineMediaReportOptions = {}): OfflineMediaReport {
  const statusByPath = new Map(fileStatuses.map((status) => [pathKey(status.path), status]));
  const appearancesByMediaId = countTimelineAppearances(project);
  const rows = project.media.flatMap((asset) =>
    collectAssetReportPaths(asset).map((path) => {
      const status = statusByPath.get(pathKey(path));
      const exists = asset.missing ? false : (status?.exists ?? true);
      const proxyStatus = asset.proxyPath ? statusByPath.get(pathKey(asset.proxyPath)) : undefined;
      return {
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        path,
        exists,
        sizeBytes: exists ? normalizeSize(status?.size ?? (pathKey(path) === pathKey(asset.path) ? asset.size : undefined)) : 0,
        hasProxy: Boolean(asset.proxyPath && asset.proxyStatus !== 'error' && proxyStatus?.exists !== false),
        timelineAppearances: appearancesByMediaId.get(asset.id) ?? 0
      };
    })
  );
  const mediaSizeBytes = sumUniqueExistingPathSizes(rows);
  const durationSeconds = getTimelineDuration(project.timeline);
  return {
    projectName: project.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rows,
    totals: {
      durationSeconds,
      mediaSizeBytes,
      estimatedExportSizeBytes: options.estimatedExportSizeBytes ?? estimateDefaultExportSizeBytes(project, durationSeconds),
      missingCount: rows.filter((row) => !row.exists).length
    }
  };
}

export function buildProjectArchivePreflight(project: Project, fileStatuses: OfflineMediaFileStatus[] = []): ProjectArchivePreflight {
  const report = buildOfflineMediaReport(project, fileStatuses);
  const missingRows = report.rows.filter((row) => !row.exists);
  return {
    missingRows,
    missingPaths: missingRows.map((row) => row.path)
  };
}

export function renderOfflineMediaReportHtml(report: OfflineMediaReport): string {
  const rows = report.rows
    .map(
      (row) => `
        <tr class="${row.exists ? '' : 'missing-media'}">
          <td>${escapeHtml(row.assetName)}</td>
          <td>${escapeHtml(row.assetType)}</td>
          <td><code>${escapeHtml(row.path)}</code></td>
          <td>${row.exists ? '存在' : '缺失'}</td>
          <td>${formatBytes(row.sizeBytes)}</td>
          <td>${row.hasProxy ? '是' : '否'}</td>
          <td>${row.timelineAppearances}</td>
        </tr>`
    )
    .join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>素材报告 - ${escapeHtml(report.projectName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    .meta { color: #64748b; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d7dde8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    code { word-break: break-all; }
    .missing-media { background: #fff1f2; color: #9f1239; }
    .totals { margin-top: 20px; border: 1px solid #d7dde8; padding: 12px; background: #f8fafc; }
    .totals div { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>素材报告：${escapeHtml(report.projectName)}</h1>
  <div class="meta">生成时间：${escapeHtml(report.generatedAt)}</div>
  <table>
    <thead>
      <tr>
        <th>素材名称</th>
        <th>类型</th>
        <th>媒体路径</th>
        <th>是否存在</th>
        <th>文件大小</th>
        <th>是否有 proxy</th>
        <th>时间线出现次数</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>项目总时长：${formatDuration(report.totals.durationSeconds)}</div>
    <div>总媒体大小：${formatBytes(report.totals.mediaSizeBytes)}</div>
    <div>导出预估大小：${formatBytes(report.totals.estimatedExportSizeBytes)}</div>
    <div>缺失媒体数量：${report.totals.missingCount}</div>
  </div>
</body>
</html>`;
}

export function buildOfflineMediaReportHtml(project: Project, fileStatuses: OfflineMediaFileStatus[] = [], options: OfflineMediaReportOptions = {}): string {
  return renderOfflineMediaReportHtml(buildOfflineMediaReport(project, fileStatuses, options));
}

function collectAssetReportPaths(asset: MediaAsset): string[] {
  const paths = new Map<string, string>();
  addPath(paths, asset.path);
  for (const framePath of asset.imageSequence?.paths ?? []) {
    addPath(paths, framePath);
  }
  return Array.from(paths.values());
}

function countTimelineAppearances(project: Project): Map<string, number> {
  const counts = new Map<string, number>();
  for (const sequence of getProjectSequences(project)) {
    for (const track of sequence.timeline.tracks) {
      for (const clip of track.clips) {
        const mediaId = getClipMediaId(clip);
        if (mediaId) {
          counts.set(mediaId, (counts.get(mediaId) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

function getClipMediaId(clip: Clip): string | undefined {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image' ? clip.mediaId : undefined;
}

function sumUniqueExistingPathSizes(rows: OfflineMediaReportRow[]): number {
  const sizes = new Map<string, number>();
  for (const row of rows) {
    if (row.exists) {
      sizes.set(pathKey(row.path), Math.max(sizes.get(pathKey(row.path)) ?? 0, row.sizeBytes));
    }
  }
  return Array.from(sizes.values()).reduce((total, size) => total + size, 0);
}

function estimateDefaultExportSizeBytes(project: Project, durationSeconds: number): number {
  const duration = Math.max(0.001, durationSeconds);
  const pixelsPerSecond = Math.max(1, project.settings.width * project.settings.height * project.settings.fps);
  const videoBitsPerSecond = Math.min(35_000_000, Math.max(2_000_000, pixelsPerSecond * 0.16));
  const audioBitsPerSecond = 128_000;
  return Math.max(1024, Math.round(((videoBitsPerSecond + audioBitsPerSecond) * duration) / 8));
}

function normalizeSize(size: number | undefined): number {
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? Math.round(size) : 0;
}

function addPath(paths: Map<string, string>, path: string | undefined): void {
  if (!path?.trim()) {
    return;
  }
  const normalized = normalizePath(path);
  paths.set(pathKey(normalized), normalized);
}

function pathKey(path: string): string {
  return normalizePath(path).toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    : `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

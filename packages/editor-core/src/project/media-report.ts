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
  totalUsedDurationSeconds: number;
  usageSegments: MediaUsageSegment[];
}

export interface OfflineMediaReportTotals {
  durationSeconds: number;
  mediaSizeBytes: number;
  estimatedExportSizeBytes: number;
  missingCount: number;
  totalUsedDurationSeconds: number;
}

export interface MediaUsageSegment {
  sequenceId: string;
  sequenceName: string;
  trackId: string;
  trackName: string;
  clipId: string;
  clipName: string;
  start: number;
  end: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
}

export interface MediaUsageStat {
  assetId: string;
  assetName: string;
  assetType: MediaAsset['type'];
  appearanceCount: number;
  totalUsedDurationSeconds: number;
  segments: MediaUsageSegment[];
}

export interface TimelineHeatmapBucket {
  start: number;
  end: number;
  overlapCount: number;
  intensity: number;
}

export interface OfflineMediaReport {
  projectName: string;
  generatedAt: string;
  rows: OfflineMediaReportRow[];
  totals: OfflineMediaReportTotals;
  usageStats: MediaUsageStat[];
  heatmap: TimelineHeatmapBucket[];
  unusedMedia: OfflineMediaReportRow[];
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
  const usageStats = buildMediaUsageStats(project);
  const usageStatsByMediaId = new Map(usageStats.map((stat) => [stat.assetId, stat]));
  const rows = project.media.flatMap((asset) =>
    collectAssetReportPaths(asset).map((path) => {
      const status = statusByPath.get(pathKey(path));
      const exists = asset.missing ? false : (status?.exists ?? true);
      const proxyStatus = asset.proxyPath ? statusByPath.get(pathKey(asset.proxyPath)) : undefined;
      const usageStat = usageStatsByMediaId.get(asset.id);
      return {
        assetId: asset.id,
        assetName: asset.name,
        assetType: asset.type,
        path,
        exists,
        sizeBytes: exists ? normalizeSize(status?.size ?? (pathKey(path) === pathKey(asset.path) ? asset.size : undefined)) : 0,
        hasProxy: Boolean(asset.proxyPath && asset.proxyStatus !== 'error' && proxyStatus?.exists !== false),
        timelineAppearances: usageStat?.appearanceCount ?? 0,
        totalUsedDurationSeconds: usageStat?.totalUsedDurationSeconds ?? 0,
        usageSegments: usageStat?.segments ?? []
      };
    })
  );
  const mediaSizeBytes = sumUniqueExistingPathSizes(rows);
  const durationSeconds = getTimelineDuration(project.timeline);
  const unusedMedia = rows.filter((row) => row.timelineAppearances === 0);
  return {
    projectName: project.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rows,
    usageStats,
    heatmap: buildTimelineHeatmapData(project),
    unusedMedia,
    totals: {
      durationSeconds,
      mediaSizeBytes,
      estimatedExportSizeBytes: options.estimatedExportSizeBytes ?? estimateDefaultExportSizeBytes(project, durationSeconds),
      missingCount: rows.filter((row) => !row.exists).length,
      totalUsedDurationSeconds: usageStats.reduce((total, stat) => total + stat.totalUsedDurationSeconds, 0)
    }
  };
}

export function buildMediaUsageStats(project: Project): MediaUsageStat[] {
  const assetsById = new Map(project.media.map((asset) => [asset.id, asset]));
  const stats = new Map<string, MediaUsageStat>();
  for (const sequence of getProjectSequences(project)) {
    for (const track of sequence.timeline.tracks) {
      for (const clip of track.clips) {
        const mediaId = getClipMediaId(clip);
        const asset = mediaId ? assetsById.get(mediaId) : undefined;
        if (!mediaId || !asset || clip.duration <= 0) {
          continue;
        }
        const current =
          stats.get(mediaId) ??
          ({
            assetId: asset.id,
            assetName: asset.name,
            assetType: asset.type,
            appearanceCount: 0,
            totalUsedDurationSeconds: 0,
            segments: []
          } satisfies MediaUsageStat);
        const duration = Math.max(0, clip.duration);
        current.segments.push({
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          trackId: track.id,
          trackName: track.name,
          clipId: clip.id,
          clipName: clip.name,
          start: clip.start,
          end: clip.start + duration,
          duration,
          trimStart: 'trimStart' in clip ? clip.trimStart : 0,
          trimEnd: 'trimEnd' in clip ? clip.trimEnd : 0
        });
        current.appearanceCount += 1;
        current.totalUsedDurationSeconds += duration;
        stats.set(mediaId, current);
      }
    }
  }
  return Array.from(stats.values()).sort((left, right) => left.assetName.localeCompare(right.assetName) || left.assetId.localeCompare(right.assetId));
}

export function buildTimelineHeatmapData(project: Project, bucketCount = 24): TimelineHeatmapBucket[] {
  const duration = getTimelineDuration(project.timeline);
  if (duration <= 0) {
    return [];
  }
  const safeBucketCount = Math.min(120, Math.max(1, Math.round(bucketCount)));
  const bucketDuration = duration / safeBucketCount;
  const clips = project.timeline.tracks.flatMap((track) => track.clips).filter((clip) => clip.duration > 0);
  const buckets = Array.from({ length: safeBucketCount }, (_, index) => {
    const start = index * bucketDuration;
    const end = index === safeBucketCount - 1 ? duration : start + bucketDuration;
    return {
      start,
      end,
      overlapCount: clips.filter((clip) => clip.start < end && clip.start + clip.duration > start).length,
      intensity: 0
    };
  });
  const maxOverlap = Math.max(1, ...buckets.map((bucket) => bucket.overlapCount));
  return buckets.map((bucket) => ({ ...bucket, intensity: bucket.overlapCount / maxOverlap }));
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
          <td>${formatDuration(row.totalUsedDurationSeconds)}</td>
          <td>${renderUsageSegmentList(row.usageSegments)}</td>
        </tr>`
    )
    .join('');
  const heatmap = renderHeatmap(report.heatmap);
  const unusedMedia = renderUnusedMediaList(report.unusedMedia);
  const durationPie = renderDurationPieChart(report.usageStats);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>素材使用分析 - ${escapeHtml(report.projectName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    .meta { color: #64748b; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d7dde8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    code { word-break: break-all; }
    .missing-media { background: #fff1f2; color: #9f1239; }
    .totals { margin-top: 20px; border: 1px solid #d7dde8; padding: 12px; background: #f8fafc; }
    .totals div { margin: 4px 0; }
    .usage-list, .unused-list { margin: 0; padding-left: 18px; }
    .usage-list li, .unused-list li { margin: 3px 0; }
    .unused-list button { margin-left: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; padding: 2px 6px; cursor: pointer; }
    .heatmap { display: grid; grid-template-columns: repeat(${Math.max(1, report.heatmap.length)}, minmax(12px, 1fr)); gap: 3px; align-items: end; }
    .heatmap-cell { min-height: 32px; border: 1px solid rgba(15, 23, 42, 0.12); border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #0f172a; font-size: 11px; }
    .chart-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
    .legend { margin: 0; padding: 0; list-style: none; font-size: 12px; }
    .legend li { margin: 4px 0; }
    .swatch { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>素材使用分析：${escapeHtml(report.projectName)}</h1>
  <div class="meta">生成时间：${escapeHtml(report.generatedAt)}</div>
  <h2>素材使用明细</h2>
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
        <th>总使用时长</th>
        <th>使用片段列表</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>使用率热力图</h2>
  ${heatmap}
  <h2>未使用媒体</h2>
  ${unusedMedia}
  <h2>导出时长分布</h2>
  ${durationPie}
  <div class="totals">
    <div>项目总时长：${formatDuration(report.totals.durationSeconds)}</div>
    <div>总媒体大小：${formatBytes(report.totals.mediaSizeBytes)}</div>
    <div>导出预估大小：${formatBytes(report.totals.estimatedExportSizeBytes)}</div>
    <div>素材累计使用时长：${formatDuration(report.totals.totalUsedDurationSeconds)}</div>
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

function renderUsageSegmentList(segments: MediaUsageSegment[]): string {
  if (segments.length === 0) {
    return '未使用';
  }
  return `<ul class="usage-list">${segments
    .map(
      (segment) =>
        `<li>${escapeHtml(segment.sequenceName)} / ${escapeHtml(segment.trackName)} / ${escapeHtml(segment.clipName)}：${formatDuration(segment.start)} - ${formatDuration(segment.end)}（${formatDuration(segment.duration)}）</li>`
    )
    .join('')}</ul>`;
}

function renderHeatmap(buckets: TimelineHeatmapBucket[]): string {
  if (buckets.length === 0) {
    return '<div class="meta">暂无时间线使用数据。</div>';
  }
  return `<div class="heatmap">${buckets
    .map((bucket) => {
      const alpha = 0.1 + bucket.intensity * 0.78;
      const title = `${formatDuration(bucket.start)} - ${formatDuration(bucket.end)}：${bucket.overlapCount} 个叠加片段`;
      return `<div class="heatmap-cell" title="${escapeHtml(title)}" style="background: rgba(37, 99, 235, ${alpha.toFixed(2)})"><span>${bucket.overlapCount}</span></div>`;
    })
    .join('')}</div>`;
}

function renderUnusedMediaList(rows: OfflineMediaReportRow[]): string {
  if (rows.length === 0) {
    return '<div class="meta">无未使用媒体。</div>';
  }
  return `<ul class="unused-list">${rows
    .map(
      (row) =>
        `<li data-media-id="${escapeHtml(row.assetId)}"><span>${escapeHtml(row.assetName)} <code>${escapeHtml(row.path)}</code></span><button type="button" onclick="this.closest('li').remove()">从媒体库移除</button></li>`
    )
    .join('')}</ul>`;
}

function renderDurationPieChart(stats: MediaUsageStat[]): string {
  const used = stats.filter((stat) => stat.totalUsedDurationSeconds > 0);
  const total = used.reduce((sum, stat) => sum + stat.totalUsedDurationSeconds, 0);
  if (total <= 0) {
    return '<svg width="260" height="120" role="img" aria-label="导出时长分布"><text x="12" y="60" fill="#64748b">暂无使用时长</text></svg>';
  }
  const colors = ['#2563eb', '#16a34a', '#f97316', '#db2777', '#7c3aed', '#0891b2', '#ca8a04', '#475569'];
  let cursor = -Math.PI / 2;
  const slices = used
    .map((stat, index) => {
      const angle = (stat.totalUsedDurationSeconds / total) * Math.PI * 2;
      const start = cursor;
      const end = cursor + angle;
      cursor = end;
      const color = colors[index % colors.length];
      return {
        stat,
        color,
        path: used.length === 1 ? `<circle cx="80" cy="80" r="64" fill="${color}" />` : `<path d="${describePieSlice(80, 80, 64, start, end)}" fill="${color}" />`
      };
    })
    .map((slice) => slice.path)
    .join('');
  const legend = used
    .map((stat, index) => {
      const color = colors[index % colors.length];
      const percent = ((stat.totalUsedDurationSeconds / total) * 100).toFixed(1);
      return `<li><span class="swatch" style="background:${color}"></span>${escapeHtml(stat.assetName)}：${percent}%（${formatDuration(stat.totalUsedDurationSeconds)}）</li>`;
    })
    .join('');
  return `<div class="chart-wrap"><svg width="180" height="160" viewBox="0 0 180 160" role="img" aria-label="导出时长分布">${slices}</svg><ul class="legend">${legend}</ul></div>`;
}

function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: string; y: string } {
  return {
    x: (cx + radius * Math.cos(angle)).toFixed(3),
    y: (cy + radius * Math.sin(angle)).toFixed(3)
  };
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

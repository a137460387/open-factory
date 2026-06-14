import type { Clip, MediaAsset, Project, TimelineMarker, Track } from '../model';
import { getTimelineDuration } from '../timeline';
import { secondsToTimecode } from '../time';
import { normalizePath } from './relative-paths';

export interface ClipReportOptions {
  generatedAt?: string;
  exportPresetName?: string;
}

export interface ClipReportOverview {
  projectName: string;
  duration: number;
  fps: number;
  trackCount: number;
  clipCount: number;
  exportPresetName: string;
  generatedAt: string;
}

export interface ClipReportClipRow {
  index: number;
  clipId: string;
  name: string;
  type: Clip['type'];
  trackName: string;
  inPoint: number;
  outPoint: number;
  start: number;
  duration: number;
  effectTypes: string[];
  keyframeCount: number;
}

export interface ClipReportMediaRow {
  mediaId: string;
  fileName: string;
  format: string;
  resolution: string;
  duration: number;
  useCount: number;
}

export interface ClipReportSubtitleRow {
  clipId: string;
  text: string;
  trackName: string;
  start: number;
  duration: number;
}

export interface ClipReportMarkerRow {
  markerId: string;
  name: string;
  time: number;
  color: string;
}

export interface ClipReport {
  overview: ClipReportOverview;
  clips: ClipReportClipRow[];
  media: ClipReportMediaRow[];
  subtitles: ClipReportSubtitleRow[];
  markers: ClipReportMarkerRow[];
}

export function buildClipReport(project: Project, options: ClipReportOptions = {}): ClipReport {
  const tracks = project.timeline.tracks;
  const clips = tracks.flatMap((track) => track.clips.map((clip) => clipToReportRow(clip, track, 0)));
  const indexedClips = clips
    .sort((left, right) => left.start - right.start || left.trackName.localeCompare(right.trackName) || left.name.localeCompare(right.name))
    .map((row, index) => ({ ...row, index: index + 1 }));
  return {
    overview: {
      projectName: project.name,
      duration: getTimelineDuration(project.timeline),
      fps: project.settings.fps,
      trackCount: tracks.length,
      clipCount: indexedClips.length,
      exportPresetName: options.exportPresetName?.trim() || '未指定',
      generatedAt: options.generatedAt ?? new Date().toISOString()
    },
    clips: indexedClips,
    media: buildClipReportMediaRows(project),
    subtitles: buildClipReportSubtitleRows(tracks),
    markers: buildClipReportMarkerRows(project.timeline.markers ?? [])
  };
}

export function buildClipReportHtml(project: Project, options: ClipReportOptions = {}): string {
  return renderClipReportHtml(buildClipReport(project, options));
}

export function renderClipReportHtml(report: ClipReport): string {
  const fps = report.overview.fps;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>剪辑报告 - ${escapeHtml(report.overview.projectName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #172033; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    .meta { color: #64748b; margin-bottom: 20px; }
    .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; border: 1px solid #d7dde8; background: #f8fafc; padding: 12px; }
    .overview div { display: grid; gap: 3px; }
    .overview span { color: #64748b; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d7dde8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    code { word-break: break-all; }
    .empty { color: #64748b; }
  </style>
</head>
<body>
  <h1>剪辑报告：${escapeHtml(report.overview.projectName)}</h1>
  <div class="meta">生成时间：${escapeHtml(report.overview.generatedAt)}</div>
  <section class="overview" data-section="project-overview">
    <div><span>标题</span><strong>${escapeHtml(report.overview.projectName)}</strong></div>
    <div><span>时长</span><strong>${formatDuration(report.overview.duration, fps)}</strong></div>
    <div><span>帧率</span><strong>${formatNumber(report.overview.fps)} fps</strong></div>
    <div><span>轨道数</span><strong>${report.overview.trackCount}</strong></div>
    <div><span>Clip 总数</span><strong>${report.overview.clipCount}</strong></div>
    <div><span>导出预设</span><strong>${escapeHtml(report.overview.exportPresetName)}</strong></div>
  </section>
  <h2>Clip 清单</h2>
  <table data-section="clip-list">
    <thead>
      <tr><th>序号</th><th>名称</th><th>轨道</th><th>入点</th><th>出点</th><th>时长</th><th>特效列表</th><th>关键帧数</th></tr>
    </thead>
    <tbody>${renderClipRows(report.clips, fps)}</tbody>
  </table>
  <h2>使用媒体列表</h2>
  <table data-section="media-list">
    <thead>
      <tr><th>文件名</th><th>格式</th><th>分辨率</th><th>时长</th><th>使用次数</th></tr>
    </thead>
    <tbody>${renderMediaRows(report.media, fps)}</tbody>
  </table>
  <h2>字幕列表</h2>
  <table data-section="subtitle-list">
    <thead>
      <tr><th>文本</th><th>轨道</th><th>起始时间</th><th>时长</th></tr>
    </thead>
    <tbody>${renderSubtitleRows(report.subtitles, fps)}</tbody>
  </table>
  <h2>标记点列表</h2>
  <table data-section="marker-list">
    <thead>
      <tr><th>名称</th><th>时间</th><th>颜色</th></tr>
    </thead>
    <tbody>${renderMarkerRows(report.markers, fps)}</tbody>
  </table>
</body>
</html>`;
}

function clipToReportRow(clip: Clip, track: Track, index: number): ClipReportClipRow {
  return {
    index,
    clipId: clip.id,
    name: clip.name,
    type: clip.type,
    trackName: track.name,
    inPoint: clip.trimStart,
    outPoint: resolveClipOutPoint(clip),
    start: clip.start,
    duration: clip.duration,
    effectTypes: (clip.effects ?? []).map((effect) => effect.type),
    keyframeCount: countClipKeyframes(clip)
  };
}

function buildClipReportMediaRows(project: Project): ClipReportMediaRow[] {
  const assetsById = new Map(project.media.map((asset) => [asset.id, asset]));
  const rows = new Map<string, ClipReportMediaRow>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      const asset = getClipMediaAsset(clip, assetsById);
      if (!asset) {
        continue;
      }
      const key = pathKey(asset.path || asset.id);
      const current = rows.get(key) ?? assetToMediaRow(asset);
      current.useCount += 1;
      rows.set(key, current);
    }
  }
  return Array.from(rows.values()).sort((left, right) => left.fileName.localeCompare(right.fileName) || left.mediaId.localeCompare(right.mediaId));
}

function buildClipReportSubtitleRows(tracks: Track[]): ClipReportSubtitleRow[] {
  return tracks.flatMap((track) =>
    track.clips.flatMap((clip) =>
      clip.type === 'subtitle'
        ? [
            {
              clipId: clip.id,
              text: clip.text,
              trackName: track.name,
              start: clip.start,
              duration: clip.duration
            }
          ]
        : []
    )
  );
}

function buildClipReportMarkerRows(markers: TimelineMarker[]): ClipReportMarkerRow[] {
  return markers
    .map((marker) => ({
      markerId: marker.id,
      name: marker.label,
      time: marker.time,
      color: marker.color
    }))
    .sort((left, right) => left.time - right.time || left.name.localeCompare(right.name));
}

function assetToMediaRow(asset: MediaAsset): ClipReportMediaRow {
  return {
    mediaId: asset.id,
    fileName: getFileName(asset.path) || asset.name,
    format: getMediaFormat(asset),
    resolution: asset.width > 0 && asset.height > 0 ? `${asset.width} x ${asset.height}` : '-',
    duration: asset.duration,
    useCount: 0
  };
}

function getClipMediaAsset(clip: Clip, assetsById: Map<string, MediaAsset>): MediaAsset | undefined {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image' ? assetsById.get(clip.mediaId) : undefined;
}

function resolveClipOutPoint(clip: Clip): number {
  if (clip.trimEnd > clip.trimStart) {
    return clip.trimEnd;
  }
  return clip.trimStart + clip.duration * Math.max(0.0001, clip.speed || 1);
}

function countClipKeyframes(clip: Clip): number {
  return Object.values(clip.keyframes ?? {}).reduce((count, frames) => count + (Array.isArray(frames) ? frames.length : 0), 0);
}

function renderClipRows(rows: ClipReportClipRow[], fps: number): string {
  if (rows.length === 0) {
    return '<tr><td colspan="8" class="empty">无 clip。</td></tr>';
  }
  return rows
    .map(
      (row) => `<tr data-clip-id="${escapeHtml(row.clipId)}">
        <td>${row.index}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.trackName)}</td>
        <td>${formatDuration(row.inPoint, fps)}</td>
        <td>${formatDuration(row.outPoint, fps)}</td>
        <td>${formatDuration(row.duration, fps)}</td>
        <td>${row.effectTypes.length > 0 ? row.effectTypes.map(escapeHtml).join(', ') : '-'}</td>
        <td>${row.keyframeCount}</td>
      </tr>`
    )
    .join('');
}

function renderMediaRows(rows: ClipReportMediaRow[], fps: number): string {
  if (rows.length === 0) {
    return '<tr><td colspan="5" class="empty">无使用媒体。</td></tr>';
  }
  return rows
    .map(
      (row) => `<tr data-media-id="${escapeHtml(row.mediaId)}">
        <td><code>${escapeHtml(row.fileName)}</code></td>
        <td>${escapeHtml(row.format)}</td>
        <td>${escapeHtml(row.resolution)}</td>
        <td>${formatDuration(row.duration, fps)}</td>
        <td>${row.useCount}</td>
      </tr>`
    )
    .join('');
}

function renderSubtitleRows(rows: ClipReportSubtitleRow[], fps: number): string {
  if (rows.length === 0) {
    return '<tr><td colspan="4" class="empty">无字幕。</td></tr>';
  }
  return rows
    .map(
      (row) => `<tr data-clip-id="${escapeHtml(row.clipId)}">
        <td>${escapeHtml(row.text)}</td>
        <td>${escapeHtml(row.trackName)}</td>
        <td>${formatDuration(row.start, fps)}</td>
        <td>${formatDuration(row.duration, fps)}</td>
      </tr>`
    )
    .join('');
}

function renderMarkerRows(rows: ClipReportMarkerRow[], fps: number): string {
  if (rows.length === 0) {
    return '<tr><td colspan="3" class="empty">无标记点。</td></tr>';
  }
  return rows
    .map(
      (row) => `<tr data-marker-id="${escapeHtml(row.markerId)}">
        <td>${escapeHtml(row.name)}</td>
        <td>${formatDuration(row.time, fps)}</td>
        <td>${escapeHtml(row.color)}</td>
      </tr>`
    )
    .join('');
}

function getFileName(path: string): string {
  return normalizePath(path).split('/').filter(Boolean).at(-1) ?? path;
}

function getMediaFormat(asset: MediaAsset): string {
  const extension = getFileName(asset.path).split('.').at(-1);
  return extension && extension !== getFileName(asset.path) ? extension.toLowerCase() : asset.type;
}

function pathKey(path: string): string {
  return normalizePath(path).toLowerCase();
}

function formatDuration(seconds: number, fps: number): string {
  return secondsToTimecode(Math.max(0, seconds), fps, 'ndf');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import type { Clip, MediaAsset, Project, TimelineMarker, Track } from '../model';
import { getTimelineDuration } from '../timeline';
import { normalizePath } from './relative-paths';
import {
  formatReportDuration,
  formatReportNumber,
  normalizeReportLocale,
  reportHtmlLang,
  reportLanguageLabel,
  type ReportLocale,
} from './report-i18n';

export interface ClipReportOptions {
  generatedAt?: string;
  exportPresetName?: string;
  locale?: ReportLocale;
}

export interface ClipReportOverview {
  projectName: string;
  duration: number;
  fps: number;
  trackCount: number;
  clipCount: number;
  exportPresetName: string;
  generatedAt: string;
  locale: ReportLocale;
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

const clipReportLabels: Record<ReportLocale, Record<string, string>> = {
  zh: {
    title: '剪辑报告',
    generatedAt: '生成时间',
    language: '语言',
    project: '标题',
    duration: '时长',
    fps: '帧率',
    trackCount: '轨道数',
    clipCount: 'Clip 总数',
    exportPreset: '导出预设',
    clipList: 'Clip 清单',
    mediaList: '使用媒体列表',
    subtitleList: '字幕列表',
    markerList: '标记点列表',
    index: '序号',
    name: '名称',
    track: '轨道',
    inPoint: '入点',
    outPoint: '出点',
    effects: '特效列表',
    keyframes: '关键帧数',
    fileName: '文件名',
    format: '格式',
    resolution: '分辨率',
    useCount: '使用次数',
    text: '文本',
    start: '起始时间',
    time: '时间',
    color: '颜色',
    unspecified: '未指定',
    none: '-',
    emptyClips: '无 clip。',
    emptyMedia: '无使用媒体。',
    emptySubtitles: '无字幕。',
    emptyMarkers: '无标记点。',
  },
  en: {
    title: 'Clip Report',
    generatedAt: 'Generated At',
    language: 'Language',
    project: 'Project',
    duration: 'Duration',
    fps: 'Frame Rate',
    trackCount: 'Tracks',
    clipCount: 'Clip Count',
    exportPreset: 'Export Preset',
    clipList: 'Clip List',
    mediaList: 'Media Used',
    subtitleList: 'Subtitles',
    markerList: 'Markers',
    index: '#',
    name: 'Name',
    track: 'Track',
    inPoint: 'In',
    outPoint: 'Out',
    effects: 'Effects',
    keyframes: 'Keyframes',
    fileName: 'File Name',
    format: 'Format',
    resolution: 'Resolution',
    useCount: 'Uses',
    text: 'Text',
    start: 'Start',
    time: 'Time',
    color: 'Color',
    unspecified: 'Unspecified',
    none: 'None',
    emptyClips: 'No clips.',
    emptyMedia: 'No media used.',
    emptySubtitles: 'No subtitles.',
    emptyMarkers: 'No markers.',
  },
};

export function buildClipReport(project: Project, options: ClipReportOptions = {}): ClipReport {
  const tracks = project.timeline.tracks;
  const locale = normalizeReportLocale(options.locale);
  const clips = tracks.flatMap((track) => track.clips.map((clip) => clipToReportRow(clip, track, 0)));
  const indexedClips = clips
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.trackName.localeCompare(right.trackName) ||
        left.name.localeCompare(right.name),
    )
    .map((row, index) => ({ ...row, index: index + 1 }));
  return {
    overview: {
      projectName: project.name,
      duration: getTimelineDuration(project.timeline),
      fps: project.settings.fps,
      trackCount: tracks.length,
      clipCount: indexedClips.length,
      exportPresetName: options.exportPresetName?.trim() || clipReportLabels[locale].unspecified,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      locale,
    },
    clips: indexedClips,
    media: buildClipReportMediaRows(project),
    subtitles: buildClipReportSubtitleRows(tracks),
    markers: buildClipReportMarkerRows(project.timeline.markers ?? []),
  };
}

export function buildClipReportHtml(project: Project, options: ClipReportOptions = {}): string {
  return renderClipReportHtml(buildClipReport(project, options));
}

export function renderClipReportHtml(report: ClipReport): string {
  const locale = report.overview.locale;
  const labels = clipReportLabels[locale];
  return `<!doctype html>
<html lang="${reportHtmlLang(locale)}">
<head>
  <meta charset="utf-8" />
  <title>${labels.title} - ${escapeHtml(report.overview.projectName)}</title>
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
  <h1>${labels.title}：${escapeHtml(report.overview.projectName)}</h1>
  <div class="meta">${labels.generatedAt}：${escapeHtml(report.overview.generatedAt)} · ${labels.language}：${reportLanguageLabel(locale)}</div>
  <section class="overview" data-section="project-overview">
    <div><span>${labels.project}</span><strong>${escapeHtml(report.overview.projectName)}</strong></div>
    <div><span>${labels.duration}</span><strong>${formatReportDuration(report.overview.duration, locale)}</strong></div>
    <div><span>${labels.fps}</span><strong>${formatReportNumber(report.overview.fps)} fps</strong></div>
    <div><span>${labels.trackCount}</span><strong>${report.overview.trackCount}</strong></div>
    <div><span>${labels.clipCount}</span><strong>${report.overview.clipCount}</strong></div>
    <div><span>${labels.exportPreset}</span><strong>${escapeHtml(report.overview.exportPresetName)}</strong></div>
  </section>
  <h2>${labels.clipList}</h2>
  <table data-section="clip-list">
    <thead>
      <tr><th>${labels.index}</th><th>${labels.name}</th><th>${labels.track}</th><th>${labels.inPoint}</th><th>${labels.outPoint}</th><th>${labels.duration}</th><th>${labels.effects}</th><th>${labels.keyframes}</th></tr>
    </thead>
    <tbody>${renderClipRows(report.clips, locale)}</tbody>
  </table>
  <h2>${labels.mediaList}</h2>
  <table data-section="media-list">
    <thead>
      <tr><th>${labels.fileName}</th><th>${labels.format}</th><th>${labels.resolution}</th><th>${labels.duration}</th><th>${labels.useCount}</th></tr>
    </thead>
    <tbody>${renderMediaRows(report.media, locale)}</tbody>
  </table>
  <h2>${labels.subtitleList}</h2>
  <table data-section="subtitle-list">
    <thead>
      <tr><th>${labels.text}</th><th>${labels.track}</th><th>${labels.start}</th><th>${labels.duration}</th></tr>
    </thead>
    <tbody>${renderSubtitleRows(report.subtitles, locale)}</tbody>
  </table>
  <h2>${labels.markerList}</h2>
  <table data-section="marker-list">
    <thead>
      <tr><th>${labels.name}</th><th>${labels.time}</th><th>${labels.color}</th></tr>
    </thead>
    <tbody>${renderMarkerRows(report.markers, locale)}</tbody>
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
    keyframeCount: countClipKeyframes(clip),
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
  return Array.from(rows.values()).sort(
    (left, right) => left.fileName.localeCompare(right.fileName) || left.mediaId.localeCompare(right.mediaId),
  );
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
              duration: clip.duration,
            },
          ]
        : [],
    ),
  );
}

function buildClipReportMarkerRows(markers: TimelineMarker[]): ClipReportMarkerRow[] {
  return markers
    .map((marker) => ({
      markerId: marker.id,
      name: marker.label,
      time: marker.time,
      color: marker.color,
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
    useCount: 0,
  };
}

function getClipMediaAsset(clip: Clip, assetsById: Map<string, MediaAsset>): MediaAsset | undefined {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image'
    ? assetsById.get(clip.mediaId)
    : undefined;
}

function resolveClipOutPoint(clip: Clip): number {
  if (clip.trimEnd > clip.trimStart) {
    return clip.trimEnd;
  }
  return clip.trimStart + clip.duration * Math.max(0.0001, clip.speed || 1);
}

function countClipKeyframes(clip: Clip): number {
  return Object.values(clip.keyframes ?? {}).reduce(
    (count, frames) => count + (Array.isArray(frames) ? frames.length : 0),
    0,
  );
}

function renderClipRows(rows: ClipReportClipRow[], locale: ReportLocale): string {
  const labels = clipReportLabels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="8" class="empty">${labels.emptyClips}</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr data-clip-id="${escapeHtml(row.clipId)}">
        <td>${row.index}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.trackName)}</td>
        <td>${formatReportDuration(row.inPoint, locale)}</td>
        <td>${formatReportDuration(row.outPoint, locale)}</td>
        <td>${formatReportDuration(row.duration, locale)}</td>
        <td>${row.effectTypes.length > 0 ? row.effectTypes.map(escapeHtml).join(', ') : labels.none}</td>
        <td>${row.keyframeCount}</td>
      </tr>`,
    )
    .join('');
}

function renderMediaRows(rows: ClipReportMediaRow[], locale: ReportLocale): string {
  const labels = clipReportLabels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="5" class="empty">${labels.emptyMedia}</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr data-media-id="${escapeHtml(row.mediaId)}">
        <td><code>${escapeHtml(row.fileName)}</code></td>
        <td>${escapeHtml(row.format)}</td>
        <td>${escapeHtml(row.resolution)}</td>
        <td>${formatReportDuration(row.duration, locale)}</td>
        <td>${row.useCount}</td>
      </tr>`,
    )
    .join('');
}

function renderSubtitleRows(rows: ClipReportSubtitleRow[], locale: ReportLocale): string {
  const labels = clipReportLabels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="4" class="empty">${labels.emptySubtitles}</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr data-clip-id="${escapeHtml(row.clipId)}">
        <td>${escapeHtml(row.text)}</td>
        <td>${escapeHtml(row.trackName)}</td>
        <td>${formatReportDuration(row.start, locale)}</td>
        <td>${formatReportDuration(row.duration, locale)}</td>
      </tr>`,
    )
    .join('');
}

function renderMarkerRows(rows: ClipReportMarkerRow[], locale: ReportLocale): string {
  const labels = clipReportLabels[locale];
  if (rows.length === 0) {
    return `<tr><td colspan="3" class="empty">${labels.emptyMarkers}</td></tr>`;
  }
  return rows
    .map(
      (row) => `<tr data-marker-id="${escapeHtml(row.markerId)}">
        <td>${escapeHtml(row.name)}</td>
        <td>${formatReportDuration(row.time, locale)}</td>
        <td>${escapeHtml(row.color)}</td>
      </tr>`,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

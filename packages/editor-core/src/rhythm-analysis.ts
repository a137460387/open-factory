import type { Clip, Project, Timeline } from './model';
import { getTimelineDuration } from './timeline';
import { formatReportDuration, normalizeReportLocale, reportHtmlLang, reportLanguageLabel, type ReportLocale } from './project/report-i18n';

export type RhythmReferenceType = 'advertising' | 'documentary' | 'variety' | 'short-video';

export interface RhythmShot {
  clipId: string;
  name: string;
  start: number;
  duration: number;
}

export interface RhythmCurvePoint {
  time: number;
  cutsPerSecond: number;
}

export interface RhythmChangePoint {
  time: number;
  previousClipId: string;
  nextClipId: string;
  previousDuration: number;
  nextDuration: number;
  ratio: number;
}

export interface RepeatedRhythmSegment {
  start: number;
  end: number;
  clipCount: number;
  averageDuration: number;
}

export interface RhythmReferenceProfile {
  type: RhythmReferenceType;
  averageShotDuration: number;
  typicalCutFrequency: number;
}

export interface RhythmAnalysisReport {
  projectName: string;
  generatedAt: string;
  duration: number;
  shotCount: number;
  averageShotDuration: number;
  shortestShotDuration: number;
  longestShotDuration: number;
  cutFrequencyCurve: RhythmCurvePoint[];
  changePoints: RhythmChangePoint[];
  repeatedSegments: RepeatedRhythmSegment[];
  references: RhythmReferenceProfile[];
  suggestions: string[];
}

export interface RhythmAnalysisOptions {
  generatedAt?: string;
  bucketSeconds?: number;
}

export const RHYTHM_REFERENCE_PROFILES: RhythmReferenceProfile[] = [
  { type: 'advertising', averageShotDuration: 2.2, typicalCutFrequency: 0.45 },
  { type: 'documentary', averageShotDuration: 6.5, typicalCutFrequency: 0.15 },
  { type: 'variety', averageShotDuration: 3.8, typicalCutFrequency: 0.26 },
  { type: 'short-video', averageShotDuration: 1.6, typicalCutFrequency: 0.62 }
];

export function analyzeClipRhythm(project: Project, options: RhythmAnalysisOptions = {}): RhythmAnalysisReport {
  const shots = collectRhythmShots(project.timeline);
  const durations = shots.map((shot) => shot.duration);
  const averageShotDuration = durations.length > 0 ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
  const repeatedSegments = detectRepeatedRhythmSegments(shots);
  const suggestions = repeatedSegments.map((segment) => `可考虑增加节奏变化：${segment.clipCount} 个连续镜头时长接近。`);
  return {
    projectName: project.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    duration: getTimelineDuration(project.timeline),
    shotCount: shots.length,
    averageShotDuration,
    shortestShotDuration: durations.length > 0 ? Math.min(...durations) : 0,
    longestShotDuration: durations.length > 0 ? Math.max(...durations) : 0,
    cutFrequencyCurve: calculateCutFrequencyCurve(shots, options.bucketSeconds),
    changePoints: detectRhythmChangePoints(shots),
    repeatedSegments,
    references: RHYTHM_REFERENCE_PROFILES.map((profile) => ({ ...profile })),
    suggestions
  };
}

export function collectRhythmShots(timeline: Timeline): RhythmShot[] {
  return timeline.tracks
    .flatMap((track) => track.clips)
    .filter(isRhythmShotClip)
    .filter((clip) => clip.duration > 0)
    .map((clip) => ({ clipId: clip.id, name: clip.name, start: clip.start, duration: clip.duration }))
    .sort((left, right) => left.start - right.start || left.clipId.localeCompare(right.clipId));
}

export function calculateCutFrequencyCurve(shots: RhythmShot[], bucketSeconds = 1): RhythmCurvePoint[] {
  if (shots.length === 0) {
    return [];
  }
  const safeBucketSeconds = Math.max(0.1, Number.isFinite(bucketSeconds) ? bucketSeconds : 1);
  const duration = Math.max(...shots.map((shot) => shot.start + shot.duration));
  const bucketCount = Math.max(1, Math.ceil(duration / safeBucketSeconds));
  const cutTimes = shots.slice(1).map((shot) => shot.start);
  return Array.from({ length: bucketCount }, (_, index) => {
    const start = index * safeBucketSeconds;
    const end = start + safeBucketSeconds;
    return {
      time: round(start),
      cutsPerSecond: round(cutTimes.filter((time) => time >= start && time < end).length / safeBucketSeconds)
    };
  });
}

export function detectRhythmChangePoints(shots: RhythmShot[]): RhythmChangePoint[] {
  const points: RhythmChangePoint[] = [];
  for (let index = 1; index < shots.length; index += 1) {
    const previous = shots[index - 1];
    const next = shots[index];
    const shorter = Math.max(0.001, Math.min(previous.duration, next.duration));
    const ratio = Math.max(previous.duration, next.duration) / shorter;
    if (ratio > 2) {
      points.push({
        time: next.start,
        previousClipId: previous.clipId,
        nextClipId: next.clipId,
        previousDuration: previous.duration,
        nextDuration: next.duration,
        ratio: round(ratio)
      });
    }
  }
  return points;
}

export function detectRepeatedRhythmSegments(shots: RhythmShot[], minClipCount = 10, tolerance = 0.12): RepeatedRhythmSegment[] {
  const segments: RepeatedRhythmSegment[] = [];
  let startIndex = 0;
  while (startIndex < shots.length) {
    let endIndex = startIndex + 1;
    while (endIndex < shots.length && durationsSimilar(shots[startIndex].duration, shots[endIndex].duration, tolerance)) {
      endIndex += 1;
    }
    const count = endIndex - startIndex;
    if (count >= minClipCount) {
      const group = shots.slice(startIndex, endIndex);
      segments.push({
        start: group[0].start,
        end: group[group.length - 1].start + group[group.length - 1].duration,
        clipCount: count,
        averageDuration: round(group.reduce((sum, shot) => sum + shot.duration, 0) / count)
      });
    }
    startIndex = Math.max(endIndex, startIndex + 1);
  }
  return segments;
}

export function serializeRhythmAnalysisJson(report: RhythmAnalysisReport): string {
  return JSON.stringify(report, null, 2);
}

export function buildRhythmAnalysisHtml(report: RhythmAnalysisReport, localeInput?: string): string {
  const locale = normalizeReportLocale(localeInput);
  const labels = rhythmLabels[locale];
  return `<!doctype html>
<html lang="${reportHtmlLang(locale)}">
<head>
  <meta charset="utf-8" />
  <title>${labels.title} - ${escapeHtml(report.projectName)}</title>
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
    .empty { color: #64748b; }
  </style>
</head>
<body>
  <h1>${labels.title}：${escapeHtml(report.projectName)}</h1>
  <div class="meta">${labels.generatedAt}：${escapeHtml(report.generatedAt)} · ${labels.language}：${reportLanguageLabel(locale)}</div>
  <section class="overview" data-section="rhythm-overview">
    <div><span>${labels.projectDuration}</span><strong>${formatReportDuration(report.duration, locale)}</strong></div>
    <div><span>${labels.shotCount}</span><strong>${report.shotCount}</strong></div>
    <div><span>${labels.averageShot}</span><strong>${formatReportDuration(report.averageShotDuration, locale)}</strong></div>
    <div><span>${labels.shortestShot}</span><strong>${formatReportDuration(report.shortestShotDuration, locale)}</strong></div>
    <div><span>${labels.longestShot}</span><strong>${formatReportDuration(report.longestShotDuration, locale)}</strong></div>
  </section>
  <h2>${labels.cutCurve}</h2>
  <table data-section="rhythm-cut-curve"><thead><tr><th>${labels.time}</th><th>${labels.cutsPerSecond}</th></tr></thead><tbody>${renderCurveRows(report, locale)}</tbody></table>
  <h2>${labels.changePoints}</h2>
  <table data-section="rhythm-change-points"><thead><tr><th>${labels.time}</th><th>${labels.previous}</th><th>${labels.next}</th><th>${labels.ratio}</th></tr></thead><tbody>${renderChangeRows(report, locale)}</tbody></table>
  <h2>${labels.suggestions}</h2>
  ${report.suggestions.length > 0 ? `<ul>${report.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<div class="empty">${labels.noSuggestions}</div>`}
</body>
</html>`;
}

function isRhythmShotClip(clip: Clip): clip is Extract<Clip, { type: 'video' | 'image' | 'nested-sequence' }> {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

function durationsSimilar(left: number, right: number, tolerance: number): boolean {
  const base = Math.max(0.001, Math.min(left, right));
  return Math.abs(left - right) / base <= tolerance;
}

function renderCurveRows(report: RhythmAnalysisReport, locale: ReportLocale): string {
  if (report.cutFrequencyCurve.length === 0) {
    return `<tr><td colspan="2" class="empty">${rhythmLabels[locale].empty}</td></tr>`;
  }
  return report.cutFrequencyCurve
    .map((point) => `<tr><td>${formatReportDuration(point.time, locale)}</td><td>${point.cutsPerSecond}</td></tr>`)
    .join('');
}

function renderChangeRows(report: RhythmAnalysisReport, locale: ReportLocale): string {
  if (report.changePoints.length === 0) {
    return `<tr><td colspan="4" class="empty">${rhythmLabels[locale].noChanges}</td></tr>`;
  }
  return report.changePoints
    .map((point) => `<tr><td>${formatReportDuration(point.time, locale)}</td><td>${escapeHtml(point.previousClipId)} (${formatReportDuration(point.previousDuration, locale)})</td><td>${escapeHtml(point.nextClipId)} (${formatReportDuration(point.nextDuration, locale)})</td><td>${point.ratio}x</td></tr>`)
    .join('');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const rhythmLabels: Record<ReportLocale, Record<string, string>> = {
  zh: {
    title: '剪辑节奏分析',
    generatedAt: '生成时间',
    language: '语言',
    projectDuration: '项目时长',
    shotCount: '镜头数',
    averageShot: '平均镜头时长',
    shortestShot: '最短镜头',
    longestShot: '最长镜头',
    cutCurve: '切换频率曲线',
    changePoints: '节奏变化点',
    suggestions: '建议',
    time: '时间',
    cutsPerSecond: '每秒 cut 次数',
    previous: '前一镜头',
    next: '后一镜头',
    ratio: '差异',
    empty: '暂无数据。',
    noChanges: '未检测到明显变化点。',
    noSuggestions: '暂无节奏建议。'
  },
  en: {
    title: 'Edit Rhythm Analysis',
    generatedAt: 'Generated At',
    language: 'Language',
    projectDuration: 'Project Duration',
    shotCount: 'Shot Count',
    averageShot: 'Average Shot Duration',
    shortestShot: 'Shortest Shot',
    longestShot: 'Longest Shot',
    cutCurve: 'Cut Frequency Curve',
    changePoints: 'Rhythm Change Points',
    suggestions: 'Suggestions',
    time: 'Time',
    cutsPerSecond: 'Cuts Per Second',
    previous: 'Previous Shot',
    next: 'Next Shot',
    ratio: 'Ratio',
    empty: 'No data.',
    noChanges: 'No obvious rhythm changes detected.',
    noSuggestions: 'No rhythm suggestions.'
  }
};

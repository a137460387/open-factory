import type { Project } from '../model-types';
import type { MediaColorProfile } from './color-management';
import { getTimelinePlaybackDuration } from '../timeline';
import type { ExportColorSpace } from './color-management';

export type ExportRecommendationReasonCode = 'resolution' | 'duration' | 'subtitles' | 'hdr';

export interface ExportPresetRecommendation {
  presetId: string;
  score: number;
  reasons: ExportRecommendationReason[];
}

export interface ExportRecommendationReason {
  code: ExportRecommendationReasonCode;
  label: string;
}

export interface ExportRecommendationContext {
  width: number;
  height: number;
  duration: number;
  hasSubtitles: boolean;
  hasHdrMedia: boolean;
}

const PORTRAIT_RATIO_THRESHOLD = 1.1;
const SHORT_DURATION_THRESHOLD = 60;
const HDR_COLOR_SPACES: ReadonlySet<ExportColorSpace> = new Set<ExportColorSpace>(['rec2020', 'display-p3', 'dci-p3']);

const SHORT_FORM_PRESETS: ReadonlyArray<{ id: string; orientation: 'portrait' | 'square' | 'landscape'; shortFormBonus: number }> = [
  { id: 'tiktok', orientation: 'portrait', shortFormBonus: 0.9 },
  { id: 'instagram-reels', orientation: 'portrait', shortFormBonus: 0.85 },
  { id: 'youtube-shorts', orientation: 'portrait', shortFormBonus: 0.8 },
  { id: 'twitter-x', orientation: 'landscape', shortFormBonus: 0.5 },
  { id: 'bilibili', orientation: 'landscape', shortFormBonus: 0.4 },
  { id: 'youtube-1080p', orientation: 'landscape', shortFormBonus: 0.3 }
];

export function buildExportRecommendationContext(project: Project): ExportRecommendationContext {
  const width = Number.isFinite(project.settings.width) ? Math.max(1, project.settings.width) : 1920;
  const height = Number.isFinite(project.settings.height) ? Math.max(1, project.settings.height) : 1080;
  const duration = getTimelinePlaybackDuration(project.timeline);
  const hasSubtitles = project.timeline.tracks.some((track) => track.type === 'subtitle' && track.clips.length > 0);
  const hasHdrMedia = checkProjectHasHdrMedia(project);
  return { width, height, duration, hasSubtitles, hasHdrMedia };
}

export function buildExportPresetRecommendations(
  context: ExportRecommendationContext,
  labelFn: (code: ExportRecommendationReasonCode, context: ExportRecommendationContext) => string = defaultLabelFn
): ExportPresetRecommendation[] {
  const results: ExportPresetRecommendation[] = [];

  for (const preset of SHORT_FORM_PRESETS) {
    const reasons: ExportRecommendationReason[] = [];
    let score = 0;

    if (preset.orientation === 'portrait' && context.height > context.width * PORTRAIT_RATIO_THRESHOLD) {
      score += 0.4;
      reasons.push({ code: 'resolution', label: labelFn('resolution', context) });
    } else if (preset.orientation === 'landscape' && context.width > context.height * PORTRAIT_RATIO_THRESHOLD) {
      score += 0.2;
      reasons.push({ code: 'resolution', label: labelFn('resolution', context) });
    }

    if (context.duration > 0 && context.duration < SHORT_DURATION_THRESHOLD) {
      score += preset.shortFormBonus;
      reasons.push({ code: 'duration', label: labelFn('duration', context) });
    }

    if (context.hasSubtitles) {
      score += 0.15;
      reasons.push({ code: 'subtitles', label: labelFn('subtitles', context) });
    }

    if (context.hasHdrMedia) {
      score += 0.1;
      reasons.push({ code: 'hdr', label: labelFn('hdr', context) });
    }

    if (score > 0) {
      results.push({ presetId: preset.id, score: roundScore(score), reasons });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.presetId.localeCompare(b.presetId)).slice(0, 3);
}

export function checkProjectHasHdrMedia(project: Project): boolean {
  for (const asset of project.media) {
    if (isHdrColorSpace(asset.colorProfile?.sourceColorSpace)) {
      return true;
    }
  }
  return false;
}

function isHdrColorSpace(colorSpace: ExportColorSpace | undefined): boolean {
  if (!colorSpace) {
    return false;
  }
  return HDR_COLOR_SPACES.has(colorSpace);
}

function defaultLabelFn(code: ExportRecommendationReasonCode, context: ExportRecommendationContext): string {
  switch (code) {
    case 'resolution':
      return context.height > context.width ? 'portrait' : context.width > context.height ? 'landscape' : 'square';
    case 'duration':
      return context.duration < SHORT_DURATION_THRESHOLD ? 'short' : 'long';
    case 'subtitles':
      return 'subtitles';
    case 'hdr':
      return 'hdr';
  }
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function hasSubtitleTracks(project: Project): boolean {
  return project.timeline.tracks.some((track) => track.type === 'subtitle' && track.clips.length > 0);
}

export function isHdrMediaProfile(profile: MediaColorProfile | undefined): boolean {
  return profile !== undefined && isHdrColorSpace(profile.sourceColorSpace);
}

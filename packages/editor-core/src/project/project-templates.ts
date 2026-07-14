import {
  createProject,
  createTrack,
  PRIMARY_SEQUENCE_ID,
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  type Project,
  type ProjectSettings,
  type Track,
  type TrackType,
} from '../model';
import type { ExportSettings } from '../export/export-types';

export interface MediaFeatureInput {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}

export type MediaAspectClass = 'vertical' | 'horizontal' | 'square' | 'unknown';

export interface MediaFeatureSummary {
  count: number;
  hasAudio: boolean;
  avgWidth: number;
  avgHeight: number;
  avgDuration: number;
  totalDuration: number;
  aspectClass: MediaAspectClass;
}

export interface TemplateRecommendation {
  templateId: ProjectTemplateId;
  score: number;
  suggestedVideoTracks: number;
  suggestedAudioTracks: number;
  reasonKey: string;
  reasonParams: Record<string, string | number>;
}

export type ProjectTemplateId = 'vertical-short' | 'youtube-horizontal' | 'square-social' | 'podcast' | 'cinema';
export type ProjectTemplateExportSettings = Partial<Omit<ExportSettings, 'outputPath'>>;

export interface ProjectTemplateTrackDefinition {
  id: string;
  type: TrackType;
  name: string;
}

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId;
  defaultName: string;
  settings: ProjectSettings;
  tracks: ProjectTemplateTrackDefinition[];
  exportSettings: ProjectTemplateExportSettings;
}

export interface InstantiatedProjectTemplate {
  template: ProjectTemplateDefinition;
  project: Project;
  exportSettings: ProjectTemplateExportSettings;
}

export const PROJECT_TEMPLATES: readonly ProjectTemplateDefinition[] = [
  {
    id: 'vertical-short',
    defaultName: 'Vertical Short',
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1080, height: 1920 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' },
    ],
    exportSettings: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '10M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: '9:16',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
    },
  },
  {
    id: 'youtube-horizontal',
    defaultName: 'YouTube Horizontal',
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' },
    ],
    exportSettings: {
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: 'source',
      hardwareEncoding: false,
    },
  },
  {
    id: 'square-social',
    defaultName: 'Square Social',
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1080, height: 1080 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' },
    ],
    exportSettings: {
      width: 1080,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: '1:1',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
    },
  },
  {
    id: 'podcast',
    defaultName: 'Podcast',
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
    tracks: [
      { id: 'track-host-audio', type: 'audio', name: 'Host Audio' },
      { id: 'track-music-bed', type: 'audio', name: 'Music Bed' },
    ],
    exportSettings: {
      audioCodec: 'aac',
      audioBitrate: '192k',
      format: 'm4a',
      outputMode: 'audio',
      loudnessNormalization: 'youtube',
    },
  },
  {
    id: 'cinema',
    defaultName: 'Cinema',
    settings: { fps: 24, timecodeFormat: 'ndf', width: 3840, height: 2160 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-video-overlay', type: 'video', name: 'Overlay Video' },
      { id: 'track-dialogue', type: 'audio', name: 'Dialogue' },
      { id: 'track-music', type: 'audio', name: 'Music' },
      { id: 'track-text-main', type: 'text', name: 'Titles' },
    ],
    exportSettings: {
      width: 3840,
      height: 2160,
      fps: 24,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '45M',
      audioBitrate: '320k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: '16:9',
      hardwareEncoding: false,
    },
  },
];

const ASPECT_VERTICAL_THRESHOLD = 1.2;
const ASPECT_SQUARE_MIN = 0.9;
const ASPECT_SQUARE_MAX = 1.1;
const PODCAST_LONG_DURATION_SECONDS = 300;
const CINEMA_WIDE_THRESHOLD = 3000;
const AUDIO_ONLY_MIN_RATIO = 0.8;
const SCORE_BASE = 100;

export function classifyMediaAspect(width: number, height: number): MediaAspectClass {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const ratio = safeHeight / safeWidth;
  if (ratio >= ASPECT_VERTICAL_THRESHOLD) {
    return 'vertical';
  }
  if (ratio >= ASPECT_SQUARE_MIN && ratio <= ASPECT_SQUARE_MAX) {
    return 'square';
  }
  if (ratio < ASPECT_SQUARE_MIN) {
    return 'horizontal';
  }
  return 'horizontal';
}

export function detectMediaFeatures(media: MediaFeatureInput[]): MediaFeatureSummary {
  const safeMedia = media.filter(
    (item) => Number.isFinite(item.width) && Number.isFinite(item.height) && item.width > 0 && item.height > 0,
  );
  const count = safeMedia.length;
  if (count === 0) {
    return {
      count: 0,
      hasAudio: false,
      avgWidth: 0,
      avgHeight: 0,
      avgDuration: 0,
      totalDuration: 0,
      aspectClass: 'unknown',
    };
  }
  const totalWidth = safeMedia.reduce((sum, item) => sum + item.width, 0);
  const totalHeight = safeMedia.reduce((sum, item) => sum + item.height, 0);
  const totalDuration = safeMedia.reduce((sum, item) => sum + Math.max(0, item.durationSeconds), 0);
  const hasAudio = safeMedia.some((item) => item.hasAudio);
  const audioOnlyCount = safeMedia.filter((item) => !item.hasAudio && item.durationSeconds <= 0).length;
  const avgWidth = Math.round(totalWidth / count);
  const avgHeight = Math.round(totalHeight / count);
  const avgDuration = totalDuration / count;
  const dominantAspect = classifyMediaAspect(avgWidth, avgHeight);
  const aspectVotes = new Map<MediaAspectClass, number>();
  for (const item of safeMedia) {
    const cls = classifyMediaAspect(item.width, item.height);
    aspectVotes.set(cls, (aspectVotes.get(cls) ?? 0) + 1);
  }
  let bestAspect: MediaAspectClass = dominantAspect;
  let bestCount = 0;
  for (const [cls, votes] of aspectVotes) {
    if (votes > bestCount) {
      bestCount = votes;
      bestAspect = cls;
    }
  }
  if (audioOnlyCount >= count * AUDIO_ONLY_MIN_RATIO) {
    bestAspect = 'unknown';
  }
  return { count, hasAudio, avgWidth, avgHeight, avgDuration, totalDuration, aspectClass: bestAspect };
}

export function suggestTrackCount(
  mediaCount: number,
  template: ProjectTemplateDefinition,
): { videoTracks: number; audioTracks: number } {
  const safeCount = Math.max(1, Math.round(mediaCount));
  const videoTracks = Math.max(
    template.tracks.filter((track) => track.type === 'video').length,
    Math.min(safeCount, 8),
  );
  const audioTracks = Math.max(template.tracks.filter((track) => track.type === 'audio').length, 1);
  return { videoTracks, audioTracks };
}

export function recommendTemplate(media: MediaFeatureInput[]): TemplateRecommendation {
  const summary = detectMediaFeatures(media);
  if (summary.count === 0) {
    return {
      templateId: 'youtube-horizontal',
      score: 0,
      suggestedVideoTracks: 1,
      suggestedAudioTracks: 1,
      reasonKey: 'noMedia',
      reasonParams: {},
    };
  }

  const scores: Array<{ templateId: ProjectTemplateId; score: number }> = [];

  for (const template of PROJECT_TEMPLATES) {
    let score = SCORE_BASE;
    const templateAspect =
      template.settings.width > template.settings.height
        ? 'horizontal'
        : template.settings.width < template.settings.height
          ? 'vertical'
          : 'square';

    if (summary.aspectClass === 'vertical' && templateAspect === 'vertical') {
      score += 50;
    } else if (summary.aspectClass === 'vertical' && templateAspect !== 'vertical') {
      score -= 30;
    }
    if (summary.aspectClass === 'horizontal' && templateAspect === 'horizontal') {
      score += 40;
    } else if (summary.aspectClass === 'horizontal' && templateAspect !== 'horizontal') {
      score -= 20;
    }
    if (summary.aspectClass === 'square' && templateAspect === 'square') {
      score += 45;
    }

    if (template.id === 'podcast') {
      if (summary.totalDuration > PODCAST_LONG_DURATION_SECONDS) {
        score += 20;
      }
      if (summary.aspectClass === 'unknown') {
        score += 30;
      }
    }

    if (template.id === 'cinema') {
      if (summary.avgWidth >= CINEMA_WIDE_THRESHOLD) {
        score += 30;
      }
      if (summary.avgDuration > 120) {
        score += 10;
      }
    }

    scores.push({ templateId: template.id, score });
  }

  const best = scores.reduce((max, item) => (item.score > max.score ? item : max), scores[0]);
  const matchedTemplate = getProjectTemplate(best.templateId);
  const suggested = suggestTrackCount(summary.count, matchedTemplate);

  const reasonKey = buildReasonKey(summary);
  const reasonParams = buildReasonParams(summary);

  return {
    templateId: best.templateId,
    score: best.score,
    suggestedVideoTracks: suggested.videoTracks,
    suggestedAudioTracks: suggested.audioTracks,
    reasonKey,
    reasonParams,
  };
}

function buildReasonKey(summary: MediaFeatureSummary): string {
  if (summary.aspectClass === 'vertical') return 'verticalDetected';
  if (summary.aspectClass === 'square') return 'squareDetected';
  if (summary.aspectClass === 'unknown') return 'audioOnly';
  if (summary.avgWidth >= CINEMA_WIDE_THRESHOLD) return 'cinemaDetected';
  return 'horizontalDetected';
}

function buildReasonParams(summary: MediaFeatureSummary): Record<string, string | number> {
  return {
    count: summary.count,
    width: summary.avgWidth,
    height: summary.avgHeight,
    duration: Math.round(summary.avgDuration),
  };
}

export function buildRecommendationReason(
  recommendation: TemplateRecommendation,
  translations: Record<string, string | ((params: Record<string, string | number>) => string)>,
): string {
  const entry = translations[recommendation.reasonKey];
  if (typeof entry === 'function') {
    return entry(recommendation.reasonParams);
  }
  if (typeof entry === 'string') {
    return entry;
  }
  return '';
}

export function getProjectTemplate(id: ProjectTemplateId): ProjectTemplateDefinition {
  const template = PROJECT_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown project template: ${id}`);
  }
  return template;
}

export function instantiateProjectTemplate(
  id: ProjectTemplateId,
  options: { name?: string } = {},
): InstantiatedProjectTemplate {
  const template = getProjectTemplate(id);
  const project = createProject(options.name ?? template.defaultName);
  const timeline = {
    markers: [],
    transitions: [],
    tracks: template.tracks.map(createTemplateTrack),
  };
  const nextProject: Project = {
    ...project,
    name: options.name ?? template.defaultName,
    settings: { ...template.settings },
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID,
  };
  return {
    template,
    project: nextProject,
    exportSettings: { ...template.exportSettings },
  };
}

function createTemplateTrack(track: ProjectTemplateTrackDefinition): Track {
  return createTrack({ ...track, clips: [] });
}

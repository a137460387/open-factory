import {
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  DEFAULT_TRANSFORM,
  PRIMARY_SEQUENCE_ID,
  createProject,
  createTrack,
  type AssetType,
  type Clip,
  type MediaAsset,
  type Project,
  type ProjectSettings,
  type Timeline,
  type Track,
  type TrackType,
} from './model';

export const TIMELINE_TEMPLATE_SCHEMA_VERSION = 1;

export type TimelineTemplateId = string;

export interface TimelineTemplatePlaceholder {
  id: string;
  name: string;
  assetType: AssetType;
  originalPath?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface TimelineTemplateClip {
  id: string;
  sourceClipId: string;
  mediaPlaceholderId?: string;
  clip: Clip;
}

export interface TimelineTemplateTrack {
  id: string;
  sourceTrackId: string;
  type: TrackType;
  name: string;
  language?: string;
  subtitleType?: 'subtitle' | 'cc';
  color?: Track['color'];
  muted?: boolean;
  solo?: boolean;
  locked?: boolean;
  volume?: number;
  pan?: number;
  clips: TimelineTemplateClip[];
}

export interface TimelineTemplateDefinition {
  schemaVersion: typeof TIMELINE_TEMPLATE_SCHEMA_VERSION;
  id: TimelineTemplateId;
  name: string;
  description?: string;
  settings?: ProjectSettings;
  duration: number;
  placeholders: TimelineTemplatePlaceholder[];
  tracks: TimelineTemplateTrack[];
  createdAt?: string;
}

export interface SerializeTimelineTemplateOptions {
  id?: string;
  name: string;
  description?: string;
  clipIds?: string[];
  createdAt?: string;
}

export interface TimelineTemplatePlaceholderBinding {
  path: string;
  name?: string;
  assetType?: AssetType;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
}

export type TimelineTemplatePlaceholderBindings = Record<string, string | TimelineTemplatePlaceholderBinding>;

export interface InstantiatedTimelineTemplate {
  timeline: Timeline;
  media: MediaAsset[];
  placeholderAssetIds: Record<string, string>;
}

type MediaClip = Extract<Clip, { mediaId: string }>;

export const BUILT_IN_TIMELINE_TEMPLATES: readonly TimelineTemplateDefinition[] = [
  createBuiltInTemplate({
    id: 'interview-two-camera',
    name: '访谈双机位',
    description: '双视频机位、独立对白和字幕轨。',
    duration: 8,
    placeholders: [
      { id: 'placeholder-host-camera', name: '主持机位', assetType: 'video', duration: 8, width: 1920, height: 1080 },
      { id: 'placeholder-guest-camera', name: '嘉宾机位', assetType: 'video', duration: 8, width: 1920, height: 1080 },
      { id: 'placeholder-dialogue-audio', name: '对白音频', assetType: 'audio', duration: 8 },
    ],
    tracks: [
      builtInTrack('track-cam-a', 'video', '机位 A', [
        builtInMediaClip('clip-cam-a', 'track-cam-a', 'placeholder-host-camera', 'video', '主持机位', 0, 8),
      ]),
      builtInTrack('track-cam-b', 'video', '机位 B', [
        builtInMediaClip('clip-cam-b', 'track-cam-b', 'placeholder-guest-camera', 'video', '嘉宾机位', 0, 8),
      ]),
      builtInTrack('track-dialogue', 'audio', '对白', [
        builtInMediaClip('clip-dialogue', 'track-dialogue', 'placeholder-dialogue-audio', 'audio', '对白音频', 0, 8),
      ]),
      builtInTrack('track-subtitles', 'subtitle', '字幕', [
        builtInSubtitleClip('clip-subtitle-cue', 'track-subtitles', 0.5, 2),
      ]),
    ],
  }),
  createBuiltInTemplate({
    id: 'vlog-opener',
    name: 'Vlog 开场',
    description: '快节奏开场、标题和背景音乐。',
    duration: 6,
    placeholders: [
      { id: 'placeholder-opening-video', name: '开场视频', assetType: 'video', duration: 6, width: 1920, height: 1080 },
      { id: 'placeholder-music', name: '背景音乐', assetType: 'audio', duration: 6 },
    ],
    tracks: [
      builtInTrack('track-video', 'video', '主画面', [
        builtInMediaClip('clip-opening', 'track-video', 'placeholder-opening-video', 'video', '开场视频', 0, 6),
      ]),
      builtInTrack('track-title', 'text', '标题', [builtInTextClip('clip-title', 'track-title', 'Vlog', 0.2, 2.5)]),
      builtInTrack('track-music', 'audio', '音乐', [
        builtInMediaClip('clip-music', 'track-music', 'placeholder-music', 'audio', '背景音乐', 0, 6),
      ]),
    ],
  }),
  createBuiltInTemplate({
    id: 'product-showcase',
    name: '产品展示',
    description: '产品主镜头、细节镜头和标题说明。',
    duration: 10,
    placeholders: [
      {
        id: 'placeholder-product-main',
        name: '产品主镜头',
        assetType: 'video',
        duration: 5,
        width: 1920,
        height: 1080,
      },
      {
        id: 'placeholder-product-detail',
        name: '产品细节',
        assetType: 'video',
        duration: 5,
        width: 1920,
        height: 1080,
      },
    ],
    tracks: [
      builtInTrack('track-main', 'video', '主镜头', [
        builtInMediaClip('clip-product-main', 'track-main', 'placeholder-product-main', 'video', '产品主镜头', 0, 5),
      ]),
      builtInTrack('track-detail', 'video', '细节', [
        builtInMediaClip(
          'clip-product-detail',
          'track-detail',
          'placeholder-product-detail',
          'video',
          '产品细节',
          5,
          5,
        ),
      ]),
      builtInTrack('track-title', 'text', '说明文字', [
        builtInTextClip('clip-product-title', 'track-title', '产品亮点', 0.5, 3),
      ]),
    ],
  }),
  createBuiltInTemplate({
    id: 'tutorial-screen-recording',
    name: '教程屏录',
    description: '屏幕录制、旁白和步骤字幕。',
    duration: 12,
    placeholders: [
      {
        id: 'placeholder-screen-recording',
        name: '屏幕录制',
        assetType: 'video',
        duration: 12,
        width: 1920,
        height: 1080,
      },
      { id: 'placeholder-voiceover', name: '旁白', assetType: 'audio', duration: 12 },
    ],
    tracks: [
      builtInTrack('track-screen', 'video', '屏幕', [
        builtInMediaClip('clip-screen', 'track-screen', 'placeholder-screen-recording', 'video', '屏幕录制', 0, 12),
      ]),
      builtInTrack('track-voiceover', 'audio', '旁白', [
        builtInMediaClip('clip-voiceover', 'track-voiceover', 'placeholder-voiceover', 'audio', '旁白', 0, 12),
      ]),
      builtInTrack('track-subtitles', 'subtitle', '步骤字幕', [
        builtInSubtitleClip('clip-step-subtitle', 'track-subtitles', 1, 3),
      ]),
    ],
  }),
] as const;

export function serializeTimelineTemplate(
  project: Project,
  options: SerializeTimelineTemplateOptions,
): TimelineTemplateDefinition {
  const selectedClipIds = options.clipIds?.length ? new Set(options.clipIds) : undefined;
  const sourceTracks = selectedClipIds
    ? project.timeline.tracks
        .map((track) => ({ track, clips: track.clips.filter((clip) => selectedClipIds.has(clip.id)) }))
        .filter((entry) => entry.clips.length > 0)
    : project.timeline.tracks.map((track) => ({ track, clips: [...track.clips] }));
  const allClips = sourceTracks.flatMap((entry) => entry.clips);
  const baseStart = allClips.length > 0 ? Math.min(...allClips.map((clip) => clip.start)) : 0;
  const placeholders: TimelineTemplatePlaceholder[] = [];
  const placeholderByMediaId = new Map<string, TimelineTemplatePlaceholder>();
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  const tracks = sourceTracks.map(({ track, clips }, trackIndex): TimelineTemplateTrack => {
    const templateTrackId = `template-track-${trackIndex + 1}`;
    return {
      id: templateTrackId,
      sourceTrackId: track.id,
      type: track.type,
      name: track.name,
      language: track.language,
      subtitleType: track.subtitleType,
      color: track.color,
      muted: track.muted,
      solo: track.solo,
      locked: track.locked,
      volume: track.volume,
      pan: track.pan,
      clips: clips.map((clip, clipIndex) => {
        const cloned = clone(clip);
        cloned.id = `${templateTrackId}-clip-${clipIndex + 1}`;
        cloned.trackId = templateTrackId;
        cloned.start = roundTime(clip.start - baseStart);
        let mediaPlaceholderId: string | undefined;
        if (hasMediaId(cloned) && hasMediaId(clip)) {
          const asset = mediaById.get(clip.mediaId);
          if (asset) {
            const placeholder = getOrCreatePlaceholder(asset, placeholderByMediaId, placeholders);
            mediaPlaceholderId = placeholder.id;
            cloned.mediaId = placeholder.id;
          }
        }
        return {
          id: cloned.id,
          sourceClipId: clip.id,
          mediaPlaceholderId,
          clip: cloned,
        };
      }),
    };
  });
  return {
    schemaVersion: TIMELINE_TEMPLATE_SCHEMA_VERSION,
    id: options.id?.trim() || createTemplateId(options.name),
    name: options.name.trim() || 'Timeline Template',
    description: options.description?.trim() || undefined,
    settings: clone(project.settings),
    duration: roundTime(Math.max(0, ...allClips.map((clip) => clip.start + clip.duration - baseStart))),
    placeholders,
    tracks,
    createdAt: options.createdAt ?? new Date(Date.now()).toISOString(),
  };
}

export function instantiateTimelineTemplate(
  template: TimelineTemplateDefinition,
  bindings: TimelineTemplatePlaceholderBindings = {},
): InstantiatedTimelineTemplate {
  const placeholderAssetIds: Record<string, string> = {};
  const media = template.placeholders.map((placeholder, index) => {
    const binding = normalizePlaceholderBinding(bindings[placeholder.id]);
    const path = binding?.path ?? placeholder.originalPath ?? '';
    const assetId = `media-${sanitizeId(placeholder.id)}-${index + 1}`;
    placeholderAssetIds[placeholder.id] = assetId;
    return {
      id: assetId,
      type: binding?.assetType ?? placeholder.assetType,
      name: binding?.name ?? fileNameFromPath(path) ?? placeholder.name,
      path,
      duration: finiteOrDefault(binding?.duration, placeholder.duration ?? 0),
      width: finiteOrDefault(binding?.width, placeholder.width ?? 0),
      height: finiteOrDefault(binding?.height, placeholder.height ?? 0),
      missing: !path,
      size: binding?.size,
    } satisfies MediaAsset;
  });
  const tracks: Track[] = template.tracks.map((templateTrack, trackIndex) => {
    const trackId = `track-${sanitizeId(templateTrack.id)}-${trackIndex + 1}`;
    const clips = templateTrack.clips.map((templateClip, clipIndex) => {
      const clip = clone(templateClip.clip);
      clip.id = `clip-${sanitizeId(templateClip.id)}-${clipIndex + 1}`;
      clip.trackId = trackId;
      if (hasMediaId(clip) && templateClip.mediaPlaceholderId) {
        clip.mediaId = placeholderAssetIds[templateClip.mediaPlaceholderId] ?? clip.mediaId;
      }
      return clip;
    });
    return createTrack({
      id: trackId,
      type: templateTrack.type,
      name: templateTrack.name,
      language: templateTrack.language,
      subtitleType: templateTrack.subtitleType,
      color: templateTrack.color,
      muted: templateTrack.muted,
      solo: templateTrack.solo,
      locked: templateTrack.locked,
      volume: templateTrack.volume,
      pan: templateTrack.pan,
      clips,
    });
  });
  return {
    timeline: { tracks, markers: [], transitions: [] },
    media,
    placeholderAssetIds,
  };
}

export function instantiateTimelineTemplateProject(
  template: TimelineTemplateDefinition,
  bindings: TimelineTemplatePlaceholderBindings = {},
  options: { name?: string } = {},
): Project {
  const instance = instantiateTimelineTemplate(template, bindings);
  const project = createProject(options.name ?? template.name);
  return {
    ...project,
    name: options.name ?? template.name,
    settings: template.settings ? clone(template.settings) : project.settings,
    media: instance.media,
    timeline: instance.timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline: instance.timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID,
  };
}

export function getMissingTimelineTemplatePlaceholders(
  template: TimelineTemplateDefinition,
  bindings: TimelineTemplatePlaceholderBindings = {},
): TimelineTemplatePlaceholder[] {
  return template.placeholders.filter((placeholder) => !normalizePlaceholderBinding(bindings[placeholder.id])?.path);
}

export function fillTimelineTemplatePlaceholders(
  template: TimelineTemplateDefinition,
  bindings: TimelineTemplatePlaceholderBindings,
): Record<string, TimelineTemplatePlaceholderBinding> {
  const filled: Record<string, TimelineTemplatePlaceholderBinding> = {};
  for (const placeholder of template.placeholders) {
    const binding = normalizePlaceholderBinding(bindings[placeholder.id]);
    if (!binding?.path) {
      continue;
    }
    filled[placeholder.id] = {
      path: binding.path,
      name: binding.name ?? fileNameFromPath(binding.path) ?? placeholder.name,
      assetType: binding.assetType ?? placeholder.assetType,
      duration: finiteOrUndefined(binding.duration) ?? placeholder.duration,
      width: finiteOrUndefined(binding.width) ?? placeholder.width,
      height: finiteOrUndefined(binding.height) ?? placeholder.height,
      size: finiteOrUndefined(binding.size),
    };
  }
  return filled;
}

export function renderTimelineTemplatePreviewSvg(
  template: TimelineTemplateDefinition,
  options: { width?: number; trackHeight?: number } = {},
): string {
  const width = Math.max(320, Math.round(options.width ?? 640));
  const trackHeight = Math.max(28, Math.round(options.trackHeight ?? 34));
  const padding = 12;
  const labelWidth = 108;
  const gap = 8;
  const height =
    padding * 2 + Math.max(1, template.tracks.length) * trackHeight + Math.max(0, template.tracks.length - 1) * gap;
  const laneWidth = width - padding * 2 - labelWidth;
  const duration = Math.max(0.1, template.duration);
  const rows = template.tracks
    .map((track, index) => {
      const y = padding + index * (trackHeight + gap);
      const clipRects = track.clips
        .map((entry) => {
          const clip = entry.clip;
          const x = padding + labelWidth + (clip.start / duration) * laneWidth;
          const clipWidth = Math.max(6, (clip.duration / duration) * laneWidth);
          return `<rect x="${roundSvg(x)}" y="${y + 5}" width="${roundSvg(clipWidth)}" height="${trackHeight - 10}" rx="4" fill="${trackColor(track.type)}"><title>${escapeXml(clip.name)}</title></rect>`;
        })
        .join('');
      return `<text x="${padding}" y="${y + Math.round(trackHeight / 2) + 4}" font-size="11" fill="#334155">${escapeXml(track.name)}</text><rect x="${padding + labelWidth}" y="${y}" width="${laneWidth}" height="${trackHeight}" rx="4" fill="#f8fafc" stroke="#dbe3ef"/>${clipRects}`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${rows}</svg>`;
}

export function normalizeTimelineTemplateDefinition(value: unknown): TimelineTemplateDefinition | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Partial<TimelineTemplateDefinition>;
  if (
    candidate.schemaVersion !== TIMELINE_TEMPLATE_SCHEMA_VERSION ||
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string'
  ) {
    return undefined;
  }
  if (!Array.isArray(candidate.tracks) || !Array.isArray(candidate.placeholders)) {
    return undefined;
  }
  return {
    schemaVersion: TIMELINE_TEMPLATE_SCHEMA_VERSION,
    id: candidate.id,
    name: candidate.name.trim() || 'Timeline Template',
    description:
      typeof candidate.description === 'string' && candidate.description.trim()
        ? candidate.description.trim()
        : undefined,
    settings: candidate.settings,
    duration: Math.max(0, Number(candidate.duration) || 0),
    placeholders: candidate.placeholders.flatMap((placeholder) => normalizePlaceholder(placeholder)),
    tracks: candidate.tracks.flatMap((track) => normalizeTemplateTrack(track)),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
  };
}

function normalizeTemplateTrack(value: unknown): TimelineTemplateTrack[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const track = value as Partial<TimelineTemplateTrack>;
  if (!track.id || !track.sourceTrackId || !isTrackType(track.type) || !Array.isArray(track.clips)) {
    return [];
  }
  return [
    {
      id: track.id,
      sourceTrackId: track.sourceTrackId,
      type: track.type,
      name: typeof track.name === 'string' && track.name.trim() ? track.name : track.type,
      language: track.language,
      subtitleType: track.subtitleType,
      color: track.color,
      muted: track.muted,
      solo: track.solo,
      locked: track.locked,
      volume: track.volume,
      pan: track.pan,
      clips: track.clips.flatMap((entry) => normalizeTemplateClip(entry)),
    },
  ];
}

function normalizeTemplateClip(value: unknown): TimelineTemplateClip[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const entry = value as Partial<TimelineTemplateClip>;
  if (!entry.id || !entry.sourceClipId || !entry.clip || typeof entry.clip !== 'object') {
    return [];
  }
  return [
    {
      id: entry.id,
      sourceClipId: entry.sourceClipId,
      mediaPlaceholderId: typeof entry.mediaPlaceholderId === 'string' ? entry.mediaPlaceholderId : undefined,
      clip: clone(entry.clip) as Clip,
    },
  ];
}

function normalizePlaceholder(value: unknown): TimelineTemplatePlaceholder[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const placeholder = value as Partial<TimelineTemplatePlaceholder>;
  if (!placeholder.id || !placeholder.name || !isAssetType(placeholder.assetType)) {
    return [];
  }
  return [
    {
      id: placeholder.id,
      name: placeholder.name,
      assetType: placeholder.assetType,
      originalPath: placeholder.originalPath,
      duration: finiteOrUndefined(placeholder.duration),
      width: finiteOrUndefined(placeholder.width),
      height: finiteOrUndefined(placeholder.height),
    },
  ];
}

function getOrCreatePlaceholder(
  asset: MediaAsset,
  byMediaId: Map<string, TimelineTemplatePlaceholder>,
  placeholders: TimelineTemplatePlaceholder[],
): TimelineTemplatePlaceholder {
  const existing = byMediaId.get(asset.id);
  if (existing) {
    return existing;
  }
  const placeholder: TimelineTemplatePlaceholder = {
    id: `placeholder-${placeholders.length + 1}`,
    name: asset.name,
    assetType: asset.type,
    originalPath: asset.path,
    duration: finiteOrUndefined(asset.duration),
    width: finiteOrUndefined(asset.width),
    height: finiteOrUndefined(asset.height),
  };
  byMediaId.set(asset.id, placeholder);
  placeholders.push(placeholder);
  return placeholder;
}

function normalizePlaceholderBinding(
  value: string | TimelineTemplatePlaceholderBinding | undefined,
): TimelineTemplatePlaceholderBinding | undefined {
  if (typeof value === 'string') {
    return value.trim() ? { path: value.trim() } : undefined;
  }
  if (!value?.path?.trim()) {
    return undefined;
  }
  return {
    ...value,
    path: value.path.trim(),
    name: value.name?.trim() || undefined,
    assetType: isAssetType(value.assetType) ? value.assetType : undefined,
  };
}

function createBuiltInTemplate(
  input: Omit<TimelineTemplateDefinition, 'schemaVersion' | 'settings' | 'createdAt'>,
): TimelineTemplateDefinition {
  return {
    schemaVersion: TIMELINE_TEMPLATE_SCHEMA_VERSION,
    ...input,
    settings: { fps: 30, timecodeFormat: 'ndf', width: 1920, height: 1080 },
  };
}

function builtInTrack(id: string, type: TrackType, name: string, clips: TimelineTemplateClip[]): TimelineTemplateTrack {
  return { id, sourceTrackId: id, type, name, clips };
}

function builtInMediaClip(
  id: string,
  trackId: string,
  mediaPlaceholderId: string,
  type: 'video' | 'audio',
  name: string,
  start: number,
  duration: number,
): TimelineTemplateClip {
  const base = builtInBaseClip(id, trackId, name, start, duration);
  const clip = {
    ...base,
    type,
    mediaId: mediaPlaceholderId,
    volume: 1,
  } as Extract<Clip, { type: 'video' | 'audio' }>;
  return { id, sourceClipId: id, mediaPlaceholderId, clip };
}

function builtInTextClip(
  id: string,
  trackId: string,
  text: string,
  start: number,
  duration: number,
): TimelineTemplateClip {
  const clip = {
    ...builtInBaseClip(id, trackId, text, start, duration),
    type: 'text',
    text,
    style: {
      fontSize: 64,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      fontFamily: 'Inter, Arial, sans-serif',
      bold: true,
      italic: false,
    },
  } satisfies Extract<Clip, { type: 'text' }>;
  return { id, sourceClipId: id, clip };
}

function builtInSubtitleClip(id: string, trackId: string, start: number, duration: number): TimelineTemplateClip {
  const clip = {
    ...builtInBaseClip(id, trackId, '字幕占位', start, duration),
    type: 'subtitle',
    text: '',
    style: {
      fontSize: 42,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.55,
      fontFamily: 'Inter, Arial, sans-serif',
      bold: false,
      italic: false,
      yOffset: 72,
      outlineColor: '#000000',
      outlineWidth: 0,
      shadowColor: '#000000',
      shadowOffset: 0,
    },
    subtitleMode: 'burn-in',
  } satisfies Extract<Clip, { type: 'subtitle' }>;
  return { id, sourceClipId: id, clip };
}

function builtInBaseClip(id: string, trackId: string, name: string, start: number, duration: number) {
  return {
    id,
    name,
    trackId,
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    colorCorrection: clone(DEFAULT_COLOR_CORRECTION),
    transform: clone(DEFAULT_TRANSFORM),
  };
}

function createTemplateId(name: string): string {
  return `timeline-template-${sanitizeId(name || 'untitled')}-${Date.now().toString(36)}`;
}

function hasMediaId(clip: Clip): clip is MediaClip {
  return 'mediaId' in clip;
}

function isAssetType(value: unknown): value is AssetType {
  return value === 'video' || value === 'audio' || value === 'image';
}

function isTrackType(value: unknown): value is TrackType {
  return value === 'video' || value === 'audio' || value === 'text' || value === 'subtitle';
}

function fileNameFromPath(path: string): string | undefined {
  const name = path.split(/[\\/]/).filter(Boolean).at(-1);
  return name?.trim() || undefined;
}

function sanitizeId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'item'
  );
}

function trackColor(type: TrackType): string {
  if (type === 'video') {
    return '#2563eb';
  }
  if (type === 'audio') {
    return '#16a34a';
  }
  if (type === 'subtitle') {
    return '#f59e0b';
  }
  return '#7c3aed';
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function roundTime(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundSvg(value: number): number {
  return Math.round(value * 100) / 100;
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

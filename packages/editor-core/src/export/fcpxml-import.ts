import {
  DEFAULT_AUDIO_DENOISE,
  DEFAULT_AUDIO_FADE_CURVE,
  DEFAULT_AUDIO_FADE_DURATION,
  DEFAULT_AUDIO_PITCH_SEMITONES,
  DEFAULT_AUDIO_REVERSE,
  DEFAULT_CHROMA_KEY,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_FRAME_INTERPOLATION,
  DEFAULT_SLOW_MOTION_MODE,
  DEFAULT_STABILIZATION,
  DEFAULT_TRANSFORM,
  createSequence,
  createTrack,
  getProjectSequences,
  normalizeChromaKey,
  replaceProjectActiveTimeline,
  type AudioClip,
  type Clip,
  type ImageClip,
  type MediaAsset,
  type Project,
  type Sequence,
  type Timeline,
  type Track,
  type TrackType,
  type Transition,
  type VideoClip,
} from '../model';
import { normalizePath } from '../project/relative-paths';
import { round } from '../time';
import {
  matchEdlEventsToMedia,
  type Cmx3600EdlEvent,
  type EdlMediaMatch,
  type EdlMediaMatchKind,
} from './timeline-import';

// ─── Public types ────────────────────────────────────────────

export interface FcpXmlClipItem {
  id: string;
  name: string;
  start: number;
  end: number;
  inPoint: number;
  outPoint: number;
  filePath?: string;
  fileName?: string;
  trackType: TrackType;
}

export interface FcpXmlTransitionItem {
  id: string;
  name: string;
  start: number;
  end: number;
  effectId?: string;
  duration: number;
}

export interface FcpXmlParseResult {
  sequenceName?: string;
  fps: number;
  duration: number;
  clipItems: FcpXmlClipItem[];
  transitions: FcpXmlTransitionItem[];
}

export interface FcpXmlImportOptions {
  fps?: number;
  sequenceName?: string;
}

export interface FcpXmlImportResult {
  title: string;
  sequence: Sequence;
  media: MediaAsset[];
  matches: EdlMediaMatch[];
  matchedCount: number;
  missingCount: number;
}

// ─── Parser ──────────────────────────────────────────────────

export function parseFcpXml(contents: string): FcpXmlParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(contents, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`FCPXML 解析错误: ${parseError.textContent ?? '无效的 XML'}`);
  }

  const xmeml = doc.querySelector('xmeml');
  if (!xmeml) {
    throw new Error('不是有效的 FCPXML 文件：缺少 <xmeml> 根元素');
  }

  const sequence = doc.querySelector('sequence');
  if (!sequence) {
    throw new Error('不是有效的 FCPXML 文件：缺少 <sequence> 元素');
  }

  const sequenceName = getTextContent(sequence, 'name') ?? undefined;
  const fps = parseRate(sequence);
  const duration = parseNumber(getTextContent(sequence, 'duration'), 0);

  const clipItems: FcpXmlClipItem[] = [];
  const transitions: FcpXmlTransitionItem[] = [];

  // Parse video tracks
  const videoTracks = doc.querySelectorAll('video > track');
  for (const track of videoTracks) {
    parseTrackItems(track, 'video', fps, clipItems, transitions);
  }

  // Parse audio tracks
  const audioTracks = doc.querySelectorAll('audio > track');
  for (const track of audioTracks) {
    parseTrackItems(track, 'audio', fps, clipItems, transitions);
  }

  return { sequenceName, fps, duration, clipItems, transitions };
}

function parseTrackItems(
  track: Element,
  trackType: TrackType,
  fps: number,
  clipItems: FcpXmlClipItem[],
  transitions: FcpXmlTransitionItem[],
): void {
  let clipIndex = 0;
  for (const child of Array.from(track.children)) {
    if (child.tagName === 'clipitem' || child.tagName === 'clip') {
      const item = parseClipItem(child, trackType, fps, clipIndex);
      if (item) {
        clipItems.push(item);
        clipIndex += 1;
      }
    } else if (child.tagName === 'transitionitem') {
      const transition = parseTransitionItem(child, fps);
      if (transition) {
        transitions.push(transition);
      }
    }
  }
}

function parseClipItem(element: Element, trackType: TrackType, fps: number, index: number): FcpXmlClipItem | undefined {
  const name = getTextContent(element, 'name') ?? '';
  const start = parseNumber(getTextContent(element, 'start'), 0);
  const end = parseNumber(getTextContent(element, 'end'), 0);
  const inPoint = parseNumber(getTextContent(element, 'in'), 0);
  const outPoint = parseNumber(getTextContent(element, 'out'), 0);

  // File info from nested <file> element
  const fileEl = element.querySelector(':scope > file');
  const filePath = fileEl ? (getTextContent(fileEl, 'pathurl') ?? undefined) : undefined;
  const fileName = fileEl ? (getTextContent(fileEl, 'name') ?? undefined) : undefined;

  const id = element.getAttribute('id') ?? `clip-${index + 1}`;

  return {
    id,
    name: name || fileName || 'Untitled',
    start: framesToSeconds(start, fps),
    end: framesToSeconds(end, fps),
    inPoint: framesToSeconds(inPoint, fps),
    outPoint: framesToSeconds(outPoint, fps),
    filePath: filePath ? decodeFileUrl(filePath) : undefined,
    fileName,
    trackType,
  };
}

function parseTransitionItem(element: Element, fps: number): FcpXmlTransitionItem | undefined {
  const name = getTextContent(element, 'name') ?? '';
  const start = parseNumber(getTextContent(element, 'start'), 0);
  const end = parseNumber(getTextContent(element, 'end'), 0);
  const effectEl = element.querySelector(':scope > effect');
  const effectId = effectEl ? (getTextContent(effectEl, 'effectid') ?? undefined) : undefined;
  const id = element.getAttribute('id') ?? '';

  return {
    id,
    name,
    start: framesToSeconds(start, fps),
    end: framesToSeconds(end, fps),
    effectId,
    duration: framesToSeconds(end - start, fps),
  };
}

// ─── Import builder ──────────────────────────────────────────

export function buildFcpXmlImport(
  project: Project,
  contents: string,
  options: FcpXmlImportOptions = {},
): FcpXmlImportResult {
  const parsed = parseFcpXml(contents);
  const fps = normalizeFps(options.fps ?? parsed.fps ?? project.settings.fps);
  const title = normalizeImportTitle(options.sequenceName ?? parsed.sequenceName);

  // Convert parsed clip items to EDL-like events for media matching
  const events: Cmx3600EdlEvent[] = parsed.clipItems.map((item, index) => ({
    id: item.id || `fcp-${index + 1}`,
    editNumber: String(index + 1).padStart(3, '0'),
    reel: item.fileName ?? 'AX',
    trackType: item.trackType === 'audio' ? 'audio' : 'video',
    transition: 'cut' as const,
    rawTransition: 'C',
    sourceStart: item.inPoint,
    sourceEnd: item.outPoint,
    recordStart: item.start,
    recordEnd: item.end,
    clipName: item.name,
    sourceFile: item.filePath,
    comments: [],
  }));

  const validEvents = events
    .filter((event) => event.recordEnd > event.recordStart && event.sourceEnd >= event.sourceStart)
    .sort(
      (left, right) =>
        left.recordStart - right.recordStart ||
        left.trackType.localeCompare(right.trackType) ||
        left.id.localeCompare(right.id),
    );

  const matches = matchEdlEventsToMedia(validEvents, project.media);
  const usedIds = new Set<string>([
    ...project.media.map((asset) => asset.id),
    ...getProjectSequences(project).map((sequence) => sequence.id),
    ...getProjectSequences(project).flatMap((sequence) =>
      sequence.timeline.tracks.flatMap((track) => [track.id, ...track.clips.map((clip) => clip.id)]),
    ),
  ]);

  const missingMediaByKey = new Map<string, MediaAsset>();
  const importedMedia: MediaAsset[] = [];
  const clipInputs: Array<{ event: Cmx3600EdlEvent; asset: MediaAsset; clip: Clip }> = [];

  for (const match of matches) {
    const asset = match.asset ?? getOrCreateMissingMedia(match.event, project, usedIds, missingMediaByKey);
    if (!match.asset && !importedMedia.some((item) => item.id === asset.id)) {
      importedMedia.push(asset);
    }
    const clip = createClipForImportedEvent(match.event, asset, usedIds, fps);
    clipInputs.push({ event: match.event, asset, clip });
  }

  const tracks = buildImportedTracks(clipInputs);
  const transitions = buildImportedTransitions(clipInputs, parsed.transitions, fps);
  const timeline: Timeline = { tracks, transitions, markers: [] };

  const usedSequenceIds = new Set(getProjectSequences(project).map((s) => s.id));
  const sequence = createSequence({
    id: uniqueId(`sequence-fcpxml-${slug(title)}`, usedSequenceIds),
    name: title,
    timeline,
  });

  return {
    title,
    sequence,
    media: importedMedia,
    matches,
    matchedCount: matches.filter((match) => match.kind !== 'missing').length,
    missingCount: matches.filter((match) => match.kind === 'missing').length,
  };
}

export function applyFcpXmlImport(project: Project, result: FcpXmlImportResult): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const existingMediaIds = new Set(synced.media.map((asset) => asset.id));
  const media = [...synced.media, ...result.media.filter((asset) => !existingMediaIds.has(asset.id))];
  const sequences = [
    ...getProjectSequences(synced).filter((sequence) => sequence.id !== result.sequence.id),
    result.sequence,
  ];
  return {
    ...synced,
    media,
    sequences,
    timeline: result.sequence.timeline,
    activeSequenceId: result.sequence.id,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Internal helpers ────────────────────────────────────────

function getTextContent(parent: Element, tagName: string): string | null {
  const el = parent.querySelector(`:scope > ${tagName}`);
  return el?.textContent?.trim() ?? null;
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseRate(element: Element): number {
  const timebase = getTextContent(element, 'timebase');
  if (timebase) {
    const num = Number(timebase);
    if (Number.isFinite(num) && num > 0) return num;
  }
  // Try nested rate element
  const rateEl = element.querySelector(':scope > rate');
  if (rateEl) {
    const tb = getTextContent(rateEl, 'timebase');
    if (tb) {
      const num = Number(tb);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return 30;
}

function framesToSeconds(frames: number, fps: number): number {
  return round(frames / Math.max(1, fps));
}

function decodeFileUrl(url: string): string {
  // Convert file:// URL to local path
  const withoutScheme = url.replace(/^file:\/\/localhost\//i, '').replace(/^file:\/\//i, '');
  try {
    return normalizePath(decodeURIComponent(withoutScheme).replace(/^([A-Za-z])%3A/i, '$1:'));
  } catch {
    return normalizePath(withoutScheme.replace(/^([A-Za-z])%3A/i, '$1:'));
  }
}

function normalizeFps(fps: number): number {
  return Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
}

function normalizeImportTitle(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? `FCPXML ${trimmed}` : 'FCPXML Import';
}

function getOrCreateMissingMedia(
  event: Cmx3600EdlEvent,
  project: Project,
  usedIds: Set<string>,
  missingMediaByKey: Map<string, MediaAsset>,
): MediaAsset {
  const key = normalizeSearchName(event.clipName ?? event.sourceFile ?? event.reel);
  const existing = missingMediaByKey.get(key);
  if (existing) return existing;

  const name = event.clipName ?? (event.sourceFile ? basename(event.sourceFile) : event.reel);
  const duration = round(
    Math.max(
      event.sourceEnd,
      event.sourceEnd - event.sourceStart,
      event.recordEnd - event.recordStart,
      1 / normalizeFps(project.settings.fps),
    ),
  );
  const asset: MediaAsset = {
    id: uniqueId(`media-fcpxml-${slug(name)}`, usedIds),
    type: event.trackType === 'audio' ? 'audio' : 'video',
    name,
    path: event.sourceFile ?? name,
    duration,
    width: event.trackType === 'video' ? project.settings.width : 0,
    height: event.trackType === 'video' ? project.settings.height : 0,
    missing: true,
    hasAudio: event.trackType === 'audio',
  };
  missingMediaByKey.set(key, asset);
  return asset;
}

function createClipForImportedEvent(
  event: Cmx3600EdlEvent,
  asset: MediaAsset,
  usedIds: Set<string>,
  _fps: number,
): Clip {
  const id = uniqueId(`clip-fcpxml-${event.editNumber}-${slug(event.clipName ?? asset.name)}`, usedIds);
  const duration = round(event.recordEnd - event.recordStart);
  const trimEnd = round(Math.max(0, asset.duration - event.sourceEnd));
  const base = {
    id,
    name: event.clipName ?? asset.name,
    mediaId: asset.id,
    start: event.recordStart,
    duration,
    trimStart: event.trackType === 'video' && asset.type === 'image' ? 0 : event.sourceStart,
    trimEnd: event.trackType === 'video' && asset.type === 'image' ? 0 : trimEnd,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
    stabilization: { ...DEFAULT_STABILIZATION },
    frameInterpolation: { ...DEFAULT_FRAME_INTERPOLATION },
    slowMotionMode: DEFAULT_SLOW_MOTION_MODE,
    audioDenoise: { ...DEFAULT_AUDIO_DENOISE },
    masks: [],
    motionTrack: undefined,
    keyframes: undefined,
    effects: undefined,
  };
  if (event.trackType === 'video' && asset.type === 'image') {
    return { ...base, type: 'image', trackId: 'track-fcpxml-video' } satisfies ImageClip;
  }
  const audioDefaults = {
    volume: 1,
    muted: false,
    pitchSemitones: DEFAULT_AUDIO_PITCH_SEMITONES,
    reverseAudio: DEFAULT_AUDIO_REVERSE,
    fadeInDuration: DEFAULT_AUDIO_FADE_DURATION,
    fadeOutDuration: DEFAULT_AUDIO_FADE_DURATION,
    fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
    fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE,
  };
  if (event.trackType === 'audio') {
    return { ...base, ...audioDefaults, type: 'audio', trackId: 'track-fcpxml-audio' } satisfies AudioClip;
  }
  return { ...base, ...audioDefaults, type: 'video', trackId: 'track-fcpxml-video' } satisfies VideoClip;
}

function buildImportedTracks(inputs: Array<{ event: Cmx3600EdlEvent; clip: Clip }>): Track[] {
  const videoClips = inputs
    .filter((input) => input.event.trackType === 'video')
    .map((input) => ({ ...input.clip, trackId: 'track-fcpxml-video' }) as Clip)
    .sort(sortClips);
  const audioClips = inputs
    .filter((input) => input.event.trackType === 'audio')
    .map((input) => ({ ...input.clip, trackId: 'track-fcpxml-audio' }) as Clip)
    .sort(sortClips);
  return [
    createTrack({ id: 'track-fcpxml-video', type: 'video', name: 'FCPXML Video', clips: videoClips }),
    createTrack({ id: 'track-fcpxml-audio', type: 'audio', name: 'FCPXML Audio', clips: audioClips }),
    createTrack({ id: 'track-fcpxml-text', type: 'text', name: 'FCPXML Text', clips: [] }),
  ];
}

function buildImportedTransitions(
  inputs: Array<{ event: Cmx3600EdlEvent; clip: Clip }>,
  parsedTransitions: FcpXmlTransitionItem[],
  fps: number,
): Transition[] {
  const transitions: Transition[] = [];

  // If we have parsed transition items, use them to create transitions
  if (parsedTransitions.length > 0) {
    const videoInputs = inputs
      .filter((input) => input.event.trackType === 'video')
      .sort((left, right) => sortClips(left.clip, right.clip));

    for (let i = 1; i < videoInputs.length; i++) {
      const previous = videoInputs[i - 1];
      const current = videoInputs[i];
      const previousEnd = round(previous.clip.start + previous.clip.duration);

      // Check if clips are adjacent (transition between them)
      if (Math.abs(previousEnd - current.clip.start) < 0.001) {
        // Look for a matching parsed transition
        const matchingTransition = parsedTransitions.find(
          (t) => Math.abs(t.start - current.clip.start) < 0.001 || Math.abs(t.end - previousEnd) < 0.001,
        );
        if (matchingTransition && matchingTransition.duration > 0) {
          const duration = round(
            Math.min(previous.clip.duration, current.clip.duration, Math.max(1 / fps, matchingTransition.duration)),
          );
          const transitionType = normalizeTransitionEffectId(matchingTransition.effectId);
          transitions.push({
            id: `transition-fcpxml-${previous.clip.id}-${current.clip.id}`,
            type: transitionType,
            duration,
            fromClipId: previous.clip.id,
            toClipId: current.clip.id,
          });
        }
      }
    }
  }

  return transitions;
}

function normalizeTransitionEffectId(effectId: string | undefined): 'dissolve' | 'fade-black' {
  if (!effectId) return 'dissolve';
  const lower = effectId.toLowerCase();
  if (lower.includes('fade') && lower.includes('black')) return 'fade-black';
  return 'dissolve';
}

function sortClips(left: Clip, right: Clip): number {
  return left.start - right.start || left.id.localeCompare(right.id);
}

function normalizeSearchName(value: string): string {
  return (stripExtension(value) ?? value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripExtension(value: string | undefined): string | undefined {
  return value?.replace(/\.[^.\\/]+$/, '');
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function uniqueId(base: string, usedIds: Set<string>): string {
  const safeBase = base.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'fcpxml-import';
  let candidate = safeBase;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${safeBase}-${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function slug(value: string): string {
  const normalized = normalizeSearchName(value).replace(/\s+/g, '-');
  return normalized || 'clip';
}

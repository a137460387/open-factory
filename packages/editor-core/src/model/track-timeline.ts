import { round } from '../time';
import { finiteOrDefault } from '../math-utils';
export { finiteOrDefault };
import { isDefaultColorCurves, isNeutralThreeWayColor } from '../color-grading';
import {
  createId,
  normalizeColorCorrection,
  createTimelineMarker,
  createTimelineBookmark,
  createProjectAnnotation,
  createReviewAnnotation,
  createCollaborationNote,
  createTimelineNote,
  createExportRange,
  createProtectedRange,
} from '../model';
import {
  DEFAULT_CHROMA_KEY,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_NESTED_SEQUENCE_NAME,
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_SUBTITLE_TRACK_TYPE,
  DEFAULT_TRACK_COMPRESSOR,
  DEFAULT_TRACK_EQ,
  DEFAULT_TRACK_PAN,
  DEFAULT_TRACK_VOLUME,
  DEFAULT_TRANSFORM,
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_TRANSITION_TYPE,
  MAX_CHROMA_KEY_COLORS,
  MAX_NESTED_SEQUENCE_DEPTH,
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  PRIMARY_SEQUENCE_ID,
  TRANSITION_TYPES,
} from './defaults';
import { normalizeOptionalHexColor } from './annotations';
import type {
  ChromaKey,
  ChromaKeyColor,
  ChromaKeyMode,
  ClipQualityEnhancement,
  CollaborationNote,
  ColorCorrection,
  ExportRange,
  PathPoint,
  Project,
  ProjectAnnotation,
  ProjectSpeaker,
  ProtectedRange,
  ReviewAnnotation,
  Sequence,
  SubtitleLanguage,
  SubtitleTrackType,
  Timeline,
  TimelineBookmark,
  TimelineMarker,
  TimelineNote,
  TrackCompressor,
  TrackEQ,
  TrackEQBand,
  TrackEQBandType,
  Transform,
  TransitionType,
} from '../model-types';

export function normalizeTimelineMarker(marker: TimelineMarker, maxTime?: number): TimelineMarker {
  return createTimelineMarker(marker, maxTime);
}

export function normalizeQualityEnhancement(
  enhancement: Partial<ClipQualityEnhancement> | undefined,
): ClipQualityEnhancement {
  return {
    superResolution: enhancement?.superResolution === true,
    deblock: enhancement?.deblock === true,
    colorBoost: enhancement?.colorBoost === true,
    frameCompensation: enhancement?.frameCompensation === true,
  };
}

export function normalizeTimelineBookmark(bookmark: TimelineBookmark, maxTime?: number): TimelineBookmark {
  return createTimelineBookmark(bookmark, maxTime);
}

export function normalizeTransform(transform: Partial<Transform> | undefined): Transform {
  const legacyScale = clampTransformScale(transform?.scale, DEFAULT_TRANSFORM.scale);
  const rawScaleX =
    typeof transform?.scaleX === 'number' && Number.isFinite(transform.scaleX) ? transform.scaleX : undefined;
  const rawScaleY =
    typeof transform?.scaleY === 'number' && Number.isFinite(transform.scaleY) ? transform.scaleY : undefined;
  const clampedScaleX = clampTransformScale(rawScaleX, legacyScale);
  const clampedScaleY = clampTransformScale(rawScaleY, legacyScale);
  const staleUniformAxes =
    rawScaleX !== undefined &&
    rawScaleY !== undefined &&
    Math.abs(clampedScaleX - clampedScaleY) <= 0.000001 &&
    Math.abs(clampedScaleX - legacyScale) > 0.000001;
  const scaleX = staleUniformAxes ? legacyScale : clampedScaleX;
  const scaleY = staleUniformAxes ? legacyScale : clampedScaleY;
  return {
    x: round(finiteOrDefault(transform?.x, DEFAULT_TRANSFORM.x)),
    y: round(finiteOrDefault(transform?.y, DEFAULT_TRANSFORM.y)),
    scale: round((scaleX + scaleY) / 2),
    scaleX,
    scaleY,
    rotation: normalizeRotation(transform?.rotation),
    opacity: round(Math.min(1, Math.max(0, finiteOrDefault(transform?.opacity, DEFAULT_TRANSFORM.opacity)))),
  };
}

export function normalizeRotation(rotation: number | undefined): number {
  return round(Math.min(180, Math.max(-180, finiteOrDefault(rotation, DEFAULT_TRANSFORM.rotation))));
}

export function getTransformScaleX(transform: Partial<Transform> | undefined): number {
  return normalizeTransform(transform).scaleX ?? DEFAULT_TRANSFORM.scaleX ?? DEFAULT_TRANSFORM.scale;
}

export function getTransformScaleY(transform: Partial<Transform> | undefined): number {
  return normalizeTransform(transform).scaleY ?? DEFAULT_TRANSFORM.scaleY ?? DEFAULT_TRANSFORM.scale;
}

export function clampTransformScale(scale: number | undefined, fallback: number): number {
  return round(Math.min(4, Math.max(0.01, finiteOrDefault(scale, fallback))));
}

export function normalizeTimelineMarkers(markers: TimelineMarker[] | undefined, maxTime?: number): TimelineMarker[] {
  return [...(markers ?? [])]
    .map((marker) => normalizeTimelineMarker(marker, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeTimelineBookmarks(
  bookmarks: TimelineBookmark[] | undefined,
  maxTime?: number,
): TimelineBookmark[] {
  return [...(bookmarks ?? [])]
    .map((bookmark) => normalizeTimelineBookmark(bookmark, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeProjectAnnotation(annotation: ProjectAnnotation, maxTime?: number): ProjectAnnotation {
  return createProjectAnnotation(annotation, maxTime);
}

export function normalizeProjectAnnotations(
  annotations: ProjectAnnotation[] | undefined,
  maxTime?: number,
): ProjectAnnotation[] {
  return [...(annotations ?? [])]
    .map((annotation) => normalizeProjectAnnotation(annotation, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeReviewAnnotation(annotation: ReviewAnnotation, maxTime?: number): ReviewAnnotation {
  return createReviewAnnotation(annotation, maxTime);
}

export function normalizeReviewAnnotations(
  annotations: ReviewAnnotation[] | undefined,
  maxTime?: number,
): ReviewAnnotation[] {
  return [...(annotations ?? [])]
    .map((annotation) => normalizeReviewAnnotation(annotation, maxTime))
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
}

export function normalizeCollaborationNote(note: CollaborationNote, maxTime?: number): CollaborationNote {
  return createCollaborationNote(note, maxTime);
}

export function normalizeCollaborationNotes(
  notes: CollaborationNote[] | undefined,
  maxTime?: number,
): CollaborationNote[] {
  return [...(notes ?? [])]
    .map((note) => normalizeCollaborationNote(note, maxTime))
    .sort(
      (left, right) =>
        left.start - right.start ||
        (left.end ?? left.start) - (right.end ?? right.start) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
}

export function normalizeTimelineNote(note: TimelineNote, maxTime?: number): TimelineNote | undefined {
  const normalized = createTimelineNote(note, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeTimelineNotes(notes: TimelineNote[] | undefined, maxTime?: number): TimelineNote[] {
  return [...(notes ?? [])]
    .flatMap((note) => {
      const normalized = normalizeTimelineNote(note, maxTime);
      return normalized ? [normalized] : [];
    })
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
}

export function normalizeExportRange(range: ExportRange, maxTime?: number): ExportRange | undefined {
  const normalized = createExportRange(range, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeExportRanges(ranges: ExportRange[] | undefined, maxTime?: number): ExportRange[] {
  return [...(ranges ?? [])]
    .flatMap((range) => {
      const normalized = normalizeExportRange(range, maxTime);
      return normalized ? [normalized] : [];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}

export function normalizeProtectedRange(range: ProtectedRange, maxTime?: number): ProtectedRange | undefined {
  const normalized = createProtectedRange(range, maxTime);
  return normalized.end > normalized.start ? normalized : undefined;
}

export function normalizeProtectedRanges(ranges: ProtectedRange[] | undefined, maxTime?: number): ProtectedRange[] {
  return [...(ranges ?? [])]
    .flatMap((range) => {
      const normalized = normalizeProtectedRange(range, maxTime);
      return normalized ? [normalized] : [];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
}

export function normalizeTrackVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) {
    return DEFAULT_TRACK_VOLUME;
  }
  return round(Math.min(2, Math.max(0, volume)));
}

export function normalizeTrackPan(pan: number | undefined): number {
  if (typeof pan !== 'number' || !Number.isFinite(pan)) {
    return DEFAULT_TRACK_PAN;
  }
  return round(Math.min(1, Math.max(-1, pan)));
}

export function normalizeSubtitleLanguage(language: unknown): SubtitleLanguage {
  if (typeof language !== 'string') {
    return DEFAULT_SUBTITLE_LANGUAGE;
  }
  const primary = language.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return /^[a-z]{2}$/.test(primary) ? primary : DEFAULT_SUBTITLE_LANGUAGE;
}

export function normalizeSubtitleTrackType(value: unknown): SubtitleTrackType {
  return value === 'cc' ? 'cc' : DEFAULT_SUBTITLE_TRACK_TYPE;
}

export function normalizeSubtitleSpeaker(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeSubtitleSoundDesc(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^\[[^\]]+\]$/.test(trimmed) ? trimmed : `[${trimmed.replace(/^\[|\]$/g, '').trim()}]`;
}

export function normalizeProjectSpeakers(speakers: unknown): ProjectSpeaker[] {
  if (!Array.isArray(speakers)) {
    return [];
  }
  const output: ProjectSpeaker[] = [];
  const seen = new Set<string>();
  for (const speaker of speakers) {
    if (!speaker || typeof speaker !== 'object') {
      continue;
    }
    const name = normalizeSubtitleSpeaker((speaker as ProjectSpeaker).name);
    if (!name) {
      continue;
    }
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const id = normalizeSubtitleSpeaker((speaker as ProjectSpeaker).id) ?? createId('speaker');
    const color = normalizeOptionalHexColor((speaker as ProjectSpeaker).color);
    output.push(color ? { id, name, color } : { id, name });
  }
  return output;
}

export function normalizeSubtitleLanguageList(languages: unknown): SubtitleLanguage[] | undefined {
  if (!Array.isArray(languages)) {
    return undefined;
  }
  const output: SubtitleLanguage[] = [];
  const seen = new Set<string>();
  for (const language of languages) {
    const normalized = normalizeSubtitleLanguage(language);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function normalizeTrackEQ(eq: Partial<TrackEQ> | undefined): TrackEQ {
  const inputBands = Array.isArray(eq?.bands) ? eq.bands : [];
  return {
    enabled: eq?.enabled !== false,
    bands: DEFAULT_TRACK_EQ.bands.map((fallback, index) => normalizeTrackEQBand(inputBands[index], fallback)),
  };
}

export function normalizeTrackEQBand(
  band: Partial<TrackEQBand> | undefined,
  fallback: TrackEQBand = DEFAULT_TRACK_EQ.bands[1],
): TrackEQBand {
  return {
    id: typeof band?.id === 'string' && band.id.trim() ? band.id : fallback.id,
    type: normalizeTrackEQBandType(band?.type, fallback.type),
    frequency: round(Math.min(20_000, Math.max(20, finiteOrDefault(band?.frequency, fallback.frequency)))),
    gain: round(Math.min(24, Math.max(-24, finiteOrDefault(band?.gain, fallback.gain)))),
    q: round(Math.min(4, Math.max(0.1, finiteOrDefault(band?.q, fallback.q)))),
  };
}

export function normalizeTrackCompressor(compressor: Partial<TrackCompressor> | undefined): TrackCompressor {
  return {
    enabled: compressor?.enabled === true,
    threshold: round(
      Math.min(0, Math.max(-60, finiteOrDefault(compressor?.threshold, DEFAULT_TRACK_COMPRESSOR.threshold))),
    ),
    ratio: round(Math.min(20, Math.max(1, finiteOrDefault(compressor?.ratio, DEFAULT_TRACK_COMPRESSOR.ratio)))),
    attack: round(Math.min(2000, Math.max(0.01, finiteOrDefault(compressor?.attack, DEFAULT_TRACK_COMPRESSOR.attack)))),
    release: round(
      Math.min(9000, Math.max(0.01, finiteOrDefault(compressor?.release, DEFAULT_TRACK_COMPRESSOR.release))),
    ),
    makeupGain: round(
      Math.min(24, Math.max(0, finiteOrDefault(compressor?.makeupGain, DEFAULT_TRACK_COMPRESSOR.makeupGain))),
    ),
  };
}

export function normalizeMasterVolume(volume: number | undefined): number {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) {
    return DEFAULT_MASTER_VOLUME;
  }
  return round(Math.min(2, Math.max(0, volume)));
}

export function normalizeSequenceName(name: string | undefined): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || DEFAULT_NESTED_SEQUENCE_NAME;
}

export function getProjectSequences(project: Pick<Project, 'timeline' | 'sequences'>): Sequence[] {
  const sequences = project.sequences && project.sequences.length > 0 ? project.sequences : [];
  if (sequences.some((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)) {
    return sequences;
  }
  return [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline: project.timeline }, ...sequences];
}

export function getProjectActiveSequenceId(
  project: Pick<Project, 'activeSequenceId' | 'sequences' | 'timeline'>,
): string {
  const sequences = getProjectSequences(project);
  return sequences.some((sequence) => sequence.id === project.activeSequenceId)
    ? project.activeSequenceId
    : PRIMARY_SEQUENCE_ID;
}

export function getProjectPrimaryTimeline(
  project: Pick<Project, 'activeSequenceId' | 'timeline' | 'sequences'>,
): Timeline {
  const synced = replaceProjectActiveTimeline(project as Project, project.timeline);
  return (
    getProjectSequences(synced).find((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)?.timeline ?? synced.timeline
  );
}

export function replaceProjectActiveTimeline(project: Project, timeline: Timeline): Project {
  const activeSequenceId = getProjectActiveSequenceId(project);
  const sequences = getProjectSequences(project).map((sequence) =>
    sequence.id === activeSequenceId ? { ...sequence, timeline } : sequence,
  );
  return { ...project, timeline, sequences, activeSequenceId };
}

export function switchProjectActiveSequence(project: Project, sequenceId: string): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const target = getProjectSequences(synced).find((sequence) => sequence.id === sequenceId);
  if (!target) {
    return synced;
  }
  return { ...synced, timeline: target.timeline, activeSequenceId: target.id };
}

export function getNestedSequenceDepth(project: Project, sequenceId = PRIMARY_SEQUENCE_ID): number {
  const sequences = getProjectSequences(project);
  const sequence = sequences.find((item) => item.id === sequenceId);
  if (!sequence) {
    return 0;
  }
  return getNestedSequenceDepthForTimeline(project, sequence.timeline, new Set([sequenceId]));
}

export function isNestedSequenceDepthExceeded(
  project: Project,
  sequenceId = PRIMARY_SEQUENCE_ID,
  maxDepth = MAX_NESTED_SEQUENCE_DEPTH,
): boolean {
  return getNestedSequenceDepth(project, sequenceId) > maxDepth;
}

export function normalizeTrackEQBandType(
  type: TrackEQBandType | undefined,
  fallback: TrackEQBandType,
): TrackEQBandType {
  return type === 'lowshelf' || type === 'peaking' || type === 'highshelf' ? type : fallback;
}

export function normalizeRgbColor(color: ChromaKeyColor | readonly number[] | undefined): ChromaKeyColor {
  const input = Array.isArray(color) ? color : DEFAULT_CHROMA_KEY.color;
  return [normalizeRgbChannel(input[0]), normalizeRgbChannel(input[1]), normalizeRgbChannel(input[2])];
}

export function normalizeChromaKeyColors(chromaKey: Partial<ChromaKey> | undefined): ChromaKeyColor[] {
  const candidates =
    Array.isArray(chromaKey?.colors) && chromaKey.colors.length > 0
      ? chromaKey.colors
      : [chromaKey?.color ?? DEFAULT_CHROMA_KEY.color];
  const colors = candidates.slice(0, MAX_CHROMA_KEY_COLORS).map((color) => normalizeRgbColor(color));
  return colors.length > 0 ? colors : [[...DEFAULT_CHROMA_KEY.color]];
}

export function normalizeChromaKeyMode(mode: ChromaKeyMode | undefined): ChromaKeyMode {
  return mode === 'luma-key' || mode === 'difference-matte' || mode === 'chroma-key' ? mode : DEFAULT_CHROMA_KEY.mode;
}

export function normalizeRgbChannel(value: number | undefined): number {
  return Math.round(Math.min(255, Math.max(0, finiteOrDefault(value, 0))));
}

export function clonePathPoint(point: PathPoint): PathPoint {
  return {
    x: point.x,
    y: point.y,
    handleIn: point.handleIn ? { ...point.handleIn } : undefined,
    handleOut: point.handleOut ? { ...point.handleOut } : undefined,
  };
}

export function normalizeUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}

export function normalizePositiveUnit(value: number | undefined, fallback: number): number {
  return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}

export function getNestedSequenceDepthForTimeline(project: Project, timeline: Timeline, visited: Set<string>): number {
  let depth = 0;
  for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
    if (clip.type !== 'nested-sequence') {
      continue;
    }
    if (visited.has(clip.sequenceId)) {
      return MAX_NESTED_SEQUENCE_DEPTH + 1;
    }
    const sequence = getProjectSequences(project).find((item) => item.id === clip.sequenceId);
    if (!sequence) {
      continue;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(clip.sequenceId);
    depth = Math.max(depth, 1 + getNestedSequenceDepthForTimeline(project, sequence.timeline, nextVisited));
  }
  return depth;
}

export function normalizeTransitionType(type: TransitionType | undefined): TransitionType {
  return type && TRANSITION_TYPES.includes(type) ? type : DEFAULT_TRANSITION_TYPE;
}

export function normalizeTransitionDuration(duration: number | undefined): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return DEFAULT_TRANSITION_DURATION;
  }
  return round(Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, duration)));
}

export function isDefaultColorCorrection(colorCorrection: Partial<ColorCorrection> | undefined): boolean {
  const normalized = normalizeColorCorrection(colorCorrection);
  return (
    normalized.brightness === DEFAULT_COLOR_CORRECTION.brightness &&
    normalized.inputColorSpace === DEFAULT_COLOR_CORRECTION.inputColorSpace &&
    normalized.contrast === DEFAULT_COLOR_CORRECTION.contrast &&
    normalized.saturation === DEFAULT_COLOR_CORRECTION.saturation &&
    normalized.hue === DEFAULT_COLOR_CORRECTION.hue &&
    normalized.lutPath === DEFAULT_COLOR_CORRECTION.lutPath &&
    (normalized.luts?.length ?? 0) === 0 &&
    isDefaultColorCurves(normalized.colorCurves) &&
    isNeutralThreeWayColor(normalized.threeWayColor)
  );
}

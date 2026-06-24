import {
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TEXT_STYLE,
  PRIMARY_SEQUENCE_ID,
  clampClipSpeed,
  createSequence,
  createTransition,
  createTrack,
  normalizeTimelineMarkers,
  normalizeAudioFadeCurve,
  normalizeAudioFadeDuration,
  normalizeAudioDenoise,
  normalizeAudioChannelRouting,
  normalizeAudioPitchSemitones,
  normalizeChromaKey,
  normalizeClipBeatMarkers,
  normalizeClipBorder,
  normalizeClipPanoramaView,
  normalizeClipProjection,
  normalizeClipSceneCuts,
  normalizeColorCorrection,
  normalizeDetectedBpm,
  normalizeFrameInterpolation,
  normalizeMasks,
  normalizeMasterVolume,
  normalizeMediaMetadataEntry,
  normalizeMediaColorProfile,
  normalizeMotionTrack,
  normalizeMulticamSequence,
  normalizeProjectAnnotations,
  normalizeReviewAnnotations,
  normalizeCollaborationNotes,
  normalizeQualityEnhancement,
  normalizeTimelineNotes,
  normalizeTimelineBookmarks,
  normalizeExportRanges,
  normalizeProtectedRanges,
  normalizeProjectSettings,
  normalizeProjectSpeakers,
  normalizeSequenceFrameRate,
  normalizeSequenceName,
  normalizeSlowMotionMode,
  normalizeStabilization,
  normalizeSubtitleSoundDesc,
  normalizeSubtitleSpeaker,
  normalizeSubtitleTrackType,
  normalizeTextPath,
  normalizeTransform,
  normalizeVideoRestoration
} from '../model';
import { normalizeColorNodeGraph } from '../color-node-graph';
import type { Clip, ImageSequenceInfo, MediaAsset, MediaFolder, MediaMetadata, Project, Sequence, Subclip, Timeline, Transition } from '../model-types';
import { normalizeClipGroups } from '../clip-groups';
import { normalizeClipBlendMode } from '../blend-modes';
import { normalizeClipContentAnalysis } from '../content-analysis';
import { normalizeSpatialAudio } from '../spatial-audio';
import { normalizeClipPitchData } from '../audio-pitch';
import { normalizeAudioRestoration } from '../audio-restoration';
import { normalizeDataSubtitleSource } from '../subtitles/data-subtitle';
import { normalizeTimelineLabelColor } from '../timeline-color-labels';
import { normalizeMediaFolderId, normalizeMediaFolders, normalizeMediaImportedAt } from '../media-folders';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { cloneEffects } from '../effects';
import { normalizeRichTextDocument, normalizeTextArc, normalizeTextLayout, normalizeTextOpenTypeFeatures } from '../text-layout';
import { normalizeCreditsRollSpeed, normalizeCreditsRows, normalizeCreditsStyle } from '../credits-roll';
import { normalizeMotionGraphic } from '../motion-graphics';
import { normalizeBeatMarkers } from '../beats';
import { isVariableFrameRateProbe } from '../vfr';
import { clampTransitionDuration, findAdjacentTransitionClips, getTimelineDuration } from '../timeline';
import type { MigrationResult, ProjectFile, ProjectFileV1, ProjectFileV2 } from './project-types';
import { isAbsolutePath, makeRelativePath, normalizePath, resolveMediaPath } from './relative-paths';
import { normalizeProjectDocumentation } from './documentation';
import { pruneZoomMemory } from '../timeline-zoom';
import { normalizeProjectReleaseVersion } from './release-workflow';

const DEFAULT_SETTINGS = { fps: 30, timecodeFormat: 'ndf' as const, width: 1280, height: 720, colorPipeline: 'sdr-srgb' as const, workingColorSpace: 'srgb' as const };

export function serializeProjectFile(project: Project, projectPath?: string): ProjectFileV2 {
  const warnings: string[] = [];
  const mediaFolders = normalizeMediaFolders(project.mediaFolders);
  const primaryTimeline = clonePrimaryTimeline(project);
  const sequences = cloneProjectSequences(project);
  const clipIds = project.timeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
  const media = project.media.map((asset) => {
    const normalizedPath = normalizePath(asset.path);
    const relativePath = projectPath ? makeRelativePath(normalizedPath, projectPath) : asset.relativePath ?? null;
    if (projectPath && relativePath === null) {
      warnings.push(`Media ${asset.name} is on a different drive and will be saved with an absolute path.`);
    }
    return {
      ...asset,
      path: normalizedPath,
      folderId: normalizeMediaFolderId(asset.folderId, mediaFolders),
      importedAt: normalizeMediaImportedAt(asset.importedAt),
      relativePath,
      originalAbsolutePath: asset.originalAbsolutePath ?? normalizedPath,
      videoCodec: normalizeOptionalString(asset.videoCodec),
      frameRate: normalizeSequenceFrameRate(asset.frameRate),
      avgFrameRate: normalizeOptionalString(asset.avgFrameRate),
      realFrameRate: normalizeOptionalString(asset.realFrameRate),
      variableFrameRate: asset.variableFrameRate === true || isVariableFrameRateProbe({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }),
      fieldOrder: normalizeOptionalString(asset.fieldOrder),
      colorProfile: normalizeMediaColorProfile(asset.colorProfile),
      imageSequence: asset.imageSequence
        ? {
            ...asset.imageSequence,
            pattern: normalizePath(asset.imageSequence.pattern),
            paths: asset.imageSequence.paths.map(normalizePath)
          }
        : undefined
    };
  });

  return {
    schemaVersion: 2,
    project: {
      id: project.id,
      name: project.name,
      releaseVersion: normalizeProjectReleaseVersion(project.releaseVersion),
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
      masterVolume: normalizeMasterVolume(project.masterVolume),
      settings: normalizeProjectSettings({ ...DEFAULT_SETTINGS, ...project.settings }),
      media,
      mediaFolders,
      mediaMetadata: normalizeMediaMetadata(project.mediaMetadata, media),
      annotations: normalizeProjectAnnotations(project.annotations, getTimelineDuration(project.timeline)),
      reviewAnnotations: normalizeReviewAnnotations(project.reviewAnnotations, getTimelineDuration(project.timeline)),
      collaborationNotes: normalizeCollaborationNotes(project.collaborationNotes, getTimelineDuration(project.timeline)),
      timelineNotes: normalizeTimelineNotes(project.timelineNotes, getTimelineDuration(project.timeline)),
      bookmarks: normalizeTimelineBookmarks(project.bookmarks, getTimelineDuration(project.timeline)),
      beatMarkers: normalizeBeatMarkers(project.beatMarkers, getTimelineDuration(project.timeline)),
      exportRanges: normalizeExportRanges(project.exportRanges, getTimelineDuration(project.timeline)),
      protectedRanges: normalizeProtectedRanges(project.protectedRanges, getTimelineDuration(project.timeline)),
      clipGroups: normalizeClipGroups(project.clipGroups, clipIds),
      coverPath: normalizeProjectCoverPath(project.coverPath),
      speakers: normalizeProjectSpeakers(project.speakers),
      documentation: normalizeProjectDocumentation(project.documentation),
      timeline: primaryTimeline,
      sequences,
      subclips: project.subclips ?? [],
      activeSequenceId: project.activeSequenceId ?? PRIMARY_SEQUENCE_ID
      , zoomMemory: normalizeZoomMemory(project.zoomMemory)
    },
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

export function serializeProject(project: Project, projectPath?: string): ProjectFileV2 {
  return serializeProjectFile(project, projectPath);
}

export function deserializeProject(file: ProjectFile, projectPath?: string): Project {
  return migrateProjectFile(file, projectPath).project;
}

export function migrateProjectFile(file: ProjectFile, projectPath?: string): MigrationResult {
  if (isProjectFileV2(file)) {
    const mediaFolders = normalizeMediaFolders(file.project.mediaFolders);
    const media = file.project.media.map((asset) => normalizeMediaAsset(asset, projectPath, mediaFolders));
    const primaryTimeline = cloneTimeline(file.project.timeline);
    const sequences = cloneFileSequences(file.project.sequences, primaryTimeline);
    const activeSequenceId = normalizeActiveSequenceId(file.project.activeSequenceId, sequences);
    const activeTimeline = sequences.find((sequence) => sequence.id === activeSequenceId)?.timeline ?? primaryTimeline;
    const clipIds = activeTimeline.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
    return {
      project: {
        version: '0.2',
        id: file.project.id,
        name: file.project.name,
        releaseVersion: normalizeProjectReleaseVersion(file.project.releaseVersion),
        createdAt: file.project.createdAt,
        updatedAt: file.project.updatedAt,
        masterVolume: normalizeMasterVolume(file.project.masterVolume),
        settings: normalizeProjectSettings({ ...DEFAULT_SETTINGS, ...file.project.settings }),
        media,
        mediaFolders,
        mediaMetadata: normalizeMediaMetadata(file.project.mediaMetadata, media),
        annotations: normalizeProjectAnnotations(file.project.annotations, getTimelineDuration(primaryTimeline)),
        reviewAnnotations: normalizeReviewAnnotations(file.project.reviewAnnotations, getTimelineDuration(primaryTimeline)),
        collaborationNotes: normalizeCollaborationNotes(file.project.collaborationNotes, getTimelineDuration(primaryTimeline)),
        timelineNotes: normalizeTimelineNotes(file.project.timelineNotes, getTimelineDuration(primaryTimeline)),
        bookmarks: normalizeTimelineBookmarks(file.project.bookmarks, getTimelineDuration(primaryTimeline)),
        beatMarkers: normalizeBeatMarkers(file.project.beatMarkers, getTimelineDuration(primaryTimeline)),
        exportRanges: normalizeExportRanges(file.project.exportRanges, getTimelineDuration(primaryTimeline)),
        protectedRanges: normalizeProtectedRanges(file.project.protectedRanges, getTimelineDuration(primaryTimeline)),
        clipGroups: normalizeClipGroups(file.project.clipGroups, clipIds),
        coverPath: normalizeProjectCoverPath(file.project.coverPath),
        speakers: normalizeProjectSpeakers(file.project.speakers),
        documentation: normalizeProjectDocumentation(file.project.documentation),
        timeline: activeTimeline,
        sequences,
        subclips: normalizeSubclips((file.project as any).subclips),
        activeSequenceId
        , zoomMemory: normalizeZoomMemory(file.project.zoomMemory, sequences)
      },
      warnings: [...(file.warnings ?? [])]
    };
  }

  if (isProjectFileV1(file)) {
    const media: MediaAsset[] = file.assets.map((asset) => normalizeMediaAsset(asset, projectPath, []));
    const primaryTimeline = cloneTimeline(file.timeline);
    const sequences = [createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: primaryTimeline })];
    return {
      project: {
        version: '0.2',
        id: file.project.id,
        name: file.project.name,
        releaseVersion: normalizeProjectReleaseVersion(undefined),
        createdAt: file.project.createdAt,
        updatedAt: file.project.updatedAt,
        masterVolume: 1,
        settings: normalizeProjectSettings({ ...DEFAULT_SETTINGS, ...file.project.settings }),
        media,
        mediaFolders: [],
        mediaMetadata: {},
        annotations: [],
        reviewAnnotations: [],
        collaborationNotes: [],
        timelineNotes: [],
        bookmarks: [],
        beatMarkers: [],
        exportRanges: [],
        protectedRanges: [],
        clipGroups: [],
        coverPath: undefined,
        speakers: [],
        documentation: {},
        timeline: primaryTimeline,
        subclips: [],
        sequences,
        activeSequenceId: PRIMARY_SEQUENCE_ID
      },
      warnings: ['Migrated legacy version 0.1 project file from assets to media.']
    };
  }

  throw new Error('Unsupported project file format.');
}


function normalizeSubclip(input: Partial<Subclip> | undefined): Subclip | null {
  if (!input || typeof input !== 'object') return null;
  const id = typeof input.id === 'string' ? input.id : `subclip-${Math.random().toString(36).slice(2, 10)}`;
  const name = typeof input.name === 'string' ? input.name : 'Untitled';
  const sourceMediaId = typeof input.sourceMediaId === 'string' ? input.sourceMediaId : '';
  if (!sourceMediaId) return null;
  const inPoint = Number.isFinite(input.inPoint) ? Math.max(0, input.inPoint!) : 0;
  const outPoint = Number.isFinite(input.outPoint) ? Math.max(inPoint, input.outPoint!) : inPoint;
  return { id, name, sourceMediaId, inPoint, outPoint, color: input.color, description: input.description, createdAt: input.createdAt };
}

function normalizeSubclips(subclips: unknown): Subclip[] {
  if (!Array.isArray(subclips)) return [];
  return subclips.map(normalizeSubclip).filter((s): s is Subclip => s !== null);
}

function normalizeMediaMetadata(metadata: Record<string, MediaMetadata> | undefined, media: MediaAsset[]): Record<string, MediaMetadata> {
  const mediaIds = new Set(media.map((asset) => asset.id));
  const output: Record<string, MediaMetadata> = {};
  for (const [assetId, value] of Object.entries(metadata ?? {})) {
    const normalized = normalizeMediaMetadataEntry(value);
    if (!mediaIds.has(assetId) || !normalized) {
      continue;
    }
    output[assetId] = normalized;
  }
  return output;
}

export function isProjectFileV2(file: ProjectFile | unknown): file is ProjectFileV2 {
  return Boolean(file && typeof file === 'object' && (file as ProjectFileV2).schemaVersion === 2 && (file as ProjectFileV2).project?.media);
}

export function isProjectFileV1(file: ProjectFile | unknown): file is ProjectFileV1 {
  return Boolean(file && typeof file === 'object' && (file as ProjectFileV1).version === '0.1' && Array.isArray((file as ProjectFileV1).assets));
}

function normalizeMediaAsset(asset: MediaAsset, projectPath?: string, mediaFolders: MediaFolder[] = []): MediaAsset {
  const path = normalizePath(resolveMediaPath(asset, projectPath));
  return {
    ...asset,
    path,
    folderId: normalizeMediaFolderId(asset.folderId, mediaFolders),
    importedAt: normalizeMediaImportedAt(asset.importedAt),
    originalAbsolutePath: asset.originalAbsolutePath ?? path,
    relativePath: asset.relativePath === undefined ? null : asset.relativePath,
    videoCodec: normalizeOptionalString(asset.videoCodec),
    frameRate: normalizeSequenceFrameRate(asset.frameRate),
    avgFrameRate: normalizeOptionalString(asset.avgFrameRate),
    realFrameRate: normalizeOptionalString(asset.realFrameRate),
    variableFrameRate: asset.variableFrameRate === true || isVariableFrameRateProbe({ avgFrameRate: asset.avgFrameRate, realFrameRate: asset.realFrameRate }),
    fieldOrder: normalizeOptionalString(asset.fieldOrder),
    colorProfile: normalizeMediaColorProfile(asset.colorProfile),
    imageSequence: normalizeImageSequence(asset.imageSequence, projectPath)
  };
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeProjectCoverPath(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? normalizePath(value) : undefined;
}

function normalizeImageSequence(sequence: ImageSequenceInfo | undefined, projectPath?: string): ImageSequenceInfo | undefined {
  if (!sequence || !Array.isArray(sequence.paths) || sequence.paths.length === 0) {
    return undefined;
  }
  const paths = sequence.paths.map((item) =>
    normalizePath(resolveMediaPath({ path: item, relativePath: isAbsolutePath(item) ? null : item } as MediaAsset, projectPath))
  );
  const pattern =
    typeof sequence.pattern === 'string' && sequence.pattern.trim()
      ? normalizePath(resolveMediaPath({ path: sequence.pattern, relativePath: isAbsolutePath(sequence.pattern) ? null : sequence.pattern } as MediaAsset, projectPath))
      : paths[0];
  const frameRate = normalizeSequenceFrameRate(sequence.frameRate) ?? 30;
  const frameCount = Math.max(1, Math.round(sequence.frameCount || paths.length));
  return {
    pattern,
    startNumber: Math.max(0, Math.round(sequence.startNumber || 0)),
    frameCount,
    frameRate,
    paths: paths.slice(0, frameCount)
  };
}

function cloneTimeline(timeline: Timeline): Timeline {
  const tracks = timeline.tracks.map((track) =>
    createTrack({
      ...track,
      clips: track.clips.map((clip) => cloneClip(clip))
    })
  );
  const draft = { tracks, transitions: [] };
  return {
    tracks,
    markers: normalizeTimelineMarkers(timeline.markers, getTimelineDuration({ tracks })),
    transitions: (timeline.transitions ?? []).map((transition) => cloneTransition(transition, draft))
  };
}

function clonePrimaryTimeline(project: Project): Timeline {
  const sequences = cloneProjectSequences(project);
  return sequences.find((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)?.timeline ?? cloneTimeline(project.timeline);
}

function cloneProjectSequences(project: Project): Sequence[] {
  const sourceSequences =
    project.sequences && project.sequences.length > 0
      ? project.sequences
      : [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: project.timeline }];
  const activeSequenceId = project.activeSequenceId ?? PRIMARY_SEQUENCE_ID;
  const cloned = sourceSequences.map((sequence) =>
    createSequence({
      id: sequence.id,
      name: sequence.name,
      timeline: cloneTimeline(sequence.id === activeSequenceId ? project.timeline : sequence.timeline)
    })
  );
  if (!cloned.some((sequence) => sequence.id === PRIMARY_SEQUENCE_ID)) {
    cloned.unshift(createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: cloneTimeline(project.timeline) }));
  }
  return orderPrimarySequenceFirst(cloned);
}

function cloneFileSequences(sequences: Sequence[] | undefined, primaryTimeline: Timeline): Sequence[] {
  const cloned = (sequences ?? []).map((sequence) =>
    createSequence({
      id: sequence.id,
      name: normalizeSequenceName(sequence.name),
      timeline: cloneTimeline(sequence.timeline)
    })
  );
  const primaryIndex = cloned.findIndex((sequence) => sequence.id === PRIMARY_SEQUENCE_ID);
  if (primaryIndex >= 0) {
    cloned[primaryIndex] = createSequence({ ...cloned[primaryIndex], timeline: primaryTimeline });
  } else {
    cloned.unshift(createSequence({ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline: primaryTimeline }));
  }
  return orderPrimarySequenceFirst(cloned);
}

function orderPrimarySequenceFirst(sequences: Sequence[]): Sequence[] {
  return [...sequences].sort((left, right) => (left.id === PRIMARY_SEQUENCE_ID ? -1 : right.id === PRIMARY_SEQUENCE_ID ? 1 : left.name.localeCompare(right.name)));
}

function normalizeActiveSequenceId(activeSequenceId: string | undefined, sequences: Sequence[]): string {
  return sequences.some((sequence) => sequence.id === activeSequenceId) ? activeSequenceId! : PRIMARY_SEQUENCE_ID;
}

function cloneTransition(transition: Transition, timeline: Timeline): Transition {
  const cloned = createTransition(transition);
  const pair = findAdjacentTransitionClips(timeline, cloned.fromClipId, cloned.toClipId);
  if (!pair) {
    return cloned;
  }
  return {
    ...cloned,
    duration: clampTransitionDuration(cloned.duration, pair.fromClip, pair.toClip)
  };
}

function cloneClip<TClip extends Clip>(clip: TClip): TClip {
  const beatMarkers = normalizeClipBeatMarkers(clip.beatMarkers, clip.duration);
  const detectedBpm = normalizeDetectedBpm(clip.detectedBpm);
  const scenecuts = normalizeClipSceneCuts(clip.scenecuts, clip.duration);
  const cloned = {
    ...clip,
    speed: clampClipSpeed(clip.speed),
    colorLabel: normalizeTimelineLabelColor(clip.colorLabel),
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    ...(clip.colorNodeGraph ? { colorNodeGraph: normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection) } : {}),
    transform: normalizeTransform(clip.transform),
    chromaKey: normalizeChromaKey(clip.chromaKey),
    stabilization: normalizeStabilization(clip.stabilization),
    frameInterpolation: normalizeFrameInterpolation(clip.frameInterpolation),
    slowMotionMode: normalizeSlowMotionMode(clip.slowMotionMode),
    audioDenoise: normalizeAudioDenoise(clip.audioDenoise),
    audioRestoration: normalizeAudioRestoration(clip.audioRestoration),
    audioChannelRouting: normalizeAudioChannelRouting(clip.audioChannelRouting),
    videoRestoration: normalizeVideoRestoration(clip.videoRestoration),
    qualityEnhancement: normalizeQualityEnhancement(clip.qualityEnhancement),
    projection: normalizeClipProjection(clip.projection),
    panorama: normalizeClipPanoramaView(clip.panorama),
    masks: normalizeMasks(clip.masks),
    motionTrack: normalizeMotionTrack(clip.motionTrack, clip.duration),
    border: normalizeClipBorder(clip.border),
    sequenceFrameRate: normalizeSequenceFrameRate(clip.sequenceFrameRate),
    contentAnalysis: normalizeClipContentAnalysis(clip.contentAnalysis),
    pitchData: normalizeClipPitchData(clip.pitchData),
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration),
    effects: cloneEffects(clip.effects),
    blendMode: normalizeClipBlendMode(clip.blendMode),
    multicam: clip.type === 'nested-sequence' ? normalizeMulticamSequence(clip.multicam, clip.duration) : undefined,
    beatMarkers,
    detectedBpm,
    scenecuts
  };
  if (!beatMarkers) {
    delete (cloned as Partial<Clip>).beatMarkers;
  }
  if (detectedBpm === undefined) {
    delete (cloned as Partial<Clip>).detectedBpm;
  }
  if (!scenecuts) {
    delete (cloned as Partial<Clip>).scenecuts;
  }
  if (clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence') {
    Object.assign(cloned, {
      pitchSemitones: normalizeAudioPitchSemitones(clip.pitchSemitones),
      reverseAudio: clip.reverseAudio === true,
      fadeInDuration: normalizeAudioFadeDuration(clip.fadeInDuration, clip.duration),
      fadeOutDuration: normalizeAudioFadeDuration(clip.fadeOutDuration, clip.duration),
      fadeInCurve: normalizeAudioFadeCurve(clip.fadeInCurve),
      fadeOutCurve: normalizeAudioFadeCurve(clip.fadeOutCurve),
      spatialAudio: normalizeSpatialAudio(clip.spatialAudio)
    });
  }
  if (clip.type === 'text') {
    const text = typeof clip.text === 'string' ? clip.text : '';
    return {
      ...cloned,
      text,
      style: { ...DEFAULT_TEXT_STYLE, ...clip.style },
      richText: normalizeRichTextDocument(clip.richText, text),
      textLayout: normalizeTextLayout(clip.textLayout),
      openTypeFeatures: normalizeTextOpenTypeFeatures(clip.openTypeFeatures),
      arcText: normalizeTextArc(clip.arcText),
      pathText: normalizeTextPath(clip.pathText)
    } as TClip;
  }
  if (clip.type === 'subtitle') {
    const subtitleType = normalizeSubtitleTrackType(clip.subtitleType);
    return {
      ...cloned,
      subtitleType,
      speaker: subtitleType === 'cc' ? normalizeSubtitleSpeaker(clip.speaker) : undefined,
      soundDesc: subtitleType === 'cc' ? normalizeSubtitleSoundDesc(clip.soundDesc) : undefined,
      style: { ...DEFAULT_SUBTITLE_STYLE, ...clip.style },
      subtitleMode: clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE,
      dataSubtitle: normalizeDataSubtitleSource(clip.dataSubtitle)
    } as TClip;
  }
  if (clip.type === 'credits') {
    return {
      ...cloned,
      text: typeof clip.text === 'string' ? clip.text : '',
      rows: normalizeCreditsRows(clip.rows, clip.text),
      rollSpeed: normalizeCreditsRollSpeed(clip.rollSpeed),
      style: normalizeCreditsStyle(clip.style)
    } as TClip;
  }
  if (clip.type === 'motion-graphic') {
    return {
      ...cloned,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration)
    } as TClip;
  }
  return cloned as TClip;
}

/**
 * 规范化 zoomMemory 记录。
 * - 保留值为有限正数的条目
 * - 可选地清理不属于有效序列的孤立条目
 */
function normalizeZoomMemory(
  zoomMemory: unknown,
  sequences?: Sequence[]
): Record<string, number> | undefined {
  if (!zoomMemory || typeof zoomMemory !== 'object' || Array.isArray(zoomMemory)) {
    return undefined;
  }
  const validIds = sequences ? new Set(sequences.map((s) => s.id)) : undefined;
  const result: Record<string, number> = {};
  let hasEntries = false;
  for (const [key, value] of Object.entries(zoomMemory as Record<string, unknown>)) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      continue;
    }
    if (validIds) {
      const seqId = key.split(':')[0];
      if (!validIds.has(seqId)) {
        continue;
      }
    }
    result[key] = num;
    hasEntries = true;
  }
  return hasEntries ? result : undefined;
}


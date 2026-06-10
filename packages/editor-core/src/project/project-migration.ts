import {
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TEXT_STYLE,
  clampClipSpeed,
  createTransition,
  createTrack,
  normalizeTimelineMarkers,
  normalizeColorCorrection,
  normalizeMasterVolume,
  type Clip,
  type MediaAsset,
  type Project,
  type Timeline,
  type Transition
} from '../model';
import { cloneClipKeyframes, normalizeClipKeyframes } from '../keyframes';
import { clampTransitionDuration, findAdjacentTransitionClips, getTimelineDuration } from '../timeline';
import type { MigrationResult, ProjectFile, ProjectFileV1, ProjectFileV2 } from './project-types';
import { makeRelativePath, normalizePath, resolveMediaPath } from './relative-paths';

const DEFAULT_SETTINGS = { fps: 30, width: 1280, height: 720 };

export function serializeProjectFile(project: Project, projectPath?: string): ProjectFileV2 {
  const warnings: string[] = [];
  const media = project.media.map((asset) => {
    const normalizedPath = normalizePath(asset.path);
    const relativePath = projectPath ? makeRelativePath(normalizedPath, projectPath) : asset.relativePath ?? null;
    if (projectPath && relativePath === null) {
      warnings.push(`Media ${asset.name} is on a different drive and will be saved with an absolute path.`);
    }
    return {
      ...asset,
      path: normalizedPath,
      relativePath,
      originalAbsolutePath: asset.originalAbsolutePath ?? normalizedPath
    };
  });

  return {
    schemaVersion: 2,
    project: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
      masterVolume: normalizeMasterVolume(project.masterVolume),
      settings: { ...DEFAULT_SETTINGS, ...project.settings },
      media,
      timeline: cloneTimeline(project.timeline)
    },
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

export function migrateProjectFile(file: ProjectFile, projectPath?: string): MigrationResult {
  if (isProjectFileV2(file)) {
    const media = file.project.media.map((asset) => normalizeMediaAsset(asset, projectPath));
    return {
      project: {
        version: '0.2',
        id: file.project.id,
        name: file.project.name,
        createdAt: file.project.createdAt,
        updatedAt: file.project.updatedAt,
        masterVolume: normalizeMasterVolume(file.project.masterVolume),
        settings: { ...DEFAULT_SETTINGS, ...file.project.settings },
        media,
        timeline: cloneTimeline(file.project.timeline)
      },
      warnings: [...(file.warnings ?? [])]
    };
  }

  if (isProjectFileV1(file)) {
    const media = file.assets.map((asset) => normalizeMediaAsset(asset, projectPath));
    return {
      project: {
        version: '0.2',
        id: file.project.id,
        name: file.project.name,
        createdAt: file.project.createdAt,
        updatedAt: file.project.updatedAt,
        masterVolume: 1,
        settings: { ...DEFAULT_SETTINGS, ...file.project.settings },
        media,
        timeline: cloneTimeline(file.timeline)
      },
      warnings: ['Migrated legacy version 0.1 project file from assets to media.']
    };
  }

  throw new Error('Unsupported project file format.');
}

export function isProjectFileV2(file: ProjectFile | unknown): file is ProjectFileV2 {
  return Boolean(file && typeof file === 'object' && (file as ProjectFileV2).schemaVersion === 2 && (file as ProjectFileV2).project?.media);
}

export function isProjectFileV1(file: ProjectFile | unknown): file is ProjectFileV1 {
  return Boolean(file && typeof file === 'object' && (file as ProjectFileV1).version === '0.1' && Array.isArray((file as ProjectFileV1).assets));
}

function normalizeMediaAsset(asset: MediaAsset, projectPath?: string): MediaAsset {
  const path = normalizePath(resolveMediaPath(asset, projectPath));
  return {
    ...asset,
    path,
    originalAbsolutePath: asset.originalAbsolutePath ?? path,
    relativePath: asset.relativePath === undefined ? null : asset.relativePath
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
  const cloned = {
    ...clip,
    speed: clampClipSpeed(clip.speed),
    colorCorrection: normalizeColorCorrection(clip.colorCorrection),
    transform: { ...clip.transform },
    keyframes: normalizeClipKeyframes(cloneClipKeyframes(clip.keyframes), clip.duration)
  };
  if (clip.type === 'text') {
    return { ...cloned, style: { ...DEFAULT_TEXT_STYLE, ...clip.style } } as TClip;
  }
  if (clip.type === 'subtitle') {
    return {
      ...cloned,
      style: { ...DEFAULT_SUBTITLE_STYLE, ...clip.style },
      subtitleMode: clip.subtitleMode ?? DEFAULT_SUBTITLE_MODE
    } as TClip;
  }
  return cloned as TClip;
}

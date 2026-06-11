import type { Clip, MediaAsset, Project, Timeline } from '../model';
import { getTimelineDuration } from '../timeline';
import { buildExportProjectFromProject, buildFfmpegExportPlan } from './ffmpeg-builder';
export * from './export-types';
export * from './ffmpeg-builder';
export * from './ffmpeg-escape';
export * from './export-queue';

export interface ExportSegment {
  inputPath: string;
  start: number;
  duration: number;
  name: string;
}

export interface ExportPlan {
  segments: ExportSegment[];
  totalDuration: number;
  width: number;
  height: number;
  fps: number;
  limitation: string;
}

export function normalizeFfmpegPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function buildSingleVideoTrackExportPlan(project: Project): ExportPlan {
  const videoTrack = project.timeline.tracks.find((track) => track.type === 'video');
  const clips = (videoTrack?.clips ?? []).filter((clip): clip is Clip & { type: 'video' | 'image'; mediaId: string } =>
    clip.type === 'video' || clip.type === 'image'
  );
  const assetsById = new Map(project.media.map((asset) => [asset.id, asset]));
  const segments = clips
    .filter((clip) => clip.type === 'video')
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      const asset = assetsById.get(clip.mediaId) as MediaAsset | undefined;
      if (!asset) {
        throw new Error(`Missing media asset for clip ${clip.name}`);
      }
      return {
        inputPath: normalizeFfmpegPath(asset.path),
        start: clip.trimStart,
        duration: clip.duration,
        name: clip.name
      };
    });

  return {
    segments,
    totalDuration: getTimelineDuration(project.timeline),
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
    limitation: 'Current MVP exports the first video track only. Multi-track compositing and text export are planned for a later version.'
  };
}

export function timelineHasExportableVideo(timeline: Timeline): boolean {
  return timeline.tracks.some((track) =>
    track.clips.some((clip) => clip.type === 'video' || clip.type === 'image' || clip.type === 'text' || clip.type === 'subtitle' || clip.type === 'audio' || clip.type === 'nested-sequence')
  );
}

export function buildProjectFfmpegExportPlan(project: Project, outputPath: string) {
  return buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath }));
}

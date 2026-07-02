import type { Project, Clip, MediaAsset, ClipContentAnalysis } from '@open-factory/editor-core';
import { round } from '@open-factory/editor-core';
import type { ContentAnalysisTarget } from '../media/ContentAnalysisDialog';
import { canDiarizeSpeakersForClip } from './speakerDiarization';
import { canUseClipForAutoAudioSync, type AutoAudioSyncTarget } from './autoAudioSync';

export function isContentAnalysisClip(clip: Clip): clip is Extract<Clip, { type: 'video' | 'audio' | 'image' }> {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
}

export function collectContentAnalysisTargets(project: Project): ContentAnalysisTarget[] {
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  const targets: ContentAnalysisTarget[] = [];
  for (const clip of project.timeline.tracks.flatMap((track) => track.clips)) {
    if (!isContentAnalysisClip(clip)) {
      continue;
    }
    const asset = mediaById.get(clip.mediaId);
    if (asset && !asset.missing) {
      targets.push({ clip, asset });
    }
  }
  return targets;
}

export function findSpeakerDiarizationTarget(project: Project, preferredClipIds: string[]): { clip: Extract<Clip, { type: 'audio' | 'video' }>; asset: MediaAsset } | undefined {
  const preferred = new Set(preferredClipIds);
  const clips = project.timeline.tracks.flatMap((track) => track.clips);
  const candidates = [...clips.filter((clip) => preferred.has(clip.id)), ...clips];
  for (const clip of candidates) {
    if (clip.type !== 'audio' && clip.type !== 'video') {
      continue;
    }
    const asset = project.media.find((item) => item.id === clip.mediaId);
    if (canDiarizeSpeakersForClip(clip, asset)) {
      return { clip, asset: asset! };
    }
  }
  return undefined;
}

export function collectAutoAudioSyncTargets(project: Project, preferredClipIds: string[]): AutoAudioSyncTarget[] {
  if (preferredClipIds.length === 0) {
    return [];
  }
  const locations = project.timeline.tracks.flatMap((track) => track.clips.map((clip) => ({ clip, track })));
  const seen = new Set<string>();
  const targets: AutoAudioSyncTarget[] = [];
  for (const clipId of preferredClipIds) {
    const location = locations.find((item) => item.clip.id === clipId);
    if (!location || seen.has(location.clip.id)) {
      continue;
    }
    seen.add(location.clip.id);
    const clip = location.clip;
    if (clip.type !== 'audio' && clip.type !== 'video') {
      continue;
    }
    const asset = project.media.find((item) => item.id === clip.mediaId);
    if (asset && canUseClipForAutoAudioSync(clip, asset)) {
      targets.push({ clip, asset, track: location.track });
    }
  }
  return targets;
}

export function collectSpeakerDiarizationDialogueIntervals(project: Project, clip: Extract<Clip, { type: 'audio' | 'video' }>): Array<{ start: number; end: number }> {
  const clipStart = clip.start;
  const clipEnd = round(clip.start + clip.duration);
  return project.timeline.tracks
    .filter((track) => track.type === 'subtitle')
    .flatMap((track) => track.clips)
    .filter((subtitle): subtitle is Extract<Clip, { type: 'subtitle' }> => subtitle.type === 'subtitle')
    .map((subtitle) => ({
      start: Math.max(clipStart, subtitle.start),
      end: Math.min(clipEnd, round(subtitle.start + subtitle.duration))
    }))
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({
      start: round(interval.start - clipStart),
      end: round(interval.end - clipStart)
    }));
}

export function findContentAnalysisTarget(project: Project, clipId: string): ContentAnalysisTarget | undefined {
  return collectContentAnalysisTargets(project).find((target) => target.clip.id === clipId);
}

export function summarizeContentAnalysisByMedia(targets: ContentAnalysisTarget[]): Record<string, ClipContentAnalysis> {
  const output: Record<string, ClipContentAnalysis> = {};
  for (const target of targets) {
    if (target.clip.contentAnalysis) {
      output[target.asset.id] = target.clip.contentAnalysis;
    }
  }
  return output;
}

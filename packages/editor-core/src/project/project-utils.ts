import type { Project } from '../model-types';

export function projectUsesMediaOnTimeline(project: Project, assetId: string): boolean {
  return project.timeline.tracks.some((track) => track.clips.some((clip) => 'mediaId' in clip && clip.mediaId === assetId));
}

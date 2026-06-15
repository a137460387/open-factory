import type { ClipGroup, ExportRange, MediaAsset, MediaFolder, MediaMetadata, ProjectAnnotation, ProjectSettings, ProtectedRange, ReviewAnnotation, Sequence, Timeline, TimelineBookmark, TimelineNote } from '../model';
import type { BeatMarker } from '../beats';

export interface ProjectFileV1 {
  version: '0.1';
  project: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    settings: ProjectSettings;
  };
  assets: MediaAsset[];
  timeline: Timeline;
}

export interface ProjectFileV2 {
  schemaVersion: 2;
  project: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    masterVolume?: number;
    settings: ProjectSettings;
    media: MediaAsset[];
    mediaFolders?: MediaFolder[];
    mediaMetadata?: Record<string, MediaMetadata>;
    annotations?: ProjectAnnotation[];
    reviewAnnotations?: ReviewAnnotation[];
    timelineNotes?: TimelineNote[];
    bookmarks?: TimelineBookmark[];
    beatMarkers?: BeatMarker[];
    exportRanges?: ExportRange[];
    protectedRanges?: ProtectedRange[];
    clipGroups?: ClipGroup[];
    timeline: Timeline;
    sequences?: Sequence[];
    activeSequenceId?: string;
  };
  warnings?: string[];
}

export type ProjectFile = ProjectFileV1 | ProjectFileV2;

export interface MigrationResult {
  project: import('../model').Project;
  warnings: string[];
}

export interface MediaPathResolution {
  path: string;
  usedRelativePath: boolean;
}

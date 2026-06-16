import type {
  BeatMarker,
  ClipGroup,
  CollaborationNote,
  ExportRange,
  MediaAsset,
  MediaFolder,
  MediaMetadata,
  Project,
  ProjectAnnotation,
  ProjectDocumentation,
  ProjectSettings,
  ProjectSpeaker,
  ProtectedRange,
  ReviewAnnotation,
  Sequence,
  Timeline,
  TimelineBookmark,
  TimelineNote
} from '../model-types';

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
    collaborationNotes?: CollaborationNote[];
    timelineNotes?: TimelineNote[];
    bookmarks?: TimelineBookmark[];
    beatMarkers?: BeatMarker[];
    exportRanges?: ExportRange[];
    protectedRanges?: ProtectedRange[];
    clipGroups?: ClipGroup[];
    coverPath?: string;
    speakers?: ProjectSpeaker[];
    documentation?: ProjectDocumentation;
    timeline: Timeline;
    sequences?: Sequence[];
    activeSequenceId?: string;
  };
  warnings?: string[];
}

export type ProjectFile = ProjectFileV1 | ProjectFileV2;

export interface MigrationResult {
  project: Project;
  warnings: string[];
}

export interface MediaPathResolution {
  path: string;
  usedRelativePath: boolean;
}

import type { MediaAsset, MediaMetadata, ProjectSettings, Sequence, Timeline } from '../model';

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
    mediaMetadata?: Record<string, MediaMetadata>;
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

import { createProject, createTrack, PRIMARY_SEQUENCE_ID, DEFAULT_PRIMARY_SEQUENCE_NAME, type Project, type ProjectSettings, type Track, type TrackType } from '../model';
import type { ExportSettings } from '../export/export-types';

export type ProjectTemplateId = 'vertical-short' | 'youtube-horizontal' | 'square-social' | 'podcast' | 'cinema';
export type ProjectTemplateExportSettings = Partial<Omit<ExportSettings, 'outputPath'>>;

export interface ProjectTemplateTrackDefinition {
  id: string;
  type: TrackType;
  name: string;
}

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId;
  defaultName: string;
  settings: ProjectSettings;
  tracks: ProjectTemplateTrackDefinition[];
  exportSettings: ProjectTemplateExportSettings;
}

export interface InstantiatedProjectTemplate {
  template: ProjectTemplateDefinition;
  project: Project;
  exportSettings: ProjectTemplateExportSettings;
}

export const PROJECT_TEMPLATES: readonly ProjectTemplateDefinition[] = [
  {
    id: 'vertical-short',
    defaultName: 'Vertical Short',
    settings: { fps: 30, width: 1080, height: 1920 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' }
    ],
    exportSettings: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '10M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: '9:16',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'youtube-horizontal',
    defaultName: 'YouTube Horizontal',
    settings: { fps: 30, width: 1920, height: 1080 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' }
    ],
    exportSettings: {
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: 'source',
      hardwareEncoding: false
    }
  },
  {
    id: 'square-social',
    defaultName: 'Square Social',
    settings: { fps: 30, width: 1080, height: 1080 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-audio-main', type: 'audio', name: 'Audio 1' },
      { id: 'track-text-main', type: 'text', name: 'Text 1' }
    ],
    exportSettings: {
      width: 1080,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: '1:1',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'podcast',
    defaultName: 'Podcast',
    settings: { fps: 30, width: 1920, height: 1080 },
    tracks: [
      { id: 'track-host-audio', type: 'audio', name: 'Host Audio' },
      { id: 'track-music-bed', type: 'audio', name: 'Music Bed' }
    ],
    exportSettings: {
      audioCodec: 'aac',
      audioBitrate: '192k',
      format: 'm4a',
      outputMode: 'audio',
      loudnessNormalization: 'youtube'
    }
  },
  {
    id: 'cinema',
    defaultName: 'Cinema',
    settings: { fps: 24, width: 3840, height: 2160 },
    tracks: [
      { id: 'track-video-main', type: 'video', name: 'Video 1' },
      { id: 'track-video-overlay', type: 'video', name: 'Overlay Video' },
      { id: 'track-dialogue', type: 'audio', name: 'Dialogue' },
      { id: 'track-music', type: 'audio', name: 'Music' },
      { id: 'track-text-main', type: 'text', name: 'Titles' }
    ],
    exportSettings: {
      width: 3840,
      height: 2160,
      fps: 24,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '45M',
      audioBitrate: '320k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: '16:9',
      hardwareEncoding: false
    }
  }
];

export function getProjectTemplate(id: ProjectTemplateId): ProjectTemplateDefinition {
  const template = PROJECT_TEMPLATES.find((item) => item.id === id);
  if (!template) {
    throw new Error(`Unknown project template: ${id}`);
  }
  return template;
}

export function instantiateProjectTemplate(id: ProjectTemplateId, options: { name?: string } = {}): InstantiatedProjectTemplate {
  const template = getProjectTemplate(id);
  const project = createProject(options.name ?? template.defaultName);
  const timeline = {
    markers: [],
    transitions: [],
    tracks: template.tracks.map(createTemplateTrack)
  };
  const nextProject: Project = {
    ...project,
    name: options.name ?? template.defaultName,
    settings: { ...template.settings },
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID
  };
  return {
    template,
    project: nextProject,
    exportSettings: { ...template.exportSettings }
  };
}

function createTemplateTrack(track: ProjectTemplateTrackDefinition): Track {
  return createTrack({ ...track, clips: [] });
}

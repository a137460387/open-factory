// Inspector useClipInspectorState 测试共享 fixture
// 源文件：apps/desktop/src/components/Inspector/useClipInspectorState.ts（按功能域拆分多个测试文件复用）
import type { Clip, MediaAsset, Project, ProjectSettings, Track } from '@open-factory/editor-core';
import { DEFAULT_SUBTITLE_STYLE } from '@open-factory/editor-core';
import { makeAsset, makeClip, makeProject, makeTrack } from '../../Timeline/hooks/timeline/__tests__/test-fixtures';

export { makeAsset, makeClip, makeProject, makeTrack };

export function makeSubtitleClip(overrides: Record<string, unknown> = {}): Clip {
  const base = makeClip({ id: 'clip-sub', trackId: 'track-sub-1', duration: 4 });
  return {
    ...base,
    type: 'subtitle',
    text: '字幕文本',
    style: DEFAULT_SUBTITLE_STYLE,
    subtitleMode: 'burn-in',
    ...overrides,
  } as unknown as Clip;
}

export function makeTextClip(overrides: Record<string, unknown> = {}): Clip {
  const base = makeClip({ id: 'clip-text', trackId: 'track-text-1' });
  return {
    ...base,
    type: 'text',
    text: '标题文本',
    style: DEFAULT_SUBTITLE_STYLE,
    ...overrides,
  } as unknown as Clip;
}

export function makeImageClip(overrides: Record<string, unknown> = {}): Clip {
  const base = makeClip({ id: 'clip-image', trackId: 'track-image-1' });
  return { ...base, type: 'image' } as unknown as Clip;
}

export function makeAudioClip(overrides: Record<string, unknown> = {}): Clip {
  const base = makeClip({ id: 'clip-audio', trackId: 'track-audio-1' });
  return { ...base, type: 'audio' } as unknown as Clip;
}

export function makeProjectSettings(overrides: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    timecodeFormat: 'ndf',
    ...overrides,
  } as ProjectSettings;
}

/** 构造带说话人列表的 project（useClipInspectorState 依赖 project.speakers） */
export function makeInspectorProject(
  overrides: {
    tracks?: Track[];
    media?: MediaAsset[];
    speakers?: Project['speakers'];
  } = {},
): Project {
  const project = makeProject({ tracks: overrides.tracks, media: overrides.media });
  return { ...project, speakers: overrides.speakers ?? [] } as Project;
}

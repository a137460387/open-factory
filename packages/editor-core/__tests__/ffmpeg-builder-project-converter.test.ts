import { describe, expect, it } from 'vitest';
import {
  buildExportProjectFromProject,
  buildExportTimeline,
  buildExportClipKeyframes,
} from '../src/export/ffmpeg-builder/project-converter';
import { makeProject, makeVideoClip, makeAudioClip, makeTextClip, makeSubtitleClip, makeImageClip } from './test-utils';

// ---------------------------------------------------------------------------
// buildExportProjectFromProject
// ---------------------------------------------------------------------------
describe('buildExportProjectFromProject', () => {
  it('builds an export project with correct settings', () => {
    const project = makeProject();
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    expect(exportProject.name).toBe('Test Project');
    expect(exportProject.settings.outputPath).toBeTruthy();
    expect(exportProject.settings.width).toBeGreaterThan(0);
    expect(exportProject.settings.height).toBeGreaterThan(0);
    expect(exportProject.settings.fps).toBeGreaterThan(0);
  });

  it('merges custom settings', () => {
    const project = makeProject();
    const exportProject = buildExportProjectFromProject(project, {
      outputPath: '/out.mp4',
      settings: { width: 1280, height: 720, fps: 60 },
    });

    expect(exportProject.settings.width).toBe(1280);
    expect(exportProject.settings.height).toBe(720);
    expect(exportProject.settings.fps).toBe(60);
  });

  it('merges custom metadata', () => {
    const project = makeProject();
    const exportProject = buildExportProjectFromProject(project, {
      outputPath: '/out.mp4',
      metadata: { title: 'Custom Title' },
    });

    expect(exportProject.metadata?.title).toBe('Custom Title');
  });

  it('builds timeline with correct duration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'v1', duration: 10 })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    expect(exportProject.timeline.duration).toBeGreaterThanOrEqual(10);
  });

  it('builds timeline with video clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'v1', duration: 5 })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    const videoTrack = exportProject.timeline.tracks.find((t) => t.type === 'video');
    expect(videoTrack).toBeDefined();
    expect(videoTrack!.clips).toHaveLength(1);
    expect(videoTrack!.clips[0].type).toBe('video');
  });

  it('handles text clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'v1', duration: 5 })];
    project.timeline.tracks[2].clips = [makeTextClip({ id: 't1', start: 1, duration: 3, text: 'Hello' })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    const textTrack = exportProject.timeline.tracks.find((t) => t.type === 'text');
    expect(textTrack).toBeDefined();
    expect(textTrack!.clips[0].textStyle?.text).toBe('Hello');
  });

  it('handles subtitle clips', () => {
    const project = makeProject();
    // Ensure subtitle clips are in the text track since makeTimeline doesn't have a subtitle track
    project.timeline.tracks[2].clips = [makeSubtitleClip({ id: 's1', start: 0, duration: 2, text: 'Subtitle', trackId: 'track-text' })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    // Subtitle clips in a text track get converted with subtitleStyle
    const textTrack = exportProject.timeline.tracks.find((t) => t.type === 'text');
    expect(textTrack).toBeDefined();
    const subtitleClip = textTrack!.clips.find((c) => c.id === 's1');
    expect(subtitleClip).toBeDefined();
  });

  it('handles audio clips', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-audio',
      type: 'audio',
      name: 'voice.wav',
      path: '/voice.wav',
      duration: 10,
      width: 0,
      height: 0,
      audioChannels: 2,
      audioSampleRate: 44100,
    });
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'v1', duration: 10 })];
    project.timeline.tracks[1].clips = [makeAudioClip({ id: 'a1', mediaId: 'asset-audio', duration: 10 })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    const audioTrack = exportProject.timeline.tracks.find((t) => t.type === 'audio');
    expect(audioTrack).toBeDefined();
    expect(audioTrack!.clips[0].type).toBe('audio');
  });

  it('handles image clips', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-img',
      type: 'image',
      name: 'photo.jpg',
      path: '/photo.jpg',
      duration: 0,
      width: 1920,
      height: 1080,
    });
    project.timeline.tracks[0].clips = [makeImageClip({ id: 'img1', mediaId: 'asset-img', duration: 3 })];
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    const videoTrack = exportProject.timeline.tracks.find((t) => t.type === 'video');
    expect(videoTrack!.clips[0].type).toBe('image');
  });

  it('normalizes master volume', () => {
    const project = makeProject();
    project.masterVolume = 0.5;
    const exportProject = buildExportProjectFromProject(project, { outputPath: '/out.mp4' });

    expect(exportProject.masterVolume).toBe(0.5);
  });

  it('normalizes export reframe settings', () => {
    const project = makeProject();
    const exportProject = buildExportProjectFromProject(project, {
      outputPath: '/out.mp4',
      settings: { targetAspectRatio: '9:16' },
    });

    expect(exportProject.settings.targetAspectRatio).toBe('9:16');
  });
});

// ---------------------------------------------------------------------------
// buildExportClipKeyframes
// ---------------------------------------------------------------------------
describe('buildExportClipKeyframes', () => {
  it('returns null for undefined keyframes', () => {
    expect(buildExportClipKeyframes(undefined, 5, 1)).toBeNull();
  });

  it('normalizes keyframes with volume scaling', () => {
    const keyframes = {
      opacity: [{ id: 'k1', time: 0, value: 1, easing: 'linear' as const }],
      volume: [
        { id: 'k2', time: 0, value: 0.5, easing: 'linear' as const },
        { id: 'k3', time: 5, value: 1, easing: 'linear' as const },
      ],
    };
    const result = buildExportClipKeyframes(keyframes, 5, 0.8);
    expect(result).not.toBeNull();
    expect(result!.opacity).toHaveLength(1);
    expect(result!.volume).toHaveLength(2);
    // Volume should be scaled by trackVolume (0.8) and clamped to 0-2
    expect(result!.volume![0].value).toBeCloseTo(0.4);
    expect(result!.volume![1].value).toBeCloseTo(0.8);
  });

  it('clamps volume to 0-2 range', () => {
    const keyframes = {
      volume: [{ id: 'k1', time: 0, value: 5, easing: 'linear' as const }],
    };
    const result = buildExportClipKeyframes(keyframes, 5, 1);
    expect(result!.volume![0].value).toBe(2);
  });
});

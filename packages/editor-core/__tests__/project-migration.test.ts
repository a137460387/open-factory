import { describe, expect, it } from 'vitest';
import { createTrack, migrateProjectFile, serializeProject, type ProjectFileV1 } from '../src';
import { makeProject, makeSubtitleClip } from './test-utils';

describe('project schema migration', () => {
  it('serializes schemaVersion 2 project files with media and relativePath', () => {
    const file = serializeProject(makeProject(), 'C:/Videos/project.cutproj.json');

    expect(file.schemaVersion).toBe(2);
    expect(file.project.media[0].relativePath).toBe('sample.mp4');
    expect(file.project.media[0].originalAbsolutePath).toBe('C:/Videos/sample.mp4');
  });

  it('keeps absolute path and warning when media is on another drive', () => {
    const file = serializeProject(makeProject(), 'D:/Projects/project.cutproj.json');

    expect(file.project.media[0].relativePath).toBeNull();
    expect(file.warnings?.[0]).toContain('different drive');
  });

  it('migrates legacy assets to project media', () => {
    const project = makeProject();
    const legacy: ProjectFileV1 = {
      version: '0.1',
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        settings: project.settings
      },
      assets: project.media,
      timeline: project.timeline
    };

    const migrated = migrateProjectFile(legacy);
    expect(migrated.project.version).toBe('0.2');
    expect(migrated.project.media[0].path).toBe('C:/Videos/sample.mp4');
    expect(migrated.warnings[0]).toContain('legacy');
  });

  it('backfills missing text background style defaults during migration', () => {
    const project = makeProject();
    const textClip = {
      id: 'legacy-text',
      type: 'text' as const,
      name: 'Legacy Text',
      trackId: 'track-text',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      text: 'Legacy',
      style: {
        fontSize: 32,
        color: '#ffffff',
        fontFamily: 'Arial',
        bold: false,
        italic: false
      }
    };
    project.timeline.tracks[2].clips = [textClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const migratedText = migrated.project.timeline.tracks[2].clips[0];

    expect(migratedText.type).toBe('text');
    if (migratedText.type === 'text') {
      expect(migratedText.style.backgroundColor).toBe('#000000');
      expect(migratedText.style.backgroundOpacity).toBe(0);
    }
  });

  it('backfills missing subtitle style and mode defaults during migration', () => {
    const project = makeProject();
    const subtitleClip = makeSubtitleClip({ id: 'legacy-subtitle', text: 'Legacy subtitle' });
    delete (subtitleClip as Partial<typeof subtitleClip>).subtitleMode;
    delete (subtitleClip.style as Partial<typeof subtitleClip.style>).backgroundOpacity;
    delete (subtitleClip.style as Partial<typeof subtitleClip.style>).yOffset;
    project.timeline.tracks.push(createTrack({ id: 'track-subtitle', type: 'subtitle', name: 'Subtitles 1', clips: [subtitleClip] }));

    const migrated = migrateProjectFile(serializeProject(project));
    const migratedSubtitle = migrated.project.timeline.tracks.at(-1)?.clips[0];

    expect(migratedSubtitle?.type).toBe('subtitle');
    if (migratedSubtitle?.type === 'subtitle') {
      expect(migratedSubtitle.subtitleMode).toBe('burn-in');
      expect(migratedSubtitle.style.backgroundOpacity).toBe(0.55);
      expect(migratedSubtitle.style.yOffset).toBe(72);
    }
  });

  it('backfills clip speed and color correction defaults during migration', () => {
    const project = makeProject();
    const legacyClip = { ...project.timeline.tracks[0].clips[0] };
    delete (legacyClip as Partial<typeof legacyClip>).speed;
    delete (legacyClip as Partial<typeof legacyClip>).colorCorrection;
    project.timeline.tracks[0].clips = [legacyClip as never];

    const migrated = migrateProjectFile(serializeProject(project));
    const clip = migrated.project.timeline.tracks[0].clips[0];

    expect(clip.speed).toBe(1);
    expect(clip.colorCorrection).toEqual({ brightness: 0, contrast: 1, saturation: 1, hue: 0, lutPath: null });
  });

  it('normalizes timeline markers during migration', () => {
    const project = makeProject();
    project.timeline.markers = [
      { id: 'marker-late', time: 99, label: '  ', color: 'orange' },
      { id: 'marker-early', time: 1, label: 'Intro', color: '#3366FF' }
    ];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.markers).toEqual([
      { id: 'marker-early', time: 1, label: 'Intro', color: '#3366ff' },
      { id: 'marker-late', time: 10, label: 'Marker', color: '#f97316' }
    ]);
  });

  it('preserves clip LUT paths during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].colorCorrection = {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0,
      lutPath: 'C:\\LUTs\\cinematic.cube'
    };

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0].clips[0].colorCorrection.lutPath).toBe('C:\\LUTs\\cinematic.cube');
  });

  it('backfills track control defaults during migration', () => {
    const project = makeProject();
    const legacyTrack = { ...project.timeline.tracks[0] };
    delete (legacyTrack as Partial<typeof legacyTrack>).muted;
    delete (legacyTrack as Partial<typeof legacyTrack>).solo;
    delete (legacyTrack as Partial<typeof legacyTrack>).locked;
    delete (legacyTrack as Partial<typeof legacyTrack>).volume;
    delete (legacyTrack as Partial<typeof legacyTrack>).pan;
    project.timeline.tracks[0] = legacyTrack;

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.tracks[0]).toMatchObject({ muted: false, solo: false, locked: false, volume: 1, pan: 0 });
  });

  it('backfills and clamps project master volume during migration', () => {
    const project = makeProject();
    project.masterVolume = 3;

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.masterVolume).toBe(2);
    expect(migrateProjectFile({ ...serializeProject(project), project: { ...serializeProject(project).project, masterVolume: undefined } }).project.masterVolume).toBe(1);
  });

  it('backfills and clamps transition data during migration', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips[0].duration = 2;
    project.timeline.tracks[0].clips.push({ ...project.timeline.tracks[0].clips[0], id: 'clip-2', start: 2 });
    project.timeline.transitions = [{ id: 'transition-1', type: 'dissolve', duration: 3, fromClipId: 'clip-1', toClipId: 'clip-2' }];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.transitions).toEqual([{ id: 'transition-1', type: 'dissolve', duration: 1, fromClipId: 'clip-1', toClipId: 'clip-2' }]);
  });

  it('preserves transition data that cannot be matched during migration', () => {
    const project = makeProject();
    project.timeline.transitions = [{ id: 'orphan-transition', type: 'dissolve', duration: 0.25, fromClipId: 'missing-a', toClipId: 'missing-b' }];

    const migrated = migrateProjectFile(serializeProject(project));

    expect(migrated.project.timeline.transitions).toEqual(project.timeline.transitions);
  });
});

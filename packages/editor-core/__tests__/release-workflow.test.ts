import { describe, expect, it } from 'vitest';
import {
  buildProjectReleaseRecord,
  buildReleaseComparisonRequest,
  buildSemver,
  createReleaseRecordFileName,
  createTrack,
  diffReleaseSnapshots,
  incrementSemverPatch,
  normalizeProjectReleaseVersion,
  runReleaseChecklist
} from '../src';
import { makeProject, makeSubtitleClip, makeTimeline, makeVideoClip } from './test-utils';

describe('project release workflow', () => {
  it('increments semantic versions by patch and normalizes manual major/minor edits', () => {
    expect(incrementSemverPatch('2.3.9')).toBe('2.3.10');
    expect(incrementSemverPatch('bad')).toBe('0.1.1');
    expect(buildSemver('3', '4', '5')).toBe('3.4.5');
    expect(normalizeProjectReleaseVersion('01.002.0003')).toBe('1.2.3');
  });

  it('passes enabled checklist items when the project is releasable', () => {
    const project = makeProject();

    const result = runReleaseChecklist(project, undefined, {
      qualityAssurance: { status: 'warning' },
      exportPresetId: 'web-1080p',
      exportPresetName: 'Web 1080p'
    });

    expect(result.canRelease).toBe(true);
    expect(result.items.map((item) => [item.id, item.status])).toEqual([
      ['qualityGate', 'pass'],
      ['mediaRelink', 'pass'],
      ['subtitleProof', 'pass'],
      ['exportPreset', 'pass']
    ]);
  });

  it('blocks release for quality, relink, subtitle, and preset checklist failures', () => {
    const project = makeProject();
    project.media = [{ ...project.media[0], missing: true }];
    project.timeline = {
      ...makeTimeline(),
      tracks: [
        ...makeTimeline().tracks,
        createTrack({
          id: 'track-subtitle',
          type: 'subtitle',
          name: 'Subtitles',
          clips: [
            makeSubtitleClip({ id: 'empty-sub', trackId: 'track-subtitle', text: '   ' }),
            makeSubtitleClip({ id: 'long-sub', trackId: 'track-subtitle', text: 'This subtitle is too long for release proofing' })
          ]
        })
      ]
    };
    project.sequences = [{ ...project.sequences[0], timeline: project.timeline }];

    const result = runReleaseChecklist(project, undefined, {
      qualityAssurance: { status: 'fail' },
      subtitleMaxChars: 12
    });

    expect(result.canRelease).toBe(false);
    expect(result.blockingCount).toBe(4);
    expect(result.items.find((item) => item.id === 'mediaRelink')?.details).toContain('sample.mp4');
    expect(result.items.find((item) => item.id === 'subtitleProof')?.details).toEqual(
      expect.arrayContaining([expect.stringContaining('empty subtitle'), expect.stringContaining('exceeds 12')])
    );
  });

  it('skips disabled checklist items without blocking release', () => {
    const project = makeProject();
    project.media = [{ ...project.media[0], missing: true }];

    const result = runReleaseChecklist(
      project,
      {
        qualityGate: false,
        mediaRelink: false,
        subtitleProof: false,
        exportPreset: false
      },
      { qualityAssurance: { status: 'fail' } }
    );

    expect(result.canRelease).toBe(true);
    expect(result.items.every((item) => item.status === 'skipped')).toBe(true);
  });

  it('builds complete release records and persists changelog payloads', () => {
    const project = { ...makeProject(), id: 'project-release', name: 'Campaign', releaseVersion: '1.2.3' };
    const checklist = runReleaseChecklist(project, undefined, { exportPresetId: 'web-1080p', exportPresetName: 'Web 1080p' });

    const record = buildProjectReleaseRecord({
      project,
      version: '1.2.4',
      releasedAt: '2026-06-18T01:02:03.000Z',
      checklist,
      exportPath: 'C:/Exports/campaign.mp4',
      assignee: 'Ada',
      changelog: '## Changes\n- Final color pass',
      snapshotPath: 'C:/AppData/open-factory/snapshots/release.cutproj.json',
      exportPresetId: 'web-1080p',
      exportPresetName: 'Web 1080p'
    });

    expect(record).toMatchObject({
      schemaVersion: 1,
      projectId: 'project-release',
      projectName: 'Campaign',
      version: '1.2.4',
      releasedAt: '2026-06-18T01:02:03.000Z',
      exportPath: 'C:/Exports/campaign.mp4',
      duration: 10,
      assignee: 'Ada',
      changelog: '## Changes\n- Final color pass',
      snapshotPath: 'C:/AppData/open-factory/snapshots/release.cutproj.json',
      exportPresetId: 'web-1080p',
      exportPresetName: 'Web 1080p'
    });
    expect(record.checklist).toHaveLength(4);
    expect(createReleaseRecordFileName(record.version, record.releasedAt)).toBe('release_1.2.4_2026-06-18T01-02-03-000Z.json');
  });

  it('creates snapshot-backed release comparison requests and diffs', () => {
    const checklist = runReleaseChecklist(makeProject(), undefined, { exportPresetId: 'web-1080p' });
    const baseProject = makeProject();
    const targetProject = {
      ...makeProject(),
      timeline: makeTimeline([makeVideoClip({ id: 'clip-1', duration: 4 })])
    };
    const base = buildProjectReleaseRecord({
      project: baseProject,
      version: '1.0.0',
      checklist,
      exportPath: 'C:/Exports/base.mp4',
      snapshotPath: 'C:/snapshots/base.cutproj.json'
    });
    const target = buildProjectReleaseRecord({
      project: targetProject,
      version: '1.0.1',
      checklist,
      exportPath: 'C:/Exports/target.mp4',
      snapshotPath: 'C:/snapshots/target.cutproj.json'
    });

    expect(buildReleaseComparisonRequest(base, target)).toEqual({
      baseVersion: '1.0.0',
      targetVersion: '1.0.1',
      baseSnapshotPath: 'C:/snapshots/base.cutproj.json',
      targetSnapshotPath: 'C:/snapshots/target.cutproj.json'
    });

    const comparison = diffReleaseSnapshots(base, target, baseProject, targetProject);
    expect(comparison.baseVersion).toBe('1.0.0');
    expect(comparison.targetVersion).toBe('1.0.1');
    expect(comparison.diff.items.find((item) => item.id === 'clip-modified:clip-1')?.fields).toContainEqual(
      expect.objectContaining({ field: 'duration', before: 10, after: 4 })
    );
  });
});

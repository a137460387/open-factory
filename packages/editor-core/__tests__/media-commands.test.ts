import { describe, expect, it } from 'vitest';
import { BatchRenameMediaCommand, BatchUpdateMetadataCommand, CommandManager, MergeMediaCommand, PRIMARY_SEQUENCE_ID, RemoveMediaCommand, type Project } from '../src';
import { makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('media commands', () => {
  it('removes unused media with undo and redo', () => {
    let project = makeProjectWithMedia();
    const manager = new CommandManager();
    const accessor = projectAccessor(() => project, (next) => {
      project = next;
    });

    manager.execute(new RemoveMediaCommand(accessor, 'asset-orphan'));
    expect(project.media.map((asset) => asset.id)).toEqual(['asset-keep', 'asset-duplicate']);

    manager.undo();
    expect(project.media.map((asset) => asset.id)).toEqual(['asset-keep', 'asset-duplicate', 'asset-orphan']);

    manager.redo();
    expect(project.media.map((asset) => asset.id)).toEqual(['asset-keep', 'asset-duplicate']);
  });

  it('rejects removing media that timeline clips still reference', () => {
    let project = makeProjectWithMedia();
    const accessor = projectAccessor(() => project, (next) => {
      project = next;
    });

    expect(() => new RemoveMediaCommand(accessor, 'asset-duplicate').execute()).toThrow('still used');
  });

  it('merges duplicate media references and removes duplicate assets with undo', () => {
    let project = makeProjectWithMedia();
    const manager = new CommandManager();
    const accessor = projectAccessor(() => project, (next) => {
      project = next;
    });

    manager.execute(new MergeMediaCommand(accessor, 'asset-keep', ['asset-duplicate']));

    expect(project.media.map((asset) => asset.id)).toEqual(['asset-keep', 'asset-orphan']);
    expect(project.timeline.tracks[0].clips.map((clip) => ('mediaId' in clip ? clip.mediaId : undefined))).toEqual(['asset-keep', 'asset-keep']);

    manager.undo();
    expect(project.media.map((asset) => asset.id)).toEqual(['asset-keep', 'asset-duplicate', 'asset-orphan']);
    expect(project.timeline.tracks[0].clips.map((clip) => ('mediaId' in clip ? clip.mediaId : undefined))).toEqual(['asset-keep', 'asset-duplicate']);
  });

  it('updates media metadata in batches with undo', () => {
    let project = makeProjectWithMedia();
    const manager = new CommandManager();
    const accessor = projectAccessor(() => project, (next) => {
      project = next;
    });

    manager.execute(
      new BatchUpdateMetadataCommand(accessor, [
        { assetId: 'asset-keep', metadata: { title: 'Opening', author: 'Ada', description: 'Selects', copyright: 'Local Cut', date: '2026-06-18' } },
        { assetId: 'asset-orphan', metadata: { title: 'B-roll' } }
      ])
    );

    expect(project.mediaMetadata['asset-keep']).toMatchObject({
      title: 'Opening',
      author: 'Ada',
      description: 'Selects',
      copyright: 'Local Cut',
      date: '2026-06-18'
    });
    expect(project.mediaMetadata['asset-orphan']).toMatchObject({ labelColor: 'red', title: 'B-roll' });

    manager.undo();
    expect(project.mediaMetadata['asset-keep']).toBeUndefined();
    expect(project.mediaMetadata['asset-orphan']).toEqual({ labelColor: 'red' });
  });

  it('renames media project references with undo', () => {
    let project = makeProjectWithMedia();
    const manager = new CommandManager();
    const accessor = projectAccessor(() => project, (next) => {
      project = next;
    });

    manager.execute(
      new BatchRenameMediaCommand(accessor, [
        { assetId: 'asset-keep', name: '001_keep.mp4' },
        { assetId: 'asset-duplicate', name: '002_duplicate.mp4', path: 'D:/Mirror/002_duplicate.mp4' }
      ])
    );

    expect(project.media.find((asset) => asset.id === 'asset-keep')?.name).toBe('001_keep.mp4');
    expect(project.media.find((asset) => asset.id === 'asset-duplicate')).toMatchObject({
      name: '002_duplicate.mp4',
      path: 'D:/Mirror/002_duplicate.mp4'
    });

    manager.undo();
    expect(project.media.find((asset) => asset.id === 'asset-keep')?.name).toBe('keep.mp4');
    expect(project.media.find((asset) => asset.id === 'asset-duplicate')).toMatchObject({
      name: 'duplicate.mp4',
      path: 'D:/Mirror/keep.mp4'
    });
  });
});

function makeProjectWithMedia(): Project {
  const project = makeProject();
  const timeline = makeTimeline([
    makeVideoClip({ id: 'clip-a', mediaId: 'asset-keep', duration: 2 }),
    makeVideoClip({ id: 'clip-b', mediaId: 'asset-duplicate', start: 3, duration: 2 })
  ]);
  return {
    ...project,
    media: [
      { ...project.media[0], id: 'asset-keep', name: 'keep.mp4', path: 'C:/Media/keep.mp4' },
      { ...project.media[0], id: 'asset-duplicate', name: 'duplicate.mp4', path: 'D:/Mirror/keep.mp4' },
      { ...project.media[0], id: 'asset-orphan', name: 'orphan.mp4', path: 'C:/Media/orphan.mp4' }
    ],
    mediaMetadata: {
      'asset-orphan': { labelColor: 'red' }
    },
    timeline,
    sequences: [{ id: PRIMARY_SEQUENCE_ID, name: 'Main Sequence', timeline }],
    activeSequenceId: PRIMARY_SEQUENCE_ID
  };
}

function projectAccessor(getProject: () => Project, setProject: (project: Project) => void) {
  return { getProject, setProject };
}

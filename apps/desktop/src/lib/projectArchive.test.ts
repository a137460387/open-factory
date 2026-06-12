import { describe, expect, it } from 'vitest';
import { createProject, type MediaAsset } from '@open-factory/editor-core';
import { collectProjectMediaPaths, createProjectArchivePlan, serializeArchivedProject, writeProjectArchive } from './projectArchive';

function makeAsset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: overrides.id ?? 'asset-1',
    type: overrides.type ?? 'video',
    name: overrides.name ?? 'clip.mp4',
    path: overrides.path ?? 'C:/Media/clip.mp4',
    duration: overrides.duration ?? 1,
    width: overrides.width ?? 1280,
    height: overrides.height ?? 720,
    ...overrides
  };
}

describe('project archive', () => {
  it('collects media paths and rewrites archived project media to relative paths', () => {
    const project = createProject('Demo');
    project.media = [
      makeAsset({ id: 'video', name: 'clip.mp4', path: 'C:/Media/clip.mp4' }),
      makeAsset({
        id: 'sequence',
        type: 'image',
        name: 'frame001.png',
        path: 'C:/Media/frame001.png',
        imageSequence: {
          pattern: 'C:/Media/frame%03d.png',
          startNumber: 1,
          frameCount: 2,
          frameRate: 24,
          paths: ['C:/Media/frame001.png', 'C:/Media/frame002.png']
        }
      })
    ];

    const plan = createProjectArchivePlan(project, 'C:/Projects');
    const serialized = JSON.parse(serializeArchivedProject(plan.project)) as { project: { media: MediaAsset[] } };

    expect(collectProjectMediaPaths(project)).toEqual(['C:/Media/clip.mp4', 'C:/Media/frame001.png', 'C:/Media/frame002.png']);
    expect(plan.projectPath).toBe('C:/Projects/Demo_archive/Demo.cutproj.json');
    expect(plan.copyTasks.map((task) => task.destinationPath)).toEqual([
      'C:/Projects/Demo_archive/media/clip.mp4',
      'C:/Projects/Demo_archive/media/frame001.png',
      'C:/Projects/Demo_archive/media/frame002.png'
    ]);
    expect(serialized.project.media.map((asset) => asset.path)).toEqual(['media/clip.mp4', 'media/frame001.png']);
    expect(serialized.project.media[1].imageSequence?.paths).toEqual(['media/frame001.png', 'media/frame002.png']);
    expect(serialized.project.media.every((asset) => !asset.path.includes(':') && !asset.path.startsWith('/'))).toBe(true);
  });

  it('deduplicates repeated files and skips files already inside the archive directory', async () => {
    const project = createProject('Demo');
    project.media = [
      makeAsset({ id: 'first', path: 'C:/Media/shared.mp4' }),
      makeAsset({ id: 'second', path: 'C:/Media/shared.mp4' }),
      makeAsset({ id: 'archived', path: 'C:/Projects/Demo_archive/media/already.mp4' })
    ];
    const copies: Array<[string, string]> = [];
    const writes = new Map<string, string>();

    const plan = createProjectArchivePlan(project, 'C:/Projects');
    await writeProjectArchive(plan, {
      copyFile: (source, destination) => {
        copies.push([source, destination]);
      },
      writeFile: (path, contents) => {
        writes.set(path, contents);
      }
    });

    expect(plan.copyTasks).toHaveLength(2);
    expect(plan.copyTasks.find((task) => task.sourcePath.endsWith('already.mp4'))).toMatchObject({
      copyRequired: false,
      relativePath: 'media/already.mp4'
    });
    expect(copies).toEqual([['C:/Media/shared.mp4', 'C:/Projects/Demo_archive/media/shared.mp4']]);
    expect(writes.has('C:/Projects/Demo_archive/Demo.cutproj.json')).toBe(true);
  });

  it('renames different source files with colliding file names', () => {
    const project = createProject('Demo');
    project.media = [
      makeAsset({ id: 'first', path: 'C:/Camera A/clip.mp4' }),
      makeAsset({ id: 'second', path: 'C:/Camera B/clip.mp4' })
    ];

    const plan = createProjectArchivePlan(project, 'C:/Projects');

    expect(plan.copyTasks.map((task) => task.destinationPath)).toEqual([
      'C:/Projects/Demo_archive/media/clip.mp4',
      'C:/Projects/Demo_archive/media/clip-2.mp4'
    ]);
    expect(plan.project.media.map((asset) => asset.path)).toEqual(['media/clip.mp4', 'media/clip-2.mp4']);
  });

  it('skips missing source paths when archive preflight continues', () => {
    const project = createProject('Demo');
    project.media = [
      makeAsset({ id: 'present', path: 'C:/Media/present.mp4' }),
      makeAsset({ id: 'missing', path: 'C:/Missing/missing.mp4' })
    ];

    const plan = createProjectArchivePlan(project, 'C:/Projects', { skipSourcePaths: ['C:/Missing/missing.mp4'] });

    expect(plan.copyTasks.map((task) => task.sourcePath)).toEqual(['C:/Media/present.mp4']);
    expect(plan.project.media.find((asset) => asset.id === 'present')?.path).toBe('media/present.mp4');
    expect(plan.project.media.find((asset) => asset.id === 'missing')).toMatchObject({
      path: '../../Missing/missing.mp4',
      missing: true
    });
  });
});

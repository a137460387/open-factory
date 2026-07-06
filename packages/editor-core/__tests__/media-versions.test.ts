import { describe, expect, it } from 'vitest';
import {
  addMediaVersion,
  buildMediaVersionCompareRequest,
  createMediaVersionFromAsset,
  findMediaVersionAsset,
  findMediaVersionOwner,
  getMediaVersionLabel,
  listMediaVersionEntries,
  normalizeMediaVersions,
  removeMediaVersion
} from '../src';
import { makeProject } from './test-utils';

describe('media versions', () => {
  it('creates labels and appends unique media versions', () => {
    const project = makeProject();
    const versionAsset = {
      ...project.media[0],
      id: 'asset-2',
      name: 'sample-grade.mp4',
      path: 'C:/Videos/sample-grade.mp4',
      duration: 18
    };

    const metadata = addMediaVersion(undefined, versionAsset);
    const duplicate = addMediaVersion(metadata, versionAsset);

    expect(getMediaVersionLabel(0)).toBe('v1');
    expect(metadata.versions).toHaveLength(1);
    expect(metadata.versions?.[0]).toMatchObject({ label: 'v2', assetId: 'asset-2', path: 'C:/Videos/sample-grade.mp4' });
    expect(duplicate.versions).toHaveLength(1);
  });

  it('normalizes version lists and removes invalid or duplicate entries', () => {
    const versions = normalizeMediaVersions([
      { id: 'v2', label: 'v2', assetId: 'asset-2', path: 'C:/Videos/a.mp4', name: 'a.mp4', createdAt: '2026-06-16T00:00:00.000Z' },
      { id: 'dup', label: 'v2 copy', assetId: 'asset-2', path: 'C:/Videos/a.mp4', name: 'a-copy.mp4', createdAt: '2026-06-16T00:00:00.000Z' },
      { id: 'bad', label: '', path: 'C:/Videos/b.mp4', name: 'b.mp4' }
    ]);

    expect(versions).toHaveLength(1);
    expect(versions?.[0].id).toBe('v2');
  });

  it('removes versions while preserving other media metadata fields', () => {
    const project = makeProject();
    const version = createMediaVersionFromAsset({ ...project.media[0], id: 'asset-2', path: 'C:/Videos/v2.mp4', name: 'v2.mp4' }, 1, '2026-06-16T00:00:00.000Z');

    const metadata = removeMediaVersion({ labelColor: 'blue', versions: [version] }, version.id);

    expect(metadata).toEqual({ labelColor: 'blue' });
  });

  it('builds entries with an implicit original version and compare requests', () => {
    const project = makeProject();
    const versionAsset = { ...project.media[0], id: 'asset-2', name: 'sample-v2.mp4', path: 'C:/Videos/sample-v2.mp4' };
    project.media.push(versionAsset);
    project.mediaMetadata = {
      'asset-1': {
        versions: [createMediaVersionFromAsset(versionAsset, 1, '2026-06-16T00:00:00.000Z')]
      }
    };

    const entries = listMediaVersionEntries(project.media[0], project.mediaMetadata['asset-1'], project.media);
    const request = buildMediaVersionCompareRequest(project, 'asset-1', undefined, undefined, 4.25);

    expect(entries.map((entry) => [entry.label, entry.assetId, entry.isOriginal])).toEqual([
      ['v1', 'asset-1', true],
      ['v2', 'asset-2', false]
    ]);
    expect(request?.left.assetId).toBe('asset-1');
    expect(request?.right.assetId).toBe('asset-2');
    expect(request?.time).toBe(4.25);
  });

  it('returns undefined when asset has fewer than 2 versions', () => {
    const project = makeProject();
    expect(buildMediaVersionCompareRequest(project, 'asset-1')).toBeUndefined();
  });

  it('returns undefined when assetId is not found', () => {
    const project = makeProject();
    expect(buildMediaVersionCompareRequest(project, 'nonexistent')).toBeUndefined();
  });

  it('falls back to first/second entry when version IDs do not match', () => {
    const project = makeProject();
    const versionAsset = { ...project.media[0], id: 'asset-2', name: 'sample-v2.mp4', path: 'C:/Videos/sample-v2.mp4' };
    project.media.push(versionAsset);
    project.mediaMetadata = {
      'asset-1': {
        versions: [createMediaVersionFromAsset(versionAsset, 1, '2026-06-16T00:00:00.000Z')]
      }
    };

    const request = buildMediaVersionCompareRequest(project, 'asset-1', 'nonexistent-left', 'nonexistent-right');
    expect(request).toBeDefined();
    expect(request?.left.assetId).toBe('asset-1');
    expect(request?.right.assetId).toBe('asset-2');
  });

  it('finds media version owner by original asset id', () => {
    const project = makeProject();
    const versionAsset = { ...project.media[0], id: 'asset-2', name: 'v2.mp4', path: 'C:/Videos/v2.mp4' };
    project.media.push(versionAsset);
    project.mediaMetadata = {
      'asset-1': {
        versions: [createMediaVersionFromAsset(versionAsset, 1, '2026-06-16T00:00:00.000Z')]
      }
    };

    expect(findMediaVersionOwner(project, 'asset-1')?.id).toBe('asset-1');
    expect(findMediaVersionOwner(project, 'asset-2')?.id).toBe('asset-1');
    expect(findMediaVersionOwner(project, 'nonexistent')).toBeUndefined();
  });

  it('finds media version asset by entry assetId', () => {
    const project = makeProject();
    expect(findMediaVersionAsset(project, { assetId: 'asset-1' })?.id).toBe('asset-1');
    expect(findMediaVersionAsset(project, { assetId: 'nonexistent' })).toBeUndefined();
  });

  it('skips non-object entries when normalizing version lists', () => {
    expect(normalizeMediaVersions([null, 42, undefined, 'text'])).toBeUndefined();
  });

  it('falls back to version properties when referenced media is absent from the list', () => {
    const project = makeProject();
    const versionAsset = {
      ...project.media[0],
      id: 'asset-2',
      name: 'sample-v2.mp4',
      path: 'C:/Videos/sample-v2.mp4'
    };
    const metadata = addMediaVersion(undefined, versionAsset);

    const entries = listMediaVersionEntries(project.media[0], metadata);

    expect(entries).toHaveLength(2);
    expect(entries[1].assetId).toBe('asset-2');
    expect(entries[1].path).toBe('C:/Videos/sample-v2.mp4');
    expect(entries[1].name).toBe('sample-v2.mp4');
    expect(entries[1].isOriginal).toBe(false);
  });

  it('returns undefined when removing the sole version from versions-only metadata', () => {
    const project = makeProject();
    const version = createMediaVersionFromAsset(
      { ...project.media[0], id: 'asset-2', path: 'C:/Videos/v2.mp4', name: 'v2.mp4' },
      1,
      '2026-06-16T00:00:00.000Z'
    );

    const result = removeMediaVersion({ versions: [version] }, version.id);

    expect(result).toBeUndefined();
  });

  it('returns undefined when removing from undefined metadata', () => {
    expect(removeMediaVersion(undefined, 'nonexistent')).toBeUndefined();
  });

  it('finds existing version by matching path when assetId differs', () => {
    const project = makeProject();
    const existingVersion = {
      id: 'v-custom',
      label: 'v2',
      assetId: 'different-id',
      path: project.media[0].path,
      name: 'custom.mp4',
      createdAt: '2026-06-16T00:00:00.000Z'
    };
    const metadata = { versions: [existingVersion] };

    const result = addMediaVersion(metadata, project.media[0]);

    expect(result.versions).toHaveLength(1);
    expect(result.versions?.[0].id).toBe('v-custom');
  });

  it('normalizes non-finite time to 0 in compare request', () => {
    const project = makeProject();
    const versionAsset = { ...project.media[0], id: 'asset-2', name: 'sample-v2.mp4', path: 'C:/Videos/sample-v2.mp4' };
    project.media.push(versionAsset);
    project.mediaMetadata = {
      'asset-1': {
        versions: [createMediaVersionFromAsset(versionAsset, 1, '2026-06-16T00:00:00.000Z')]
      }
    };

    const request = buildMediaVersionCompareRequest(project, 'asset-1', undefined, undefined, Number.NaN);

    expect(request?.time).toBe(0);
  });

  it('removes one version while keeping others in multi-version metadata', () => {
    const project = makeProject();
    const version1 = createMediaVersionFromAsset(
      { ...project.media[0], id: 'asset-2', path: 'C:/Videos/v2.mp4', name: 'v2.mp4' },
      1,
      '2026-06-16T00:00:00.000Z'
    );
    const version2 = createMediaVersionFromAsset(
      { ...project.media[0], id: 'asset-3', path: 'C:/Videos/v3.mp4', name: 'v3.mp4' },
      2,
      '2026-06-17T00:00:00.000Z'
    );

    const result = removeMediaVersion({ versions: [version1, version2] }, version1.id);

    expect(result?.versions).toHaveLength(1);
    expect(result?.versions?.[0].assetId).toBe('asset-3');
  });
});

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
});

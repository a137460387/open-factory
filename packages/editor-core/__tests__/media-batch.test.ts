import { describe, expect, it, vi } from 'vitest';
import {
  applyMediaRenameRules,
  buildMediaRenamePreview,
  collectExportMediaMetadata,
  expandMediaRenameTemplate,
  makeUniqueMediaName,
  replaceMediaPathBasename,
  type MediaAsset
} from '../src';

const asset: MediaAsset = {
  id: 'asset-a',
  type: 'video',
  name: 'Scene One.MP4',
  path: 'C:/Media/Scene One.MP4',
  duration: 10,
  width: 1920,
  height: 1080
};

describe('media batch rename helpers', () => {
  it('expands template variables for index date and original name', () => {
    expect(expandMediaRenameTemplate('{index:03d}_{date}_{originalName}', asset, { index: 7, date: '20260618' })).toBe('007_20260618_Scene One.MP4');
    expect(expandMediaRenameTemplate('{index}_{originalStem}.{extension}', asset, { index: 12, date: '20260618' })).toBe('12_Scene One.MP4');
    expect(expandMediaRenameTemplate('{unknown}_{originalStem}', asset, { index: 12, date: '20260618' })).toBe('{unknown}_Scene One');
  });

  it('applies sequence date find replace case and cleanup rules', () => {
    expect(
      applyMediaRenameRules(
        { ...asset, name: 'Scene One! Raw.MP4' },
        { sequencePrefix: true, datePrefix: true, find: 'Raw', replace: 'select', caseTransform: 'lower', removeSpecialCharacters: true, startIndex: 4, date: '20260618' }
      )
    ).toBe('004_20260618_scene one select.MP4');
  });

  it('applies title upper case and default date rules', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T00:00:00.000Z'));
    expect(applyMediaRenameRules({ ...asset, name: 'rough_cut.mov' }, { caseTransform: 'upper' })).toBe('ROUGH_CUT.mov');
    expect(applyMediaRenameRules({ ...asset, name: 'rough cut.mov' }, { caseTransform: 'title' })).toBe('Rough Cut.mov');
    expect(applyMediaRenameRules(asset, { template: '{date}_{originalStem}', startIndex: 0 })).toBe('20260618_Scene One');
    vi.useRealTimers();
  });

  it('sanitizes empty names and names without extensions', () => {
    expect(applyMediaRenameRules({ ...asset, name: 'fallback.mp4' }, { template: '<>:"/\\|?*' })).toBe('fallback.mp4');
    expect(makeUniqueMediaName('', new Set())).toEqual({ name: 'media' });
    expect(expandMediaRenameTemplate('{originalStem}-{extension}', { ...asset, name: 'README' }, { index: 1, date: '20260618' })).toBe('README-');
  });

  it('appends conflict suffixes before the extension', () => {
    const assets = [
      asset,
      { ...asset, id: 'asset-b', name: 'Scene Two.MP4' },
      { ...asset, id: 'asset-c', name: 'Scene Three.MP4' }
    ];
    const preview = buildMediaRenamePreview(assets.slice(0, 2), assets, {
      template: 'shared.{extension}',
      date: '20260618'
    });

    expect(preview.map((item) => item.nextName)).toEqual(['shared.MP4', 'shared_2.MP4']);
    expect(preview[1].conflictSuffix).toBe(2);
  });

  it('replaces only the basename when creating disk rename paths', () => {
    expect(replaceMediaPathBasename('C:/Media/Scene One.MP4', 'renamed.mp4')).toBe('C:/Media/renamed.mp4');
    expect(replaceMediaPathBasename('D:\\Media\\Scene One.MP4', 'renamed.mp4')).toBe('D:\\Media\\renamed.mp4');
    expect(replaceMediaPathBasename('Scene One.MP4', 'renamed.mp4')).toBe('renamed.mp4');
  });

  it('collects first non-empty export metadata in media order', () => {
    const project = {
      media: [asset, { ...asset, id: 'asset-b', name: 'b.mp4' }],
      mediaMetadata: {
        'asset-a': { title: 'Scene title', description: 'A roll' },
        'asset-b': { title: 'Other title', author: 'Ada' }
      }
    };

    expect(collectExportMediaMetadata(project)).toEqual({ title: 'Scene title', author: 'Ada', description: 'A roll' });
    expect(collectExportMediaMetadata({ media: [asset], mediaMetadata: {} })).toBeUndefined();
  });
});

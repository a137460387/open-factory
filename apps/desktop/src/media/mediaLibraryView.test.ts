import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@open-factory/editor-core';
import { normalizeMediaLibraryViewSettings, sortMediaLibraryAssets } from './mediaLibraryView';

describe('media library view helpers', () => {
  it('sorts list view assets by name', () => {
    expect(
      sortMediaLibraryAssets([asset('b', 'Clip 10.mp4'), asset('a', 'Clip 2.mp4'), asset('c', 'alpha.wav')], {
        sortKey: 'name',
        sortDirection: 'asc',
      }).map((item) => item.id),
    ).toEqual(['c', 'a', 'b']);
  });

  it('sorts list view assets by duration', () => {
    expect(
      sortMediaLibraryAssets(
        [
          asset('long', 'Long.mov', { duration: 12 }),
          asset('short', 'Short.mov', { duration: 2 }),
          asset('mid', 'Mid.mov', { duration: 6 }),
        ],
        {
          sortKey: 'duration',
          sortDirection: 'desc',
        },
      ).map((item) => item.id),
    ).toEqual(['long', 'mid', 'short']);
  });

  it('sorts list view assets by file size', () => {
    expect(
      sortMediaLibraryAssets(
        [
          asset('small', 'Small.mov', { size: 2 }),
          asset('large', 'Large.mov', { size: 20 }),
          asset('missing', 'Missing.mov'),
        ],
        {
          sortKey: 'size',
          sortDirection: 'asc',
        },
      ).map((item) => item.id),
    ).toEqual(['missing', 'small', 'large']);
  });

  it('keeps import order for media with identical import timestamps', () => {
    const importedAt = '2026-06-15T00:00:00.000Z';
    expect(
      sortMediaLibraryAssets(
        [
          asset('video', 'tiny-video.mp4', { importedAt }),
          asset('audio', 'tiny-audio.wav', { importedAt }),
          asset('image', 'test-image.png', { importedAt }),
        ],
        { sortKey: 'importedAt', sortDirection: 'asc' },
      ).map((item) => item.id),
    ).toEqual(['video', 'audio', 'image']);
  });

  it('sorts list view assets by frame rate', () => {
    expect(
      sortMediaLibraryAssets(
        [
          asset('a', '24fps.mp4', { frameRate: 23.976 }),
          asset('b', '30fps.mp4', { frameRate: 29.97 }),
          asset('c', '60fps.mp4', { frameRate: 60 }),
        ],
        { sortKey: 'frameRate', sortDirection: 'asc' },
      ).map((i) => i.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('sorts list view assets by resolution', () => {
    expect(
      sortMediaLibraryAssets(
        [
          asset('a', '4k.mp4', { width: 3840, height: 2160 }),
          asset('b', '1080p.mp4', { width: 1920, height: 1080 }),
          asset('c', '720p.mp4', { width: 1280, height: 720 }),
        ],
        { sortKey: 'resolution', sortDirection: 'desc' },
      ).map((i) => i.id),
    ).toEqual(['a', 'b', 'c']);
  });

  it('sorts list view assets by codec', () => {
    expect(
      sortMediaLibraryAssets(
        [
          asset('a', 'h265.mp4', { videoCodec: 'hevc' }),
          asset('b', 'h264.mp4', { videoCodec: 'h264' }),
          asset('c', 'vp9.mp4', { videoCodec: 'vp9' }),
        ],
        { sortKey: 'codec', sortDirection: 'asc' },
      ).map((i) => i.id),
    ).toEqual(['b', 'a', 'c']);
  });

  it('normalizes persisted view state with compatible defaults', () => {
    expect(
      normalizeMediaLibraryViewSettings({ mode: 'list', gridSize: 'large', sortKey: 'duration', sortDirection: 'asc' }),
    ).toEqual({
      mode: 'list',
      gridSize: 'large',
      sortKey: 'duration',
      sortDirection: 'asc',
    });
    expect(normalizeMediaLibraryViewSettings({ sortKey: 'frameRate', sortDirection: 'desc' })).toEqual({
      mode: 'grid',
      gridSize: 'medium',
      sortKey: 'frameRate',
      sortDirection: 'desc',
    });
    expect(normalizeMediaLibraryViewSettings({ sortKey: 'resolution' })).toEqual({
      mode: 'grid',
      gridSize: 'medium',
      sortKey: 'resolution',
      sortDirection: 'asc',
    });
    expect(normalizeMediaLibraryViewSettings({ mode: 'invalid' as never, sortKey: 'bad' as never })).toEqual({
      mode: 'grid',
      gridSize: 'medium',
      sortKey: 'importedAt',
      sortDirection: 'asc',
    });
  });
});

function asset(id: string, name: string, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    name,
    type: overrides.type ?? 'video',
    path: `C:/Media/${name}`,
    duration: overrides.duration ?? 1,
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    size: overrides.size,
    importedAt: overrides.importedAt,
    mtimeMs: overrides.mtimeMs,
    frameRate: overrides.frameRate,
    videoCodec: overrides.videoCodec,
    audioCodec: overrides.audioCodec,
  };
}

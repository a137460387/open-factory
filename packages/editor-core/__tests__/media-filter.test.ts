import { describe, expect, it } from 'vitest';
import { filterMediaAssets, type MediaAsset } from '../src';

const media: MediaAsset[] = [
  makeAsset('video-1', 'video', 'Intro Shot.MP4'),
  makeAsset('audio-1', 'audio', 'voice-over.wav'),
  makeAsset('image-1', 'image', 'Poster Frame.png')
];

describe('media bin filtering', () => {
  it('filters by filename case-insensitively and returns all media for empty search', () => {
    expect(filterMediaAssets(media, { query: 'intro' }).map((asset) => asset.id)).toEqual(['video-1']);
    expect(filterMediaAssets(media, { query: 'VOICE' }).map((asset) => asset.id)).toEqual(['audio-1']);
    expect(filterMediaAssets(media, { query: '   ' }).map((asset) => asset.id)).toEqual(['video-1', 'audio-1', 'image-1']);
  });

  it('filters by asset type', () => {
    expect(filterMediaAssets(media, { filter: 'video' }).map((asset) => asset.id)).toEqual(['video-1']);
    expect(filterMediaAssets(media, { filter: 'audio' }).map((asset) => asset.id)).toEqual(['audio-1']);
    expect(filterMediaAssets(media, { filter: 'image' }).map((asset) => asset.id)).toEqual(['image-1']);
  });

  it('filters tagged media using project media metadata', () => {
    expect(filterMediaAssets(media, { filter: 'tagged', metadata: { 'image-1': { labelColor: 'purple' } } }).map((asset) => asset.id)).toEqual(['image-1']);
  });

  it('filters by rating and flag metadata while combining type filters', () => {
    const metadata = {
      'video-1': { rating: 5, flag: 'green' as const },
      'audio-1': { rating: 5, flag: 'red' as const },
      'image-1': { rating: 3 }
    };

    expect(filterMediaAssets(media, { metadataFilter: 'five-star', metadata }).map((asset) => asset.id)).toEqual(['video-1', 'audio-1']);
    expect(filterMediaAssets(media, { metadataFilter: 'selected', metadata }).map((asset) => asset.id)).toEqual(['video-1']);
    expect(filterMediaAssets(media, { filter: 'video', metadataFilter: 'five-star', metadata }).map((asset) => asset.id)).toEqual(['video-1']);
    expect(filterMediaAssets(media, { metadataFilter: 'rejected', metadata }).map((asset) => asset.id)).toEqual(['audio-1']);
  });
});

  it('filters by AI analysis tags', () => {
    const aiMedia = [
      makeAsset('video-1', 'video', 'Meeting.mp4'),
      makeAsset('video-2', 'video', 'Office.mp4'),
    ];
    aiMedia[0].aiAnalysis = { tags: ['室内', '办公'], scene: '办公室', mood: '专注', objects: ['桌子'], analysisTime: '', providerId: 'openai' };
    expect(filterMediaAssets(aiMedia, { query: '室内' }).map((a) => a.id)).toEqual(['video-1']);
    expect(filterMediaAssets(aiMedia, { query: '办公' }).map((a) => a.id)).toEqual(['video-1']);
    expect(filterMediaAssets(aiMedia, { query: 'xyz' }).map((a) => a.id)).toEqual([]);
  });

function makeAsset(id: string, type: MediaAsset['type'], name: string): MediaAsset {
  return {
    id,
    type,
    name,
    path: `C:/Media/${name}`,
    duration: type === 'image' ? 0 : 1,
    width: type === 'audio' ? 0 : 1280,
    height: type === 'audio' ? 0 : 720
  };
}

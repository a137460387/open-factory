import { describe, expect, it } from 'vitest';
import { sniffFileHeader, getFileExtension, classifyFileExtension } from '../src/media-file-sniff';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('media file header sniffing', () => {
  it('detects MP4 by ftyp magic bytes', () => {
    const result = sniffFileHeader(bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70), 'video.mp4');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MP4/MOV');
    expect(result.detectedCategory).toBe('video');
  });

  it('detects MOV by ftyp magic bytes', () => {
    const result = sniffFileHeader(bytes(0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74), 'clip.mov');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MP4/MOV');
  });

  it('detects WAV by RIFF+WAVE header', () => {
    const result = sniffFileHeader(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45), 'audio.wav');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('WAV');
    expect(result.detectedCategory).toBe('audio');
  });

  it('reports mismatch when extension says mp4 but content is WAV', () => {
    const result = sniffFileHeader(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45), 'fake.mp4');
    expect(result.status).toBe('mismatch');
    expect(result.detectedLabel).toBe('WAV');
    expect(result.expectedCategory).toBe('video');
    expect(result.detectedCategory).toBe('audio');
  });

  it('reports match when extension differs but expectedCategory matches detected category', () => {
    // WAV header with .wma extension: extension not in WAV rule extensions,
    // but .wma classifies as 'audio' which matches WAV rule's category
    const result = sniffFileHeader(bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45), 'clip.wma');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('WAV');
    expect(result.expectedCategory).toBe('audio');
    expect(result.detectedCategory).toBe('audio');
  });

  it('reports unknown for unrecognized headers', () => {
    const result = sniffFileHeader(bytes(0x00, 0x01, 0x02, 0x03), 'data.xyz');
    expect(result.status).toBe('unknown');
  });

  it('reports unknown for empty header', () => {
    const result = sniffFileHeader(new Uint8Array(0), 'video.mp4');
    expect(result.status).toBe('unknown');
    expect(result.expectedCategory).toBe('video');
  });

  it('detects MKV by EBML header', () => {
    const result = sniffFileHeader(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00), 'video.mkv');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MKV/WebM');
  });

  it('detects PNG by signature', () => {
    const result = sniffFileHeader(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'photo.png');
    expect(result.status).toBe('match');
    expect(result.detectedCategory).toBe('image');
  });

  it('getExtension returns lowercase dot-prefixed extension', () => {
    expect(getFileExtension('video.MP4')).toBe('.mp4');
    expect(getFileExtension('noext')).toBe('');
    expect(getFileExtension('.gitignore')).toBe('.gitignore');
  });

  it('classifyFileExtension returns correct category', () => {
    expect(classifyFileExtension('.mp4')).toBe('video');
    expect(classifyFileExtension('.wav')).toBe('audio');
    expect(classifyFileExtension('.png')).toBe('image');
    expect(classifyFileExtension('.xyz')).toBeUndefined();
  });

  it('detects AVI by RIFF+AVI header', () => {
    const header = bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20);
    const result = sniffFileHeader(header, 'clip.avi');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('AVI');
    expect(result.detectedCategory).toBe('video');
  });

  it('detects MPEG-TS by sync byte 0x47', () => {
    const result = sniffFileHeader(bytes(0x47, 0x40, 0x00, 0x10), 'recording.ts');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MPEG-TS');
    expect(result.detectedCategory).toBe('video');
  });

  it('detects MP3 by ID3v2 tag', () => {
    const result = sniffFileHeader(bytes(0x49, 0x44, 0x33, 0x04, 0x00), 'song.mp3');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MP3');
    expect(result.detectedCategory).toBe('audio');
  });

  it('detects MP3 by MPEG sync word', () => {
    const result = sniffFileHeader(bytes(0xff, 0xfb, 0x90, 0x00), 'track.mp3');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('MP3');
  });

  it('detects FLAC by fLaC magic bytes', () => {
    const result = sniffFileHeader(bytes(0x66, 0x4c, 0x61, 0x43, 0x00, 0x00), 'lossless.flac');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('FLAC');
    expect(result.detectedCategory).toBe('audio');
  });

  it('detects OGG by OggS magic bytes', () => {
    const result = sniffFileHeader(bytes(0x4f, 0x67, 0x67, 0x53, 0x00), 'podcast.ogg');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('OGG');
    expect(result.detectedCategory).toBe('audio');
  });

  it('detects JPEG by FF D8 FF marker', () => {
    const result = sniffFileHeader(bytes(0xff, 0xd8, 0xff, 0xe0), 'photo.jpg');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('JPEG');
    expect(result.detectedCategory).toBe('image');
  });

  it('detects WebP by RIFF+WEBP header', () => {
    const header = bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
    const result = sniffFileHeader(header, 'image.webp');
    expect(result.status).toBe('match');
    expect(result.detectedLabel).toBe('WebP');
    expect(result.detectedCategory).toBe('image');
  });
});

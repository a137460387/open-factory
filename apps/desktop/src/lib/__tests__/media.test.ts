import { describe, expect, it, vi } from 'vitest';
import {
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  inferAssetType,
  detectPngSequences,
} from '../media';

vi.mock('../lib/tauri', () => ({
  extensionFromPath: (path: string) => {
    const match = /\.(\w+)$/.exec(path);
    return match ? match[1].toLowerCase() : '';
  },
  fileNameFromPath: (path: string) => path.split('/').pop() ?? path,
  isTauriRuntime: () => false,
}));

describe('media', () => {
  describe('constants', () => {
    it('VIDEO_EXTENSIONS contains expected extensions', () => {
      expect(VIDEO_EXTENSIONS).toContain('mp4');
      expect(VIDEO_EXTENSIONS).toContain('mov');
      expect(VIDEO_EXTENSIONS).toContain('webm');
    });

    it('AUDIO_EXTENSIONS contains expected extensions', () => {
      expect(AUDIO_EXTENSIONS).toContain('mp3');
      expect(AUDIO_EXTENSIONS).toContain('wav');
    });

    it('IMAGE_EXTENSIONS contains expected extensions', () => {
      expect(IMAGE_EXTENSIONS).toContain('png');
      expect(IMAGE_EXTENSIONS).toContain('jpg');
    });
  });

  describe('inferAssetType', () => {
    it('returns video for mp4', () => {
      expect(inferAssetType('clip.mp4')).toBe('video');
    });

    it('returns video for mov', () => {
      expect(inferAssetType('clip.mov')).toBe('video');
    });

    it('returns audio for mp3', () => {
      expect(inferAssetType('song.mp3')).toBe('audio');
    });

    it('returns audio for wav', () => {
      expect(inferAssetType('sound.wav')).toBe('audio');
    });

    it('returns image for png', () => {
      expect(inferAssetType('photo.png')).toBe('image');
    });

    it('returns image for jpg', () => {
      expect(inferAssetType('photo.jpg')).toBe('image');
    });

    it('returns undefined for unknown extension', () => {
      expect(inferAssetType('file.xyz')).toBeUndefined();
    });

    it('returns undefined for no extension', () => {
      expect(inferAssetType('noext')).toBeUndefined();
    });

    it('handles paths with directories', () => {
      expect(inferAssetType('/path/to/video.mp4')).toBe('video');
    });
  });

  describe('detectPngSequences', () => {
    it('detects contiguous PNG sequence', () => {
      const paths = [
        '/frames/frame001.png',
        '/frames/frame002.png',
        '/frames/frame003.png',
      ];
      const sequences = detectPngSequences(paths, 24);
      expect(sequences).toHaveLength(1);
      expect(sequences[0].frameCount).toBe(3);
      expect(sequences[0].frameRate).toBe(24);
      expect(sequences[0].startNumber).toBe(1);
    });

    it('ignores non-PNG files', () => {
      const paths = ['/frames/frame001.jpg', '/frames/frame002.jpg'];
      const sequences = detectPngSequences(paths);
      expect(sequences).toHaveLength(0);
    });

    it('ignores single PNG files', () => {
      const paths = ['/frames/frame001.png'];
      const sequences = detectPngSequences(paths);
      expect(sequences).toHaveLength(0);
    });

    it('ignores non-contiguous sequences', () => {
      const paths = [
        '/frames/frame001.png',
        '/frames/frame003.png', // gap
      ];
      const sequences = detectPngSequences(paths);
      expect(sequences).toHaveLength(0);
    });

    it('uses default 30fps', () => {
      const paths = ['/f/img01.png', '/f/img02.png'];
      const sequences = detectPngSequences(paths);
      expect(sequences[0]?.frameRate).toBe(30);
    });
  });
});

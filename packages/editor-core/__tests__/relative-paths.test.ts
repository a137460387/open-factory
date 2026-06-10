import { describe, expect, it } from 'vitest';
import { dirname, isAbsolutePath, isCrossDrivePath, joinPath, makeRelativePath, normalizePath, resolveMediaPath } from '../src';

describe('relative path helpers', () => {
  it('normalizes Windows paths to project JSON friendly paths', () => {
    expect(normalizePath('d:\\Projects\\Cut\\media\\clip.mp4')).toBe('D:/Projects/Cut/media/clip.mp4');
    expect(normalizePath('  //server//share///clip.mp4//  ')).toBe('//server/share/clip.mp4');
  });

  it('builds relative paths on the same Windows drive', () => {
    expect(makeRelativePath('D:/Projects/Media/clip.mp4', 'D:/Projects/open-factory/project.cutproj.json')).toBe('../Media/clip.mp4');
  });

  it('returns null for cross-drive Windows paths', () => {
    expect(makeRelativePath('E:/Media/clip.mp4', 'D:/Projects/open-factory/project.cutproj.json')).toBeNull();
  });

  it('resolves relative media paths from project location', () => {
    expect(resolveMediaPath({ path: 'D:/fallback.mp4', relativePath: '../Media/clip.mp4' }, 'D:/Projects/open-factory/project.cutproj.json')).toBe('D:/Projects/Media/clip.mp4');
    expect(resolveMediaPath({ path: 'D:/fallback.mp4', relativePath: 'E:/Media/clip.mp4' }, 'D:/Projects/open-factory/project.cutproj.json')).toBe('E:/Media/clip.mp4');
    expect(resolveMediaPath({ path: 'D:/fallback.mp4', relativePath: '../Media/clip.mp4' })).toBe('D:/fallback.mp4');
  });

  it('handles POSIX joins, dirname, and absolutes', () => {
    expect(dirname('/Users/me/project.cutproj.json')).toBe('/Users/me');
    expect(dirname('D:/clip.mp4')).toBe('D:/');
    expect(dirname('clip.mp4')).toBe('.');
    expect(joinPath('/Users/me/project', '../media/a.mp4')).toBe('/Users/me/media/a.mp4');
    expect(joinPath('D:/Projects/open-factory', './media/../clip.mp4')).toBe('D:/Projects/open-factory/clip.mp4');
    expect(isAbsolutePath('/Users/me/a.mp4')).toBe(true);
    expect(isAbsolutePath('media/a.mp4')).toBe(false);
    expect(isCrossDrivePath('D:/a.mp4', 'E:/b.cutproj.json')).toBe(true);
    expect(isCrossDrivePath('/media/a.mp4', '/projects/b.cutproj.json')).toBe(false);
  });
});

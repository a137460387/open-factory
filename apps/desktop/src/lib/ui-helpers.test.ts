import { describe, it, expect } from 'vitest';
import { joinLocalPath } from '../ui-helpers';

describe('ui-helpers', () => {
  describe('joinLocalPath', () => {
    it('joins base and child with forward slashes', () => {
      expect(joinLocalPath('/home/user', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('normalizes backslashes to forward slashes', () => {
      expect(joinLocalPath('C:\\Users\\test', 'file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('removes trailing slashes from base', () => {
      expect(joinLocalPath('/home/user/', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('removes multiple trailing slashes', () => {
      expect(joinLocalPath('/home/user///', 'file.txt')).toBe('/home/user/file.txt');
    });

    it('handles root path', () => {
      expect(joinLocalPath('/', 'file.txt')).toBe('//file.txt');
    });

    it('handles empty child', () => {
      expect(joinLocalPath('/home/user', '')).toBe('/home/user/');
    });
  });
});

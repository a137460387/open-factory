import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from '../src/utils/file-utils';

describe('sanitizeFileName', () => {
  it('replaces invalid characters and trims whitespace', () => {
    expect(sanitizeFileName('hello<world>')).toBe('hello-world-');
    expect(sanitizeFileName('  valid name  ')).toBe('valid name');
  });

  it('returns fallback for empty result', () => {
    expect(sanitizeFileName('')).toBe('open-factory');
    expect(sanitizeFileName('   ')).toBe('open-factory');
  });
});


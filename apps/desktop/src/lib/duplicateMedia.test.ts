import { describe, expect, it } from 'vitest';
import { hashMediaHeadBytes } from './duplicateMedia';

describe('duplicate media hashing', () => {
  it('hashes only the first 4KB of media bytes', () => {
    const first = new Uint8Array(4097);
    const second = new Uint8Array(4097);
    first[4096] = 17;
    second[4096] = 91;

    expect(hashMediaHeadBytes(first)).toBe(hashMediaHeadBytes(second));
  });

  it('changes when the first 4KB changes', () => {
    const first = new Uint8Array(4096);
    const second = new Uint8Array(4096);
    first[128] = 17;
    second[128] = 91;

    expect(hashMediaHeadBytes(first)).not.toBe(hashMediaHeadBytes(second));
  });
});

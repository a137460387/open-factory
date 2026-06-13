import { describe, expect, it } from 'vitest';
import { EXPORT_ICC_PROFILE_BASE64, getExportIccProfileBase64 } from '../src';

describe('export color management', () => {
  it('ships decodable built-in ICC profile data with ICC signatures', () => {
    const profiles = Object.values(EXPORT_ICC_PROFILE_BASE64).map((profile) => Buffer.from(profile, 'base64'));

    expect(profiles).toHaveLength(3);
    expect(new Set(profiles.map((profile) => profile.toString('base64'))).size).toBe(3);
    for (const profile of profiles) {
      expect(profile.length).toBeGreaterThanOrEqual(132);
      expect(profile.readUInt32BE(0)).toBe(profile.length);
      expect(profile.subarray(36, 40).toString('ascii')).toBe('acsp');
    }
    expect(getExportIccProfileBase64('dci-p3')).toBe(EXPORT_ICC_PROFILE_BASE64['dci-p3']);
    expect(getExportIccProfileBase64('rec2020')).toBe(EXPORT_ICC_PROFILE_BASE64.rec2020);
    expect(getExportIccProfileBase64('rec709')).toBe(EXPORT_ICC_PROFILE_BASE64.srgb);
  });
});

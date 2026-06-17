import { describe, expect, it } from 'vitest';
import {
  EXPORT_ICC_PROFILE_BASE64,
  buildExportColorTagArgs,
  buildIccMetadataArgs,
  buildZscaleColorConversionFilter,
  getExportIccProfileBase64,
  parseFfprobeColorProfile
} from '../src';

describe('export color management', () => {
  it('ships decodable built-in ICC profile data with ICC signatures', () => {
    const profiles = Object.values(EXPORT_ICC_PROFILE_BASE64).map((profile) => Buffer.from(profile, 'base64'));

    expect(profiles).toHaveLength(4);
    expect(new Set(profiles.map((profile) => profile.toString('base64'))).size).toBe(4);
    for (const profile of profiles) {
      expect(profile.length).toBeGreaterThanOrEqual(132);
      expect(profile.readUInt32BE(0)).toBe(profile.length);
      expect(profile.subarray(36, 40).toString('ascii')).toBe('acsp');
    }
    expect(getExportIccProfileBase64('dci-p3')).toBe(EXPORT_ICC_PROFILE_BASE64['dci-p3']);
    expect(getExportIccProfileBase64('display-p3')).toBe(EXPORT_ICC_PROFILE_BASE64['display-p3']);
    expect(getExportIccProfileBase64('rec2020')).toBe(EXPORT_ICC_PROFILE_BASE64.rec2020);
    expect(getExportIccProfileBase64('rec709')).toBe(EXPORT_ICC_PROFILE_BASE64.srgb);
  });

  it('parses ffprobe color fields into display labels', () => {
    expect(parseFfprobeColorProfile({ colorPrimaries: 'bt709', colorTransfer: 'bt709', colorSpace: 'bt709' })).toMatchObject({
      sourceColorSpace: 'rec709',
      label: 'Rec.709'
    });
    expect(parseFfprobeColorProfile({ colorPrimaries: 'smpte432', colorTransfer: 'iec61966-2-1', colorSpace: 'bt709' })).toMatchObject({
      sourceColorSpace: 'display-p3',
      label: 'Display P3'
    });
    expect(parseFfprobeColorProfile({ colorPrimaries: 'bt2020', colorTransfer: 'smpte2084', colorSpace: 'bt2020nc' })).toMatchObject({
      sourceColorSpace: 'rec2020',
      label: 'Rec.2020'
    });
    expect(parseFfprobeColorProfile({})).toBeUndefined();
  });

  it.each([
    ['srgb', 'rec709', 'transferin=iec61966-2-1', 'transfer=bt709'],
    ['rec709', 'rec2020', 'primariesin=bt709', 'primaries=bt2020'],
    ['display-p3', 'rec709', 'primariesin=smpte432', 'transfer=bt709'],
    ['dci-p3', 'srgb', 'transferin=bt709', 'transfer=iec61966-2-1']
  ] as const)('builds zscale conversion args for %s to %s', (input, output, expectedInput, expectedOutput) => {
    const filter = buildZscaleColorConversionFilter(input, output);

    expect(filter).toContain('zscale=');
    expect(filter).toContain(expectedInput);
    expect(filter).toContain(expectedOutput);
  });

  it('builds output color tags and ICC metadata args', () => {
    expect(buildExportColorTagArgs('display-p3')).toEqual(['-color_primaries', 'smpte432', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709']);
    expect(buildIccMetadataArgs('display-p3')).toEqual(['-metadata:s:v:0', `icc_profile=${EXPORT_ICC_PROFILE_BASE64['display-p3']}`]);
  });
});

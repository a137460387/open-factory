import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UPDATE_ENDPOINT,
  getEffectiveUpdaterEndpoint,
  isValidUpdaterEndpointUrl,
  normalizeUpdateSettings,
  shouldPersistUpdateSettings
} from './update-settings';

describe('update settings', () => {
  it('validates updater endpoint URL formats', () => {
    expect(isValidUpdaterEndpointUrl('https://github.com/open-factory/open-factory/releases/latest/download/latest.json')).toBe(true);
    expect(isValidUpdaterEndpointUrl('http://updates.intranet/open-factory/latest.json')).toBe(true);
    expect(isValidUpdaterEndpointUrl('file:///tmp/latest.json')).toBe(false);
    expect(isValidUpdaterEndpointUrl('javascript:alert(1)')).toBe(false);
  });

  it('normalizes custom enterprise endpoint URLs', () => {
    const settings = normalizeUpdateSettings({
      autoCheckEnabled: true,
      customEndpoint: ' https://updates.example.test/open-factory/latest.json '
    });

    expect(settings).toEqual({
      autoCheckEnabled: true,
      customEndpoint: 'https://updates.example.test/open-factory/latest.json'
    });
    expect(getEffectiveUpdaterEndpoint(settings)).toBe('https://updates.example.test/open-factory/latest.json');
  });

  it('falls back to the default GitHub Releases endpoint', () => {
    const settings = normalizeUpdateSettings({ customEndpoint: 'not a url' });

    expect(settings).toEqual({ autoCheckEnabled: true });
    expect(getEffectiveUpdaterEndpoint(settings)).toBe(DEFAULT_UPDATE_ENDPOINT);
    expect(shouldPersistUpdateSettings(settings)).toBe(false);
    expect(shouldPersistUpdateSettings({ autoCheckEnabled: false })).toBe(true);
  });
});

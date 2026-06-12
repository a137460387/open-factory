import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage, t, zhCN } from './strings';

describe('i18n strings', () => {
  afterEach(() => {
    setLanguage('zh');
  });

  it('returns existing keys for the active language', () => {
    setLanguage('zh');
    expect(t('toolbar.fileMenu')).toBe('文件');

    setLanguage('en');
    expect(t('toolbar.fileMenu')).toBe('File');
  });

  it('returns the key when a translation is missing', () => {
    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });

  it('switches language for function translations and the compatibility object', () => {
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(zhCN.settings.title).toBe('Settings');
    expect(t<(index: number) => string>('timeline.markerLabel')(2)).toBe('Marker 2');

    setLanguage('zh');
    expect(zhCN.settings.title).toBe('设置');
    expect(t<(index: number) => string>('timeline.markerLabel')(2)).toBe('标记 2');
  });
});

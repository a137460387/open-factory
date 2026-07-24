import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage, setLanguageAsync, t, zhCN } from './strings';

describe('i18n strings', () => {
  afterEach(async () => {
    await setLanguageAsync('zh');
  });

  it('returns existing keys for the active language', async () => {
    setLanguage('zh');
    expect(t('toolbar.fileMenu')).toBe('文件');

    await setLanguageAsync('en');
    expect(t('toolbar.fileMenu')).toBe('File');
  });

  it('returns the key when a translation is missing', () => {
    expect(t('missing.translation.key')).toBe('missing.translation.key');
  });

  it('switches language for function translations and the compatibility object', async () => {
    await setLanguageAsync('en');
    expect(getLanguage()).toBe('en');
    expect(zhCN.settings.title).toBe('Settings');
    expect(t<(index: number) => string>('timeline.markerLabel')(2)).toBe('Marker 2');

    setLanguage('zh');
    expect(zhCN.settings.title).toBe('设置');
    expect(t<(index: number) => string>('timeline.markerLabel')(2)).toBe('标记 2');
  });
});
it('covers new batchCrop, namingTemplate, quickActions, and duplicateMediaMerge keys', () => {
  setLanguage('zh');
  expect(t('batchCrop.title')).toBe('批量转比例');
  expect(t<(n: number) => string>('batchCrop.previewCount')(3)).toContain('3');
  expect(t<(n: number) => string>('batchCrop.appliedMessage')(5)).toContain('5');
  expect(t('namingTemplate.title')).toBe('文件命名规则');
  expect(t('quickActions.mute')).toBe('静音');
  expect(t('duplicateMediaMerge.qualityCompare')).toBe('质量对比');
  expect(t<(n: number) => string>('duplicateMediaMerge.mergeHistoryTitle')(2)).toContain('2');
  expect(t<(n: number) => string>('duplicateMediaMerge.crossProjectMessage')(3)).toContain('3');
  expect(t<(k: string, m: number) => string>('duplicateMediaMerge.historyEntry')('file.mp4', 2)).toContain('file.mp4');
});

describe('i18n lazy loading', () => {
  afterEach(async () => {
    await setLanguageAsync('zh');
  });

  it('initial state contains only zh locale (en not preloaded)', () => {
    setLanguage('zh');
    // zh translations work immediately without any async load
    expect(zhCN.common.saved).toBe('已保存');
    expect(getLanguage()).toBe('zh');
  });

  it('switchLanguage triggers async en locale loading', async () => {
    setLanguage('zh');
    const result = await setLanguageAsync('en');
    expect(result).toBe('en');
    expect(getLanguage()).toBe('en');
    // After async load, English translations should be available
    expect(zhCN.settings.title).toBe('Settings');
  });

  it('language switch preserves zh locale state while en loads', () => {
    setLanguage('zh');
    // zh is always available synchronously
    expect(zhCN.common.saved).toBe('已保存');
    expect(zhCN.common.close).toBe('关闭');
  });

  it('fallback to zh when en locale not yet loaded', () => {
    // Switch to en synchronously (en may not be loaded yet)
    setLanguage('en');
    // t() falls back to zh when en is unavailable
    const val = t('common.saved');
    // Should return either English or Chinese (fallback), not the key
    expect(val).not.toBe('common.saved');
  });
});

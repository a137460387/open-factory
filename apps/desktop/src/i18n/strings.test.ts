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

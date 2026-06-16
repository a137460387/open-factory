import { describe, expect, it } from 'vitest';
import { formatReportDuration, normalizeReportLocale, reportHtmlLang, reportLanguageLabel } from '../src';

describe('report i18n helpers', () => {
  it('formats report durations for Chinese and English locales', () => {
    expect(formatReportDuration(65, 'zh')).toBe('1分钟5秒');
    expect(formatReportDuration(65, 'en')).toBe('01:05');
  });

  it('normalizes report locales and HTML language metadata', () => {
    expect(normalizeReportLocale('en-US')).toBe('en');
    expect(normalizeReportLocale('zh-CN')).toBe('zh');
    expect(reportHtmlLang('en')).toBe('en');
    expect(reportHtmlLang('zh')).toBe('zh-CN');
    expect(reportLanguageLabel('en')).toBe('English');
    expect(reportLanguageLabel('zh')).toBe('中文');
  });
});

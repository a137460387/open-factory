export type ReportLocale = 'zh' | 'en';

export function normalizeReportLocale(locale: string | undefined): ReportLocale {
  return locale?.trim().toLowerCase().startsWith('en') ? 'en' : 'zh';
}

export function reportHtmlLang(locale: ReportLocale): string {
  return locale === 'en' ? 'en' : 'zh-CN';
}

export function reportLanguageLabel(locale: ReportLocale): string {
  return locale === 'en' ? 'English' : '中文';
}

export function formatReportDuration(seconds: number, locale: ReportLocale): string {
  const totalSeconds = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (locale === 'en') {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}分钟${remainingSeconds}秒`;
}

export function formatReportNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

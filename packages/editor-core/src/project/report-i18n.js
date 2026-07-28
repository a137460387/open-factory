export function normalizeReportLocale(locale) {
    return locale?.trim().toLowerCase().startsWith('en') ? 'en' : 'zh';
}
export function reportHtmlLang(locale) {
    return locale === 'en' ? 'en' : 'zh-CN';
}
export function reportLanguageLabel(locale) {
    return locale === 'en' ? 'English' : '中文';
}
export function formatReportDuration(seconds, locale) {
    const totalSeconds = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (locale === 'en') {
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}分钟${remainingSeconds}秒`;
}
export function formatReportNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
//# sourceMappingURL=report-i18n.js.map
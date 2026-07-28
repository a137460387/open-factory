export type ReportLocale = 'zh' | 'en';
export declare function normalizeReportLocale(locale: string | undefined): ReportLocale;
export declare function reportHtmlLang(locale: ReportLocale): string;
export declare function reportLanguageLabel(locale: ReportLocale): string;
export declare function formatReportDuration(seconds: number, locale: ReportLocale): string;
export declare function formatReportNumber(value: number): string;
//# sourceMappingURL=report-i18n.d.ts.map
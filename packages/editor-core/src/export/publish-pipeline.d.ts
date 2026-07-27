import type { ExportPublishNodeLog, ExportPublishNodeStatus, ExportPublishNodeType } from './publish-types';
export type { ExportPublishNodeLog, ExportPublishNodeStatus, ExportPublishNodeType };
export type ExportPublishPlatform = 'youtube' | 'bilibili' | 'douyin';
export interface ExportPublishOutputInfo {
    file: string;
    duration: number;
    size: number;
    project: string;
    exportedAt: string;
}
export interface ExportPublishSmtpSettings {
    host: string;
    port: number;
    username?: string;
    passwordKey?: string;
    from: string;
    to: string[];
    subject?: string;
    secure?: boolean;
}
export interface ExportPublishWebhookSettings {
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
}
export interface ExportPublishWindow {
    daysOfWeek: number[];
    startHour: number;
    endHour: number;
    timezoneOffsetMinutes?: number;
}
/** 发布日志记录接口已移至 publish-types.ts 并在此处重新导出 */
export interface ExportPublishPipelineReport {
    logs: ExportPublishNodeLog[];
    warnings: string[];
}
export declare function buildSmtpExportEmailHtml(info: ExportPublishOutputInfo): string;
export declare function buildWebhookExportCompleteBody(info: ExportPublishOutputInfo): Record<string, string | number>;
export declare function isWithinPublishWindow(date: Date, window: ExportPublishWindow): boolean;
export declare function buildPublishNodeLog(input: {
    nodeId: string;
    nodeType: ExportPublishNodeType;
    status: ExportPublishNodeStatus;
    startedAt: string;
    finishedAt: string;
    message: string;
}): ExportPublishNodeLog;
export declare function appendPublishLogsToReleaseRecord<T extends {
    publishLogs?: ExportPublishNodeLog[];
}>(record: T, logs: ExportPublishNodeLog[]): T;
export declare function normalizePublishPlatform(value: unknown): ExportPublishPlatform;
export declare function normalizePublishWindow(input: Partial<ExportPublishWindow> | undefined): ExportPublishWindow | undefined;
export declare function normalizeSmtpSettings(input: Partial<ExportPublishSmtpSettings> | undefined): ExportPublishSmtpSettings | undefined;
export declare function normalizeWebhookSettings(input: Partial<ExportPublishWebhookSettings> | undefined): ExportPublishWebhookSettings | undefined;
//# sourceMappingURL=publish-pipeline.d.ts.map
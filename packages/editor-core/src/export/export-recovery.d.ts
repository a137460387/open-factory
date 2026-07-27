import type { ExportRecoveryAction, ExportRecoveryErrorKind, ExportRecoveryLogEntry, ExportRecoveryReport, FfmpegExportPlan } from './export-types';
export declare const MAX_EXPORT_RECOVERY_ATTEMPTS = 3;
export interface ExportRecoveryDecision {
    errorKind: ExportRecoveryErrorKind;
    action: ExportRecoveryAction;
    canRetry: boolean;
    message: string;
    plan?: FfmpegExportPlan;
}
export declare function classifyExportError(error: string): ExportRecoveryErrorKind;
export declare function buildExportRecoveryDecision(plan: FfmpegExportPlan, error: string, attempts: number): ExportRecoveryDecision;
export declare function appendExportRecoveryLog(entries: ExportRecoveryLogEntry[], decision: ExportRecoveryDecision, originalError: string, result?: ExportRecoveryLogEntry['result']): ExportRecoveryLogEntry[];
export declare function finalizeExportRecoveryLog(entries: ExportRecoveryLogEntry[], result: ExportRecoveryLogEntry['result']): ExportRecoveryLogEntry[];
export declare function buildExportRecoveryReport(entries: ExportRecoveryLogEntry[], healed: boolean): ExportRecoveryReport | undefined;
export declare function hasEnoughDiskSpace(availableBytes: number, expectedBytes: number, reserveBytes?: number): boolean;
export declare function fallbackExportCodecPlan(plan: FfmpegExportPlan): FfmpegExportPlan;
export declare function stripDrawtextFromExportPlan(plan: FfmpegExportPlan): FfmpegExportPlan;
//# sourceMappingURL=export-recovery.d.ts.map
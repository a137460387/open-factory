/** 合规判定级别 */
export type ComplianceLevel = 'pass' | 'warn' | 'fail';
/** 单项检查结果 */
export interface ComplianceCheckResult {
    name: string;
    level: ComplianceLevel;
    message: string;
    /** 可自动修复的操作 */
    autoFix?: ComplianceAutoFix;
}
/** 自动修复操作 */
export interface ComplianceAutoFix {
    type: 'loudness' | 'codec-suggest' | 'duration-notify';
    /** 修复参数 */
    params: Record<string, unknown>;
    /** 用户确认描述 */
    confirmMessage?: string;
}
/** 广播规格定义 */
export interface BroadcastSpec {
    id: string;
    name: string;
    description: string;
    videoCodec?: string[];
    videoCodecProfile?: string;
    videoBitrateMinMbps?: number;
    videoBitrateMaxMbps?: number;
    width?: number;
    height?: number;
    aspectRatio?: string;
    fps?: number;
    fpsTolerance?: number;
    audioCodec?: string[];
    audioBitrateMinKbps?: number;
    audioChannels?: number;
    loudnessTargetLufs?: number;
    loudnessToleranceLu?: number;
    truePeakMaxDbtp?: number;
    maxDurationSec?: number;
    subtitleFormat?: string;
    colorSpace?: string;
}
/** 导出参数快照（用于合规检查） */
export interface ExportComplianceParams {
    videoCodec?: string;
    videoProfile?: string;
    videoBitrateMbps?: number;
    width?: number;
    height?: number;
    fps?: number;
    audioCodec?: string;
    audioBitrateKbps?: number;
    audioChannels?: number;
    loudnessLufs?: number;
    truePeakDbtp?: number;
    durationSec?: number;
    subtitleFormat?: string;
    colorSpace?: string;
}
/** 一键修复结果 */
export interface ComplianceFixResult {
    loudnorm?: {
        enabled: boolean;
        targetLufs: number;
    };
    codecSuggestion?: string;
    durationOverflowSec?: number;
}
export declare const BUILTIN_BROADCAST_SPECS: readonly BroadcastSpec[];
/**
 * 获取所有内置规格 ID 列表。
 */
export declare function getBuiltinSpecIds(): string[];
/**
 * 根据 ID 获取内置规格。
 */
export declare function getBuiltinSpec(id: string): BroadcastSpec | undefined;
/**
 * 对导出参数执行完整合规检查。
 */
export declare function checkCompliance(spec: BroadcastSpec, params: ExportComplianceParams): ComplianceCheckResult[];
/**
 * 从合规检查结果中提取一键修复建议。
 */
export declare function buildComplianceFix(spec: BroadcastSpec, results: ComplianceCheckResult[]): ComplianceFixResult;
/**
 * 计算时长超出限制的秒数（0 表示未超出）。
 */
export declare function calculateDurationOverflowSec(duration: number, maxDuration: number): number;
//# sourceMappingURL=broadcast-compliance.d.ts.map
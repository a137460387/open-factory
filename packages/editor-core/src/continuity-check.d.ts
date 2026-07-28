export type FacingDirection = 'left' | 'right' | 'center' | 'unknown';
export type ContinuityWarningType = 'axis_jump' | 'jump_cut';
/** 主体边界框 */
export interface SubjectBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** 单帧AI分析结果 */
export interface ClipFrameAnalysis {
    clipId: string;
    subjectBox: SubjectBox;
    facingDirection: FacingDirection;
    sceneTag?: string;
    /** clip时长（秒） */
    duration: number;
}
/** 连续性警告 */
export interface ContinuityWarning {
    clipAId: string;
    clipBId: string;
    type: ContinuityWarningType;
    confidence: number;
    reason: string;
}
/** 阈值常量 */
export declare const JUMP_CUT_CENTER_DIFF_THRESHOLD = 0.05;
export declare const JUMP_CUT_DURATION_DIFF_THRESHOLD = 0.5;
/**
 * 判定facingDirection是否构成跳轴
 * left↔right突变且没有经过center过渡
 */
export declare function isAxisJump(dirA: FacingDirection, dirB: FacingDirection): boolean;
/**
 * 计算SubjectBox中心点距离
 */
export declare function subjectBoxCenterDistance(boxA: SubjectBox, boxB: SubjectBox): number;
/**
 * 判定是否为跳切（构图几乎不变的硬切）
 */
export declare function isJumpCut(boxA: SubjectBox, boxB: SubjectBox, durationA: number, durationB: number): boolean;
/**
 * 解析Vision AI返回的分析结果
 */
export declare function parseAIAnalysisResponse(response: unknown): {
    clipA: ClipFrameAnalysis;
    clipB: ClipFrameAnalysis;
} | null;
/**
 * 对一对相邻clip分析连续性
 */
export declare function checkContinuity(analysisA: ClipFrameAnalysis, analysisB: ClipFrameAnalysis): ContinuityWarning[];
/**
 * 批量检测时间线相邻clip对
 */
export declare function checkTimelineContinuity(analyses: ClipFrameAnalysis[]): ContinuityWarning[];
//# sourceMappingURL=continuity-check.d.ts.map
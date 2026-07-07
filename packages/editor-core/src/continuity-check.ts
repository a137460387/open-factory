export type FacingDirection = 'left' | 'right' | 'center' | 'unknown';
export type ContinuityWarningType = 'axis_jump' | 'jump_cut';

/** 主体边界框 */
export interface SubjectBox {
  x: number;      // 0-1 归一化
  y: number;      // 0-1 归一化
  width: number;  // 0-1
  height: number; // 0-1
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
export const JUMP_CUT_CENTER_DIFF_THRESHOLD = 0.05; // 5%画面宽度
export const JUMP_CUT_DURATION_DIFF_THRESHOLD = 0.5; // 0.5秒

/**
 * 判定facingDirection是否构成跳轴
 * left↔right突变且没有经过center过渡
 */
export function isAxisJump(dirA: FacingDirection, dirB: FacingDirection): boolean {
  if (dirA === 'unknown' || dirB === 'unknown') return false;
  if (dirA === 'center' || dirB === 'center') return false;
  return (dirA === 'left' && dirB === 'right') || (dirA === 'right' && dirB === 'left');
}

/**
 * 计算SubjectBox中心点距离
 */
export function subjectBoxCenterDistance(boxA: SubjectBox, boxB: SubjectBox): number {
  const cxA = boxA.x + boxA.width / 2;
  const cxB = boxB.x + boxB.width / 2;
  return Math.abs(cxA - cxB);
}

/**
 * 判定是否为跳切（构图几乎不变的硬切）
 */
export function isJumpCut(
  boxA: SubjectBox,
  boxB: SubjectBox,
  durationA: number,
  durationB: number
): boolean {
  const centerDiff = subjectBoxCenterDistance(boxA, boxB);
  const durationDiff = Math.abs(durationA - durationB);
  return centerDiff < JUMP_CUT_CENTER_DIFF_THRESHOLD && durationDiff < JUMP_CUT_DURATION_DIFF_THRESHOLD;
}

/**
 * 解析Vision AI返回的分析结果
 */
export function parseAIAnalysisResponse(
  response: unknown
): { clipA: ClipFrameAnalysis; clipB: ClipFrameAnalysis } | null {
  if (!response || typeof response !== 'object') return null;
  const obj = response as Record<string, unknown>;
  if (!obj.clipA || !obj.clipB) return null;

  const clipA = obj.clipA as Record<string, unknown>;
  const clipB = obj.clipB as Record<string, unknown>;

  const validDirs: FacingDirection[] = ['left', 'right', 'center', 'unknown'];

  const parseOne = (data: Record<string, unknown>, clipId: string): ClipFrameAnalysis | null => {
    if (!data.subjectBox || typeof data.subjectBox !== 'object') return null;
    const box = data.subjectBox as Record<string, unknown>;
    if (typeof box.x !== 'number' || typeof box.y !== 'number') return null;
    if (typeof box.width !== 'number' || typeof box.height !== 'number') return null;

    const dir = typeof data.facingDirection === 'string' && validDirs.includes(data.facingDirection as FacingDirection)
      ? data.facingDirection as FacingDirection
      : 'unknown';

    return {
      clipId,
      subjectBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      facingDirection: dir,
      sceneTag: typeof data.sceneTag === 'string' ? data.sceneTag : undefined,
      duration: typeof data.duration === 'number' ? data.duration : 0,
    };
  };

  const a = parseOne(clipA, typeof clipA.clipId === 'string' ? clipA.clipId : 'clipA');
  const b = parseOne(clipB, typeof clipB.clipId === 'string' ? clipB.clipId : 'clipB');
  if (!a || !b) return null;
  return { clipA: a, clipB: b };
}

/**
 * 对一对相邻clip分析连续性
 */
export function checkContinuity(
  analysisA: ClipFrameAnalysis,
  analysisB: ClipFrameAnalysis
): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = [];
  const sameScene = analysisA.sceneTag && analysisA.sceneTag === analysisB.sceneTag;

  // 跳轴检测（仅限同场景）
  if (sameScene && isAxisJump(analysisA.facingDirection, analysisB.facingDirection)) {
    warnings.push({
      clipAId: analysisA.clipId,
      clipBId: analysisB.clipId,
      type: 'axis_jump',
      confidence: 0.85,
      reason: `同场景内朝向从${analysisA.facingDirection}突变为${analysisB.facingDirection}`,
    });
  }

  // 跳切检测
  if (isJumpCut(analysisA.subjectBox, analysisB.subjectBox, analysisA.duration, analysisB.duration)) {
    warnings.push({
      clipAId: analysisA.clipId,
      clipBId: analysisB.clipId,
      type: 'jump_cut',
      confidence: 0.80,
      reason: '构图几乎不变的硬切',
    });
  }

  return warnings;
}

/**
 * 批量检测时间线相邻clip对
 */
export function checkTimelineContinuity(
  analyses: ClipFrameAnalysis[]
): ContinuityWarning[] {
  const warnings: ContinuityWarning[] = [];
  for (let i = 0; i < analyses.length - 1; i++) {
    warnings.push(...checkContinuity(analyses[i], analyses[i + 1]));
  }
  return warnings;
}

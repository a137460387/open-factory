/** 阈值常量 */
export const JUMP_CUT_CENTER_DIFF_THRESHOLD = 0.05; // 5%画面宽度
export const JUMP_CUT_DURATION_DIFF_THRESHOLD = 0.5; // 0.5秒
/**
 * 判定facingDirection是否构成跳轴
 * left↔right突变且没有经过center过渡
 */
export function isAxisJump(dirA, dirB) {
    if (dirA === 'unknown' || dirB === 'unknown')
        return false;
    if (dirA === 'center' || dirB === 'center')
        return false;
    return (dirA === 'left' && dirB === 'right') || (dirA === 'right' && dirB === 'left');
}
/**
 * 计算SubjectBox中心点距离
 */
export function subjectBoxCenterDistance(boxA, boxB) {
    const cxA = boxA.x + boxA.width / 2;
    const cxB = boxB.x + boxB.width / 2;
    return Math.abs(cxA - cxB);
}
/**
 * 判定是否为跳切（构图几乎不变的硬切）
 */
export function isJumpCut(boxA, boxB, durationA, durationB) {
    const centerDiff = subjectBoxCenterDistance(boxA, boxB);
    const durationDiff = Math.abs(durationA - durationB);
    return centerDiff < JUMP_CUT_CENTER_DIFF_THRESHOLD && durationDiff < JUMP_CUT_DURATION_DIFF_THRESHOLD;
}
/**
 * 解析Vision AI返回的分析结果
 */
export function parseAIAnalysisResponse(response) {
    if (!response || typeof response !== 'object')
        return null;
    const obj = response;
    if (!obj.clipA || !obj.clipB)
        return null;
    const clipA = obj.clipA;
    const clipB = obj.clipB;
    const validDirs = ['left', 'right', 'center', 'unknown'];
    const parseOne = (data, clipId) => {
        if (!data.subjectBox || typeof data.subjectBox !== 'object')
            return null;
        const box = data.subjectBox;
        if (typeof box.x !== 'number' || typeof box.y !== 'number')
            return null;
        if (typeof box.width !== 'number' || typeof box.height !== 'number')
            return null;
        const dir = typeof data.facingDirection === 'string' && validDirs.includes(data.facingDirection)
            ? data.facingDirection
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
    if (!a || !b)
        return null;
    return { clipA: a, clipB: b };
}
/**
 * 对一对相邻clip分析连续性
 */
export function checkContinuity(analysisA, analysisB) {
    const warnings = [];
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
            confidence: 0.8,
            reason: '构图几乎不变的硬切',
        });
    }
    return warnings;
}
/**
 * 批量检测时间线相邻clip对
 */
export function checkTimelineContinuity(analyses) {
    const warnings = [];
    for (let i = 0; i < analyses.length - 1; i++) {
        warnings.push(...checkContinuity(analyses[i], analyses[i + 1]));
    }
    return warnings;
}
//# sourceMappingURL=continuity-check.js.map
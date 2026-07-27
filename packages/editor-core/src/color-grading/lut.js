// packages/editor-core/src/color-grading/lut.ts
/** 创建 LUT 图层 */
export function createColorGradingLUTLayer(lutId) {
    return {
        id: `lut-layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lutId,
        intensity: 1,
        enabled: true,
    };
}
/** 验证 LUT 数据 */
export function validateLUTData(data) {
    if (data.size < 2 || data.size > 256)
        return false;
    const expectedLength = data.size * data.size * data.size * 3;
    if (data.data.length !== expectedLength)
        return false;
    if (data.domainMin.some((v) => v < -10 || v > 10))
        return false;
    if (data.domainMax.some((v) => v < -10 || v > 10))
        return false;
    return true;
}
/** 归一化 LUT 图层 */
export function normalizeColorGradingLUTLayer(layer) {
    if (!layer || typeof layer !== 'object')
        return null;
    const l = layer;
    if (typeof l.lutId !== 'string')
        return null;
    return {
        id: typeof l.id === 'string' ? l.id : `lut-layer-${Date.now()}`,
        lutId: l.lutId,
        intensity: typeof l.intensity === 'number' ? Math.max(0, Math.min(1, l.intensity)) : 1,
        enabled: l.enabled !== false,
    };
}
//# sourceMappingURL=lut.js.map
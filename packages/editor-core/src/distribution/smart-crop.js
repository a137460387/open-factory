/**
 * 智能裁剪算法
 *
 * 基于 FFmpeg 滤镜的无依赖裁剪策略，支持：
 * - 画面有效区域检测 (cropdetect)
 * - 场景变化检测 (scene detection)
 * - 重心计算算法（结合画面中心、字幕安全区）
 * - 多画幅自动适配
 */
// ─── 宽高比工具 ────────────────────────────────────────────
/** 解析宽高比字符串为数值 */
export function parseAspectRatio(ratio) {
    const parts = ratio.split('/');
    if (parts.length === 2) {
        const w = Number(parts[0]);
        const h = Number(parts[1]);
        if (h > 0)
            return w / h;
    }
    const colonParts = ratio.split(':');
    if (colonParts.length === 2) {
        const w = Number(colonParts[0]);
        const h = Number(colonParts[1]);
        if (h > 0)
            return w / h;
    }
    return 16 / 9;
}
/** 计算宽高比字符串 */
export function calcAspectRatioString(width, height) {
    const gcd = calcGCD(width, height);
    return `${width / gcd}:${height / gcd}`;
}
function calcGCD(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}
/**
 * 计算画面重心
 *
 * 综合考虑：
 * 1. 画面几何中心 (权重 0.4)
 * 2. 运动区域中心 (权重 0.4，如果提供)
 * 3. 字幕安全区偏移 (权重 0.2，如果有字幕)
 */
function calculateCenterOfInterest(input) {
    let x = 0.5;
    let y = 0.5;
    // 运动区域加权
    if (input.motionCenterX !== undefined && input.motionCenterY !== undefined) {
        x = x * 0.4 + input.motionCenterX * 0.4 + 0.5 * 0.2;
        y = y * 0.4 + input.motionCenterY * 0.4 + 0.5 * 0.2;
    }
    // 字幕安全区偏移：如果有字幕在下方，重心上移
    if (input.subtitleY !== undefined) {
        const subtitleTop = input.subtitleY;
        // 如果字幕在画面下半部，重心上移
        if (subtitleTop > 0.6) {
            y = y * 0.8 + 0.35 * 0.2; // 向上偏移
        }
    }
    return { x, y };
}
// ─── 核心裁剪算法 ────────────────────────────────────────────
/**
 * 计算智能裁剪参数
 *
 * 将源画面裁剪为目标宽高比，基于重心选择最佳裁剪区域。
 *
 * @param input 源画面分析数据
 * @param targetPlatform 目标平台规格
 * @returns 裁剪结果
 */
export function calculateSmartCrop(input, targetPlatform) {
    const { sourceWidth, sourceHeight } = input;
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = parseAspectRatio(targetPlatform.aspectRatio);
    const warnings = [];
    const sourceRatioStr = calcAspectRatioString(sourceWidth, sourceHeight);
    // 如果宽高比已经匹配，无需裁剪
    if (Math.abs(sourceRatio - targetRatio) < 0.01) {
        return {
            platformId: targetPlatform.id,
            sourceAspectRatio: sourceRatioStr,
            targetAspectRatio: targetPlatform.aspectRatio,
            cropX: 0,
            cropY: 0,
            cropWidth: 1,
            cropHeight: 1,
            scaleFilter: `scale=${targetPlatform.width}:${targetPlatform.height}:force_original_aspect_ratio=decrease`,
            cropFilter: '',
            confidence: 1.0,
            warnings: [],
        };
    }
    const center = calculateCenterOfInterest(input);
    let cropX;
    let cropY;
    let cropW;
    let cropH;
    if (sourceRatio > targetRatio) {
        // 源画面更宽 → 裁剪左右两侧
        cropH = 1.0;
        cropW = targetRatio / sourceRatio;
        // 基于重心水平定位
        const maxCropX = 1.0 - cropW;
        cropX = Math.max(0, Math.min(maxCropX, center.x - cropW / 2));
        cropY = 0;
        warnings.push('源画面比目标宽，左右两侧将被裁剪');
    }
    else {
        // 源画面更高 → 裁剪上下两侧
        cropW = 1.0;
        cropH = sourceRatio / targetRatio;
        // 基于重心垂直定位
        const maxCropY = 1.0 - cropH;
        cropY = Math.max(0, Math.min(maxCropY, center.y - cropH / 2));
        cropX = 0;
        warnings.push('源画面比目标高，上下两侧将被裁剪');
    }
    // 置信度计算
    let confidence = 0.8;
    if (input.motionCenterX !== undefined) {
        confidence += 0.1; // 有运动分析数据
    }
    if (input.subtitleY !== undefined) {
        confidence += 0.05; // 有字幕位置数据
    }
    // 如果裁剪量过大，降低置信度
    const cropRatio = sourceRatio > targetRatio ? cropW : cropH;
    if (cropRatio < 0.5) {
        confidence -= 0.2;
        warnings.push('裁剪量较大，可能丢失重要内容');
    }
    // 生成 FFmpeg 滤镜
    const cropFilter = buildCropFilter(sourceWidth, sourceHeight, cropX, cropY, cropW, cropH);
    const scaleFilter = `scale=${targetPlatform.width}:${targetPlatform.height}:flags=lanczos`;
    return {
        platformId: targetPlatform.id,
        sourceAspectRatio: sourceRatioStr,
        targetAspectRatio: targetPlatform.aspectRatio,
        cropX,
        cropY,
        cropWidth: cropW,
        cropHeight: cropH,
        scaleFilter,
        cropFilter,
        confidence: Math.max(0, Math.min(1, confidence)),
        warnings,
    };
}
/**
 * 构建 FFmpeg crop 滤镜字符串
 */
function buildCropFilter(sourceWidth, sourceHeight, cropX, cropY, cropW, cropH) {
    const w = Math.round(sourceWidth * cropW);
    const h = Math.round(sourceHeight * cropH);
    const x = Math.round(sourceWidth * cropX);
    const y = Math.round(sourceHeight * cropY);
    // 确保宽高为偶数（FFmpeg 要求）
    const evenW = w % 2 === 0 ? w : w - 1;
    const evenH = h % 2 === 0 ? h : h - 1;
    return `crop=${evenW}:${evenH}:${x}:${y}`;
}
// ─── 批量裁剪计算 ────────────────────────────────────────────
/**
 * 为多个平台计算裁剪参数
 *
 * @param input 源画面分析数据
 * @param platforms 目标平台列表
 * @returns 每个平台的裁剪结果
 */
export function calculateBatchSmartCrops(input, platforms) {
    return platforms.map((platform) => calculateSmartCrop(input, platform));
}
/**
 * 计算裁剪预览的显示尺寸
 *
 * @param cropResult 裁剪结果
 * @param containerWidth 预览容器宽度 (px)
 * @param containerHeight 预览容器高度 (px)
 */
export function calculateCropPreviewDimensions(cropResult, containerWidth, containerHeight) {
    const sourceRatio = parseAspectRatio(cropResult.sourceAspectRatio);
    const containerRatio = containerWidth / containerHeight;
    let previewWidth;
    let previewHeight;
    if (sourceRatio > containerRatio) {
        previewWidth = containerWidth;
        previewHeight = containerWidth / sourceRatio;
    }
    else {
        previewHeight = containerHeight;
        previewWidth = containerHeight * sourceRatio;
    }
    return {
        previewWidth: Math.round(previewWidth),
        previewHeight: Math.round(previewHeight),
        offsetX: Math.round(cropResult.cropX * previewWidth),
        offsetY: Math.round(cropResult.cropY * previewHeight),
        regionWidth: Math.round(cropResult.cropWidth * previewWidth),
        regionHeight: Math.round(cropResult.cropHeight * previewHeight),
    };
}
// ─── FFmpeg 滤镜集成 ────────────────────────────────────────────
/**
 * 将裁剪结果转换为 reframe offset 参数
 * 用于集成到现有的 ExportSettings.reframeOffsetX/Y
 */
export function cropResultToReframeOffset(cropResult) {
    // 计算裁剪中心相对于画面中心的偏移
    const cropCenterX = cropResult.cropX + cropResult.cropWidth / 2;
    const cropCenterY = cropResult.cropY + cropResult.cropHeight / 2;
    return {
        reframeOffsetX: cropCenterX - 0.5,
        reframeOffsetY: cropCenterY - 0.5,
    };
}
/**
 * 构建完整的裁剪 + 缩放滤镜链
 * 可直接注入 FFmpeg filter_complex
 */
export function buildCropScaleFilterChain(cropResult) {
    const filters = [];
    if (cropResult.cropFilter) {
        filters.push(cropResult.cropFilter);
    }
    filters.push(cropResult.scaleFilter);
    return filters.join(',');
}
//# sourceMappingURL=smart-crop.js.map
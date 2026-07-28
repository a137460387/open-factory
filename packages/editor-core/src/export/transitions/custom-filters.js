/**
 * 自定义转场滤镜链生成 — 处理无法直接映射到 FFmpeg xfade 的高级转场。
 * @module transitions/custom-filters
 */
import { formatFfmpegSeconds } from '../ffmpeg-escape';
import { formatFfmpegNumber } from '../ffmpeg-builder/utils';
import { getTransitionDefinition } from './transition-registry';
/**
 * 为自定义转场生成 FFmpeg 滤镜链。
 * 对于非自定义转场返回 null。
 */
export function buildCustomTransitionFilters(options) {
    const { type, duration, offset, label, width, height } = options;
    const def = getTransitionDefinition(type);
    if (!def?.customBuilder) {
        return null;
    }
    const fromLabel = `${label}_from`;
    const toLabel = `${label}_to`;
    const outputLabel = `${label}_raw`;
    const durationArg = formatFfmpegSeconds(duration);
    const offsetArg = formatFfmpegSeconds(offset);
    switch (def.customBuilder) {
        case 'rotate':
            return buildRotateTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg);
        case 'motion-blur':
            return buildMotionBlurTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, options.fps);
        case 'shape':
            return buildShapeTransition(fromLabel, toLabel, outputLabel, type, durationArg, offsetArg);
        case 'light-leak':
            return buildLightLeakTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, width, height);
        case 'glitch':
            return buildGlitchTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg);
        case 'flip-h':
            return buildFlipTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, 'horizontal');
        case 'flip-v':
            return buildFlipTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, 'vertical');
        case 'cube-rotate':
            return buildCubeRotateTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg);
        case 'portal':
            return buildPortalTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, width, height);
        default:
            return null;
    }
}
/** 旋转转场：from 旋转 + fade 到 to */
function buildRotateTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg) {
    const rotatedLabel = `${fromLabel}_rotated`;
    return {
        filters: [
            `[${fromLabel}]rotate='PI/10*t/${durationArg}':ow=iw:oh=ih:c=black@0,format=rgba[${rotatedLabel}]`,
            `[${rotatedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 运动模糊擦除：双向运动模糊 + wipeleft */
function buildMotionBlurTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, fps) {
    const fromBlurLabel = `${fromLabel}_blur`;
    const toBlurLabel = `${toLabel}_blur`;
    return {
        filters: [
            `[${fromLabel}]minterpolate=fps=${formatFfmpegNumber(fps)},gblur=sigma=6:steps=2[${fromBlurLabel}]`,
            `[${toLabel}]minterpolate=fps=${formatFfmpegNumber(fps)},gblur=sigma=6:steps=2[${toBlurLabel}]`,
            `[${fromBlurLabel}][${toBlurLabel}]xfade=transition=wipeleft:duration=${durationArg}:offset=${offsetArg}[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 形状擦除：heart 或 star */
function buildShapeTransition(fromLabel, toLabel, outputLabel, type, durationArg, offsetArg) {
    const shapeLabel = `${toLabel}_shape`;
    const geqExpr = buildShapeGeqExpression(type);
    return {
        filters: [
            `[${toLabel}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${geqExpr}'[${shapeLabel}]`,
            `[${fromLabel}][${shapeLabel}]overlay=format=auto[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 形状 geq alpha 表达式 */
function buildShapeGeqExpression(type) {
    if (type === 'shape-star') {
        return 'if(lte(abs(X-W/2)/(W/2)+abs(Y-H/2)/(H/2),0.82),255,0)';
    }
    // heart
    return 'if(lte(pow((X-W/2)/(W/2),2)+pow((Y-H/2)/(H/2)-sqrt(abs((X-W/2)/(W/2))),2),1),255,0)';
}
/** 光线泄漏：dissolve + 白色光晕叠加 */
function buildLightLeakTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, width, height) {
    const baseLabel = `${outputLabel}_base`;
    const leakLabel = `${outputLabel}_leak`;
    return {
        filters: [
            `[${fromLabel}][${toLabel}]xfade=transition=dissolve:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
            `color=c=white:s=${width}x${height}:d=${durationArg},format=rgba,geq=r='255*exp(-pow(X/W-0.5,2)*8)':g='200*exp(-pow(X/W-0.5,2)*8)':b='100*exp(-pow(X/W-0.5,2)*8)':a='128*exp(-pow(X/W-0.5,2)*8)'[${leakLabel}]`,
            `[${baseLabel}][${leakLabel}]overlay=format=auto:shortest=1[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 故障风：pixelize + 色彩偏移 + 对比度增强 */
function buildGlitchTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg) {
    const baseLabel = `${outputLabel}_base`;
    return {
        filters: [
            `[${fromLabel}][${toLabel}]xfade=transition=pixelize:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
            `[${baseLabel}]rgbashift=rh=-5:bh=5:gh=0,eq=contrast=1.3:saturation=1.2[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 翻转转场：水平或垂直翻转 from + fade */
function buildFlipTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, direction) {
    const flipFilter = direction === 'horizontal' ? 'hflip' : 'vflip';
    const flippedLabel = `${fromLabel}_flipped`;
    return {
        filters: [
            `[${fromLabel}]${flipFilter}[${flippedLabel}]`,
            `[${flippedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 立方体旋转：旋转 + 缩放模拟 3D 效果 */
function buildCubeRotateTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg) {
    const rotatedLabel = `${fromLabel}_cube`;
    return {
        filters: [
            `[${fromLabel}]rotate='PI/4*t/${durationArg}':ow=iw:oh=ih:c=black@0,zoompan=z='1+0.2*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=iwxih,format=rgba[${rotatedLabel}]`,
            `[${rotatedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/** 门户转场：circleopen + 缩放脉冲 */
function buildPortalTransition(fromLabel, toLabel, outputLabel, durationArg, offsetArg, width, height) {
    const baseLabel = `${outputLabel}_base`;
    return {
        filters: [
            `[${fromLabel}][${toLabel}]xfade=transition=circleopen:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
            `[${baseLabel}]zoompan=z='1+0.03*sin(2*PI*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}[${outputLabel}]`,
        ],
        outputLabel,
    };
}
/**
 * 为预览生成形状 geq alpha 表达式（exported for preview-args.ts）。
 */
export function buildShapeGeqExpressionForPreview(type) {
    return buildShapeGeqExpression(type);
}
//# sourceMappingURL=custom-filters.js.map
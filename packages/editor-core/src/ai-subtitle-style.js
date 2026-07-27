import { identityTranslator } from './ai-module-types';
export const SUBTITLE_STYLE_LANDSCAPE_ONLY = ['news-lower-third'];
/**
 * Build video context for subtitle style AI analysis.
 */
export function buildSubtitleStyleVideoContext(videoMedia) {
    const width = videoMedia?.width ?? 1920;
    const height = videoMedia?.height ?? 1080;
    const isPortrait = height > width;
    const ai = videoMedia?.aiAnalysis;
    return {
        width,
        height,
        isPortrait,
        mediaTags: ai?.tags,
        scene: ai?.scene,
        mood: ai?.mood,
    };
}
export async function parseSubtitleStyleResponseSafe(json, t = identityTranslator) {
    try {
        const data = parseSubtitleStyleResponse(json);
        return { data, error: null };
    }
    catch {
        return { data: { recommended: [] }, error: t('aiModules.error.parseFailed') };
    }
}
/**
 * Filter out styles that are not suitable for portrait video.
 */
export function filterPortraitStyles(recommendations, isPortrait) {
    if (!isPortrait)
        return recommendations;
    return recommendations.filter((r) => !SUBTITLE_STYLE_LANDSCAPE_ONLY.includes(r.templateId));
}
export function buildSubtitleStyleSystemPrompt() {
    return '你是一个专业的视频字幕样式推荐助手。根据视频的基本信息（分辨率、方向、内容标签、场景、氛围），从内置字幕样式模板中推荐最合适的样式。\n\n内置样式模板ID：\n- news-lower-third：新闻下三分之一，适合新闻/信息类\n- cinema-white：电影白字，适合电影/纪录片\n- karaoke：卡拉OK，适合音乐/KTV\n- variety-bold：综艺综字，适合综艺节目/娱乐\n- documentary：纪录片，适合纪录片/教育\n- social-bold：社交媒体粗体，适合短视频/社交媒体\n- game-hud：游戏HUD，适合游戏/科技\n- hand-written：手写风，适合生活/情感类\n\n返回格式必须是JSON对象：\n{"recommended":[{"templateId":"样式ID","reason":"推荐原因","confidence":0~1}]}\n\n要求：\n1. 按confidence降序排列\n2. 最多返回3个推荐\n3. reason用中文简述推荐理由\n4. 竖版视频不要推荐news-lower-third（宽横条不适合竖版）\n5. confidence为0的不要返回';
}
export function buildSubtitleStyleUserPrompt(context) {
    const parts = [
        `视频分辨率：${context.width}x${context.height}`,
        `视频方向：${context.isPortrait ? '竖版' : '横版'}`,
    ];
    if (context.mediaTags && context.mediaTags.length > 0) {
        parts.push(`内容标签：${context.mediaTags.join(',')}`);
    }
    if (context.scene) {
        parts.push(`场景：${context.scene}`);
    }
    if (context.mood) {
        parts.push(`氛围：${context.mood}`);
    }
    parts.push('\n请推荐最合适的字幕样式模板，返回JSON。');
    return parts.join('\n');
}
export function parseSubtitleStyleResponse(json) {
    const empty = { recommended: [] };
    if (!json || typeof json !== 'object')
        return empty;
    const obj = json;
    if (!Array.isArray(obj.recommended))
        return empty;
    return {
        recommended: obj.recommended
            .filter((item) => item !== null &&
            typeof item === 'object' &&
            typeof item.templateId === 'string' &&
            typeof item.reason === 'string' &&
            typeof item.confidence === 'number' &&
            item.confidence > 0)
            .map((item) => ({
            templateId: item.templateId.trim(),
            reason: item.reason.trim(),
            confidence: Math.min(1, Math.max(0, item.confidence)),
        }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3),
    };
}
//# sourceMappingURL=ai-subtitle-style.js.map
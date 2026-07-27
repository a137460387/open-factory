/**
 * 序列化当前项目结构为模板文件（脱敏，不含真实媒体路径）。
 */
export function serializeProjectAsTemplate(project, description) {
    return {
        schemaVersion: 1,
        name: project.name,
        description,
        settings: { ...project.settings },
        tracks: project.timeline.tracks.map((track) => ({
            type: track.type,
            name: track.name,
            clipCount: track.clips.length,
            clipPlaceholders: track.clips.map((clip) => ({
                name: clip.name,
                start: clip.start,
                duration: clip.duration,
            })),
        })),
        createdAt: new Date().toISOString(),
    };
}
/**
 * 解析模板卡片 JSON。
 */
export function parseTemplateCards(json) {
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            return parsed.filter((card) => card &&
                typeof card.id === 'string' &&
                typeof card.name === 'string');
        }
        return [];
    }
    catch {
        return [];
    }
}
/**
 * 解析市场缓存。
 */
export function parseTemplateMarketCache(json) {
    try {
        const parsed = JSON.parse(json);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.templates)) {
            return {
                version: 1,
                lastFetched: parsed.lastFetched ?? new Date().toISOString(),
                templates: parseTemplateCards(JSON.stringify(parsed.templates)),
            };
        }
        return { version: 1, lastFetched: new Date().toISOString(), templates: [] };
    }
    catch {
        return { version: 1, lastFetched: new Date().toISOString(), templates: [] };
    }
}
/**
 * 序列化市场缓存。
 */
export function serializeTemplateMarketCache(cache) {
    return JSON.stringify(cache, null, 2) + '\n';
}
/**
 * 安装模板到本地列表。
 * 返回更新后的已安装模板 ID 列表。
 */
export function installTemplate(installedIds, templateId) {
    if (installedIds.includes(templateId)) {
        return {
            installedIds,
            result: { templateId, templateName: '', installed: false },
        };
    }
    return {
        installedIds: [...installedIds, templateId],
        result: { templateId, templateName: '', installed: true },
    };
}
/**
 * 检查模板是否已安装。
 */
export function isTemplateInstalled(installedIds, templateId) {
    return installedIds.includes(templateId);
}
/**
 * 网络不可用降级：返回本地缓存的模板列表。
 */
export function getOfflineTemplates(cache) {
    return cache.templates;
}
//# sourceMappingURL=template-sharing.js.map
export function buildStemOutputFileName(ctx) {
    const safeProject = sanitizeStemName(ctx.projectName || 'project');
    const safeStem = sanitizeStemName(ctx.stemName || `track-${ctx.trackIndex}`);
    return `${safeProject}_${safeStem}_${ctx.trackIndex}.${ctx.format}`;
}
function sanitizeStemName(name) {
    return name
        .replace(/[<>:"/\\|?*() ]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim();
}
//# sourceMappingURL=export-types.js.map
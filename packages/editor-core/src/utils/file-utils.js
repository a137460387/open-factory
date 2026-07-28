export function sanitizeFileName(value) {
    return value.replace(/[<>:"/\\\|?*\x00-\x1f]/g, '-').trim() || 'open-factory';
}
//# sourceMappingURL=file-utils.js.map
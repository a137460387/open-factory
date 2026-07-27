export function buildSmtpExportEmailHtml(info) {
    return [
        '<!doctype html>',
        '<html><body>',
        '<h1>Export complete</h1>',
        '<table>',
        row('File', info.file),
        row('Project', info.project),
        row('Duration', `${roundSeconds(info.duration)} s`),
        row('Size', `${Math.max(0, Math.round(info.size))} bytes`),
        row('Exported At', info.exportedAt),
        '</table>',
        '</body></html>',
    ].join('');
}
export function buildWebhookExportCompleteBody(info) {
    return {
        event: 'export_complete',
        file: info.file,
        duration: roundSeconds(info.duration),
        size: Math.max(0, Math.round(info.size)),
        project: info.project,
    };
}
export function isWithinPublishWindow(date, window) {
    const offsetMinutes = Number.isFinite(window.timezoneOffsetMinutes) ? window.timezoneOffsetMinutes : 0;
    const local = new Date(date.getTime() + offsetMinutes * 60 * 1000);
    const day = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
    const days = new Set(window.daysOfWeek.map((value) => Math.round(value)).filter((value) => value >= 1 && value <= 7));
    const startHour = clampHour(window.startHour);
    const endHour = clampHour(window.endHour);
    return days.has(day) && hour >= startHour && hour < endHour;
}
export function buildPublishNodeLog(input) {
    const startedMs = Date.parse(input.startedAt);
    const finishedMs = Date.parse(input.finishedAt);
    return {
        nodeId: input.nodeId,
        nodeType: input.nodeType,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        durationMs: Number.isFinite(startedMs) && Number.isFinite(finishedMs) ? Math.max(0, Math.round(finishedMs - startedMs)) : 0,
        message: input.message,
    };
}
export function appendPublishLogsToReleaseRecord(record, logs) {
    return {
        ...record,
        publishLogs: [...(record.publishLogs ?? []), ...logs.map((log) => ({ ...log }))],
    };
}
export function normalizePublishPlatform(value) {
    return value === 'bilibili' || value === 'douyin' ? value : 'youtube';
}
export function normalizePublishWindow(input) {
    if (!input) {
        return undefined;
    }
    const daysOfWeek = Array.isArray(input.daysOfWeek)
        ? input.daysOfWeek.map((value) => Math.round(value)).filter((value) => value >= 1 && value <= 7)
        : [];
    if (daysOfWeek.length === 0) {
        return undefined;
    }
    return {
        daysOfWeek,
        startHour: clampHour(input.startHour ?? 9),
        endHour: clampHour(input.endHour ?? 18),
        timezoneOffsetMinutes: Number.isFinite(input.timezoneOffsetMinutes)
            ? Math.round(input.timezoneOffsetMinutes)
            : undefined,
    };
}
export function normalizeSmtpSettings(input) {
    const host = normalizeText(input?.host);
    const from = normalizeText(input?.from);
    const to = Array.isArray(input?.to) ? input.to.map(normalizeText).filter(Boolean) : [];
    if (!host || !from || to.length === 0) {
        return undefined;
    }
    return {
        host,
        port: clampPort(input?.port ?? 587),
        username: normalizeText(input?.username) || undefined,
        passwordKey: normalizeText(input?.passwordKey) || undefined,
        from,
        to,
        subject: normalizeText(input?.subject) || undefined,
        secure: input?.secure === true,
    };
}
export function normalizeWebhookSettings(input) {
    const url = normalizeText(input?.url);
    if (!url) {
        return undefined;
    }
    const headers = {};
    for (const [key, value] of Object.entries(input?.headers ?? {})) {
        const header = normalizeText(key);
        const headerValue = normalizeText(value);
        if (header && headerValue) {
            headers[header] = headerValue;
        }
    }
    return {
        url,
        headers,
        timeoutMs: Math.max(1, Math.min(5000, Math.round(input?.timeoutMs ?? 5000))),
    };
}
function row(label, value) {
    return `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function roundSeconds(value) {
    return Number.isFinite(value) ? Math.max(0, Math.round(value * 1000) / 1000) : 0;
}
function clampHour(value) {
    return Math.max(0, Math.min(24, Number.isFinite(value) ? value : 0));
}
function clampPort(value) {
    return Math.max(1, Math.min(65535, Math.round(Number.isFinite(value) ? value : 587)));
}
function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
//# sourceMappingURL=publish-pipeline.js.map
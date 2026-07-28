export function expandVersionedExportVariables(template, variables, options = {}) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
        const value = variables[key];
        if (value === undefined) {
            return match;
        }
        return options.pathSafe ? sanitizePathToken(value) : value;
    });
}
export function mergeVersionedExportSettings(defaultSettings, presetSettings, version) {
    return {
        ...cloneSettings(defaultSettings),
        ...cloneSettings(presetSettings),
        ...cloneSettings(version.settings),
    };
}
export function createVersionedExportJobs(input) {
    return input.versions
        .filter((version) => version.enabled !== false)
        .map((version, index) => {
        const variables = buildVersionedVariables(version, index + 1);
        const template = version.outputPathTemplate?.trim() || input.outputPathTemplate;
        const presetSettings = version.presetId ? input.presetSettingsById?.get(version.presetId) : undefined;
        const settings = mergeVersionedExportSettings(input.defaultSettings, presetSettings, version);
        const metadata = buildVersionedMetadata({ ...input.metadata, ...version.metadata }, variables);
        return {
            batch: {
                batchId: input.batchId,
                versionId: version.id,
                versionName: version.name,
                ...(version.platform?.trim() ? { platform: version.platform.trim() } : {}),
                ...(version.language?.trim() ? { language: version.language.trim() } : {}),
            },
            outputPath: expandVersionedExportVariables(template, variables, { pathSafe: true }),
            range: version.range === undefined ? (input.defaultRange ?? null) : version.range,
            settings,
            metadata,
            presetId: version.presetId,
        };
    });
}
export function serializeVersionedBatchTemplate(name, outputPathTemplate, versions, exportedAt = new Date().toISOString()) {
    const payload = {
        version: 1,
        name: name.trim() || 'Versioned Batch Export',
        outputPathTemplate: outputPathTemplate.trim() || './{version_name}.mp4',
        versions: versions.map(sanitizeVersionDefinition),
        exportedAt,
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
}
export function parseVersionedBatchTemplate(contents) {
    const parsed = JSON.parse(contents);
    if (parsed.version !== 1 || !Array.isArray(parsed.versions)) {
        throw new Error('Unsupported versioned batch export template.');
    }
    return {
        version: 1,
        name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Versioned Batch Export',
        outputPathTemplate: typeof parsed.outputPathTemplate === 'string' && parsed.outputPathTemplate.trim()
            ? parsed.outputPathTemplate.trim()
            : './{version_name}.mp4',
        versions: parsed.versions.flatMap((version) => {
            if (!version || typeof version.id !== 'string' || typeof version.name !== 'string') {
                return [];
            }
            return [sanitizeVersionDefinition(version)];
        }),
        exportedAt: typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim()
            ? parsed.exportedAt.trim()
            : new Date(0).toISOString(),
    };
}
export function countRunningVersionedBatchTasks(tasks, batchId) {
    return tasks.filter((task) => task.versionedBatch?.batchId === batchId && task.status === 'running').length;
}
export function buildVersionedExportReportRows(tasks, options = {}) {
    return tasks
        .filter((task) => Boolean(task.versionedBatch) && (!options.batchId || task.versionedBatch?.batchId === options.batchId))
        .map((task) => {
        const metadata = task.versionedBatch;
        return {
            batchId: metadata.batchId,
            versionId: metadata.versionId,
            versionName: metadata.versionName,
            ...(metadata.platform ? { platform: metadata.platform } : {}),
            ...(metadata.language ? { language: metadata.language } : {}),
            outputPath: task.outputPath,
            status: task.status,
            fileSizeBytes: normalizeOptionalNumber(options.fileSizes?.[task.outputPath]),
            durationSeconds: normalizeOptionalNumber(task.plan.duration),
            elapsedMs: calculateElapsedMs(task.startedAt, task.finishedAt),
            width: normalizeOptionalNumber(task.plan.settings?.width),
            height: normalizeOptionalNumber(task.plan.settings?.height),
        };
    });
}
function buildVersionedVariables(version, index) {
    return {
        ...(version.variables ?? {}),
        version_name: version.name,
        platform: version.platform?.trim() ?? '',
        language: version.language?.trim() ?? '',
        index: String(index),
    };
}
function buildVersionedMetadata(template, variables) {
    if (!template) {
        return undefined;
    }
    const metadata = {};
    for (const key of ['title', 'author', 'description', 'copyright', 'date']) {
        const value = template[key];
        if (typeof value === 'string' && value.trim()) {
            metadata[key] = expandVersionedExportVariables(value, variables).trim();
        }
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}
function sanitizeVersionDefinition(version) {
    const sanitized = {
        id: version.id.trim() || `version-${Date.now()}`,
        name: version.name.trim() || 'Version',
        enabled: version.enabled !== false,
    };
    copyTrimmed(version, sanitized, 'presetId');
    copyTrimmed(version, sanitized, 'platform');
    copyTrimmed(version, sanitized, 'language');
    copyTrimmed(version, sanitized, 'outputPathTemplate');
    if (version.range !== undefined) {
        sanitized.range = version.range;
    }
    if (version.variables && typeof version.variables === 'object') {
        sanitized.variables = Object.fromEntries(Object.entries(version.variables)
            .filter(([key, value]) => key.trim() && typeof value === 'string')
            .map(([key, value]) => [key.trim(), value]));
    }
    if (version.settings && typeof version.settings === 'object') {
        sanitized.settings = cloneSettings(version.settings);
    }
    if (version.metadata && typeof version.metadata === 'object') {
        sanitized.metadata = sanitizeMetadataTemplate(version.metadata);
    }
    return sanitized;
}
function sanitizeMetadataTemplate(template) {
    const sanitized = {};
    for (const key of ['title', 'author', 'description', 'copyright', 'date']) {
        const value = template[key];
        if (typeof value === 'string' && value.trim()) {
            sanitized[key] = value.trim();
        }
    }
    return sanitized;
}
function cloneSettings(settings) {
    return settings ? { ...settings } : {};
}
function copyTrimmed(source, target, key) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
        target[key] = value.trim();
    }
}
function sanitizePathToken(value) {
    const sanitized = value
        .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '');
    return sanitized || 'version';
}
function normalizeOptionalNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function calculateElapsedMs(startedAt, finishedAt) {
    if (!startedAt || !finishedAt) {
        return null;
    }
    const start = Date.parse(startedAt);
    const finish = Date.parse(finishedAt);
    return Number.isFinite(start) && Number.isFinite(finish) && finish >= start ? finish - start : null;
}
//# sourceMappingURL=versioned-batch.js.map
/**
 * Plugin marketplace service.
 *
 * Provides catalog management, search/filter/sort, ratings, and
 * version compatibility checking for the plugin marketplace.
 */
// --- Validation ---
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const VALID_CATEGORIES = ['effect', 'export', 'workflow', 'ai-model'];
const VALID_PERMISSIONS = [
    'read-project',
    'write-project',
    'read-media',
    'export-hook',
    'menu-register',
    'timeline-mutation',
    'ai-inference',
    'network-access',
];
/**
 * Validate and normalize a raw market catalog entry.
 * Returns the normalized entry or undefined if invalid.
 */
export function normalizeMarketEntry(input) {
    const record = input && typeof input === 'object' ? input : {};
    const id = stringValue(record.id);
    const name = stringValue(record.name);
    const author = stringValue(record.author);
    const version = stringValue(record.version);
    const downloadUrl = stringValue(record.downloadUrl);
    const sha256 = normalizeSha256(stringValue(record.sha256));
    if (!id || !name || !author || !version || !downloadUrl || !sha256) {
        return undefined;
    }
    const category = normalizeCategory(record.category);
    if (!category) {
        return undefined;
    }
    return {
        id,
        name,
        author,
        version,
        description: stringValue(record.description),
        category,
        permissions: normalizePermissions(record.permissions),
        downloadUrl,
        sha256,
        tags: normalizeTags(record.tags),
        rating: normalizeRating(record.rating),
        downloads: normalizeDownloads(record.downloads),
        homepage: stringValue(record.homepage) || undefined,
        minAppVersion: stringValue(record.minAppVersion) || undefined,
        publishedAt: stringValue(record.publishedAt) || new Date().toISOString(),
        updatedAt: stringValue(record.updatedAt) || new Date().toISOString(),
        official: record.official === true,
    };
}
/**
 * Parse market catalog JSON into validated entries.
 */
export function parseMarketCatalogJson(contents) {
    const parsed = JSON.parse(contents);
    const rawEntries = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray(parsed.plugins)
            ? parsed.plugins
            : [];
    return rawEntries.flatMap((entry) => {
        const normalized = normalizeMarketEntry(entry);
        return normalized ? [normalized] : [];
    });
}
/**
 * Search and filter marketplace entries.
 */
export function searchMarketEntries(entries, options = {}) {
    let filtered = [...entries];
    // Text search
    if (options.query) {
        const query = options.query.toLowerCase();
        filtered = filtered.filter((entry) => entry.name.toLowerCase().includes(query) ||
            entry.description.toLowerCase().includes(query) ||
            entry.author.toLowerCase().includes(query) ||
            entry.tags.some((tag) => tag.toLowerCase().includes(query)));
    }
    // Category filter
    if (options.category && options.category !== 'all') {
        filtered = filtered.filter((entry) => entry.category === options.category);
    }
    // Tag filter
    if (options.tags && options.tags.length > 0) {
        const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
        filtered = filtered.filter((entry) => entry.tags.some((tag) => tagSet.has(tag.toLowerCase())));
    }
    // Official filter
    if (options.officialOnly) {
        filtered = filtered.filter((entry) => entry.official);
    }
    // Minimum rating filter
    if (options.minRating && options.minRating > 0) {
        filtered = filtered.filter((entry) => entry.rating.average >= options.minRating);
    }
    // Sort
    const sortBy = options.sortBy ?? 'downloads';
    const sortDir = options.sortDirection ?? 'desc';
    filtered.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
            case 'name':
                cmp = a.name.localeCompare(b.name);
                break;
            case 'rating':
                cmp = a.rating.average - b.rating.average;
                break;
            case 'downloads':
                cmp = a.downloads - b.downloads;
                break;
            case 'publishedAt':
                cmp = a.publishedAt.localeCompare(b.publishedAt);
                break;
            case 'updatedAt':
                cmp = a.updatedAt.localeCompare(b.updatedAt);
                break;
        }
        return sortDir === 'desc' ? -cmp : cmp;
    });
    // Build facet counts
    const categoryMap = new Map();
    const tagMap = new Map();
    for (const entry of entries) {
        categoryMap.set(entry.category, (categoryMap.get(entry.category) ?? 0) + 1);
        for (const tag of entry.tags) {
            tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
        }
    }
    return {
        entries: filtered,
        total: filtered.length,
        categories: Array.from(categoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count),
        tags: Array.from(tagMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20),
    };
}
/**
 * Check if a plugin version is compatible with the given app version.
 */
export function checkVersionCompatibility(pluginMinVersion, appVersion) {
    if (!pluginMinVersion) {
        return { compatible: true };
    }
    const cmp = compareSemver(appVersion, pluginMinVersion);
    if (cmp < 0) {
        return {
            compatible: false,
            reason: `插件要求 Open Factory ${pluginMinVersion} 或更高版本，当前版本 ${appVersion}`,
        };
    }
    return { compatible: true };
}
/**
 * Compare two semver strings.
 * Returns 1 if left > right, -1 if left < right, 0 if equal.
 */
export function compareSemver(left, right) {
    const leftParts = parseSemver(left);
    const rightParts = parseSemver(right);
    for (let index = 0; index < 3; index += 1) {
        const delta = leftParts[index] - rightParts[index];
        if (delta !== 0) {
            return delta > 0 ? 1 : -1;
        }
    }
    return 0;
}
/**
 * Calculate a weighted plugin score combining rating and download count.
 * Used for "hot" or "recommended" sorting.
 */
export function calculatePluginScore(entry) {
    const ratingWeight = 0.6;
    const downloadWeight = 0.4;
    const normalizedRating = entry.rating.average / 5;
    // Log-scale downloads to prevent mega-popular plugins from dominating
    const normalizedDownloads = entry.downloads > 0 ? Math.log10(entry.downloads + 1) / 6 : 0;
    return normalizedRating * ratingWeight + Math.min(normalizedDownloads, 1) * downloadWeight;
}
// --- Internal helpers ---
function stringValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeSha256(value) {
    const hash = value.toLowerCase();
    return SHA256_HEX_PATTERN.test(hash) ? hash : undefined;
}
function normalizeCategory(value) {
    if (typeof value === 'string' && VALID_CATEGORIES.includes(value)) {
        return value;
    }
    return undefined;
}
function normalizePermissions(input) {
    const permissions = Array.isArray(input) ? input : [];
    return permissions.filter((permission) => VALID_PERMISSIONS.includes(permission));
}
function normalizeTags(input) {
    if (!Array.isArray(input)) {
        return [];
    }
    return Array.from(new Set(input
        .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim().toLowerCase())));
}
function normalizeRating(input) {
    if (input && typeof input === 'object') {
        const record = input;
        const average = typeof record.average === 'number' ? Math.max(0, Math.min(5, record.average)) : 0;
        const count = typeof record.count === 'number' ? Math.max(0, Math.floor(record.count)) : 0;
        return { average, count };
    }
    return { average: 0, count: 0 };
}
function normalizeDownloads(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
function parseSemver(value) {
    const [major = '0', minor = '0', patch = '0'] = value.split(/[+-]/)[0].split('.');
    return [major, minor, patch].map((part) => {
        const parsed = Number.parseInt(part, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    });
}
//# sourceMappingURL=plugin-market-service.js.map
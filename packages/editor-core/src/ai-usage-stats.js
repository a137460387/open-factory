/** Built-in recommendation rules */
export const RECOMMENDATION_RULES = [
    {
        requiresFeature: 'subtitle-polish',
        recommendFeature: 'contextual-translation',
        reasonKey: 'recommendContextualTranslation',
    },
    { requiresFeature: 'rough-cut', recommendFeature: 'director-mode', reasonKey: 'recommendDirectorMode' },
    { requiresFeature: 'vision-analysis', recommendFeature: 'video-summary', reasonKey: 'recommendVideoSummary' },
    { requiresFeature: 'chapter-title', recommendFeature: 'narration-script', reasonKey: 'recommendNarrationScript' },
    { requiresFeature: 'chat-editor', recommendFeature: 'rough-cut', reasonKey: 'recommendRoughCut' },
    { requiresFeature: 'video-summary', recommendFeature: 'highlight-reel', reasonKey: 'recommendHighlightReel' },
    { requiresFeature: 'voiceover', recommendFeature: 'narration-script', reasonKey: 'recommendNarrationFromVoiceover' },
    {
        requiresFeature: 'color-grading-suggestion',
        recommendFeature: 'vision-analysis',
        reasonKey: 'recommendVisionAnalysis',
    },
    { requiresFeature: 'export-suggestion', recommendFeature: 'video-summary', reasonKey: 'recommendSummaryFromExport' },
    { requiresFeature: 'narration-script', recommendFeature: 'voiceover', reasonKey: 'recommendVoiceover' },
];
/** Aggregate usage records by provider */
export function aggregateByProvider(records) {
    const map = new Map();
    for (const r of records) {
        let entry = map.get(r.providerId);
        if (!entry) {
            entry = { providerId: r.providerId, callCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostCny: 0 };
            map.set(r.providerId, entry);
        }
        entry.callCount++;
        entry.totalInputTokens += r.inputTokens;
        entry.totalOutputTokens += r.outputTokens;
        entry.totalCostCny += r.estimatedCostCny;
    }
    return Array.from(map.values()).sort((a, b) => b.callCount - a.callCount);
}
/** Aggregate feature-level records by service */
export function aggregateByFeature(records) {
    const map = new Map();
    for (const r of records) {
        let entry = map.get(r.service);
        if (!entry) {
            entry = { service: r.service, callCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostCny: 0 };
            map.set(r.service, entry);
        }
        entry.callCount++;
        entry.totalInputTokens += r.inputTokens;
        entry.totalOutputTokens += r.outputTokens;
        entry.totalCostCny += r.estimatedCostCny;
    }
    return Array.from(map.values()).sort((a, b) => b.callCount - a.callCount);
}
/** Build daily usage trend for the last N days, filling gaps with zeros */
export function aggregateDailyTrend(records, days = 30, now) {
    const nowMs = now ?? Date.now();
    const result = [];
    // Build a date->index map for the last N days
    const dayMs = 86_400_000;
    const dateMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(nowMs - i * dayMs);
        const key = formatDate(d);
        dateMap.set(key, { callCount: 0, totalCostCny: 0 });
    }
    for (const r of records) {
        const key = formatDate(new Date(r.timestamp));
        const entry = dateMap.get(key);
        if (entry) {
            entry.callCount++;
            entry.totalCostCny += r.estimatedCostCny;
        }
    }
    for (const [date, data] of dateMap) {
        result.push({ date, callCount: data.callCount, totalCostCny: data.totalCostCny });
    }
    return result;
}
/** Generate recommendations based on used features (max 3) */
export function generateRecommendations(usedFeatures, maxRecommendations = 3) {
    const used = new Set(usedFeatures);
    const recommendations = [];
    for (const rule of RECOMMENDATION_RULES) {
        if (recommendations.length >= maxRecommendations)
            break;
        if (used.has(rule.requiresFeature) && !used.has(rule.recommendFeature)) {
            recommendations.push({ feature: rule.recommendFeature, reasonKey: rule.reasonKey });
            used.add(rule.recommendFeature); // avoid duplicate recommendations
        }
    }
    return recommendations;
}
/** Calculate total cost for the current calendar month */
export function calculateMonthlyCost(records, now) {
    const nowMs = now ?? Date.now();
    const d = new Date(nowMs);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    let total = 0;
    for (const r of records) {
        if (r.timestamp >= monthStart && r.timestamp <= nowMs) {
            total += r.estimatedCostCny;
        }
    }
    return total;
}
/** Check if monthly cost exceeds the user-set threshold */
export function checkCostAlert(records, thresholdCny, now) {
    if (thresholdCny <= 0)
        return false;
    return calculateMonthlyCost(records, now) > thresholdCny;
}
/** Get the set of unique features used from feature-level records */
export function getUsedFeatures(records) {
    return [...new Set(records.map((r) => r.service))];
}
function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
//# sourceMappingURL=ai-usage-stats.js.map
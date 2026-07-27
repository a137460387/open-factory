export function buildSubtitleTranslationBatches(cues, maxBatchSize = 50) {
    const batchSize = Number.isFinite(maxBatchSize) ? Math.max(1, Math.floor(maxBatchSize)) : 50;
    const batches = [];
    for (let index = 0; index < cues.length; index += batchSize) {
        batches.push({
            startIndex: index,
            cues: cues.slice(index, index + batchSize),
        });
    }
    return batches;
}
//# sourceMappingURL=translation.js.map
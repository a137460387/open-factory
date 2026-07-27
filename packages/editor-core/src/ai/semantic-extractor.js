/**
 * Local Semantic Extractor
 *
 * Extracts structured metadata from local media assets (video/audio)
 * without uploading any raw data. All processing happens locally.
 *
 * Pipeline:
 * 1. Key frame extraction (video → thumbnail frames)
 * 2. Low-res preview generation (for optional LLM upload)
 * 3. ASR transcription (audio → text segments)
 * 4. Visual scene description (local model)
 * 5. Aggregate into structured MaterialMetadata JSON
 *
 * Privacy: Raw video/audio streams NEVER leave the device.
 * Only text metadata and compressed low-res previews are uploadable.
 */
// ─── Default Config ─────────────────────────────────────────────
const DEFAULT_CONFIG = {
    maxKeyFrames: 20,
    intervalSec: 0,
    previewMaxWidth: 160,
    previewMaxHeight: 90,
    previewQuality: 30,
    enableASR: true,
    asrLanguage: 'auto',
    enableVisualAnalysis: true,
    sceneChangeThreshold: 0.3,
};
export function createDefaultExtractionConfig() {
    return { ...DEFAULT_CONFIG };
}
export function validateExtractionConfig(config) {
    const errors = [];
    if (config.maxKeyFrames !== undefined && (config.maxKeyFrames < 1 || config.maxKeyFrames > 200)) {
        errors.push({ field: 'maxKeyFrames', message: 'must be between 1 and 200' });
    }
    if (config.intervalSec !== undefined && config.intervalSec < 0) {
        errors.push({ field: 'intervalSec', message: 'must be non-negative' });
    }
    if (config.previewMaxWidth !== undefined && (config.previewMaxWidth < 32 || config.previewMaxWidth > 640)) {
        errors.push({ field: 'previewMaxWidth', message: 'must be between 32 and 640' });
    }
    if (config.previewMaxHeight !== undefined && (config.previewMaxHeight < 18 || config.previewMaxHeight > 360)) {
        errors.push({ field: 'previewMaxHeight', message: 'must be between 18 and 360' });
    }
    if (config.previewQuality !== undefined && (config.previewQuality < 1 || config.previewQuality > 100)) {
        errors.push({ field: 'previewQuality', message: 'must be between 1 and 100' });
    }
    if (config.sceneChangeThreshold !== undefined && (config.sceneChangeThreshold < 0 || config.sceneChangeThreshold > 1)) {
        errors.push({ field: 'sceneChangeThreshold', message: 'must be between 0 and 1' });
    }
    return errors;
}
// ─── Core Extraction Functions ──────────────────────────────────
/**
 * Calculate optimal key frame timestamps based on video duration.
 * Uses scene-change-aware interval selection.
 */
export function calculateKeyFrameTimestamps(durationSec, config) {
    if (durationSec <= 0)
        return [];
    const { maxKeyFrames, intervalSec } = config;
    if (intervalSec > 0) {
        const timestamps = [];
        for (let t = 0; t < durationSec && timestamps.length < maxKeyFrames; t += intervalSec) {
            timestamps.push(Math.round(t * 1000) / 1000);
        }
        return timestamps;
    }
    // Auto mode: distribute evenly, skip first/last 0.5s
    const safeStart = Math.min(0.5, durationSec * 0.02);
    const safeEnd = Math.max(durationSec - 0.5, durationSec * 0.98);
    const safeRange = safeEnd - safeStart;
    if (safeRange <= 0)
        return [0];
    const count = Math.min(maxKeyFrames, Math.max(1, Math.floor(durationSec / 2)));
    const step = safeRange / (count - 1 || 1);
    const timestamps = [];
    for (let i = 0; i < count; i++) {
        const t = safeStart + i * step;
        timestamps.push(Math.round(t * 1000) / 1000);
    }
    return timestamps;
}
/**
 * Calculate preview dimensions maintaining aspect ratio.
 * Returns dimensions that fit within maxWidth x maxHeight.
 */
export function calculatePreviewDimensions(srcWidth, srcHeight, maxWidth, maxHeight) {
    if (srcWidth <= 0 || srcHeight <= 0) {
        return { width: maxWidth, height: maxHeight };
    }
    const aspectRatio = srcWidth / srcHeight;
    const maxAspect = maxWidth / maxHeight;
    let width;
    let height;
    if (aspectRatio > maxAspect) {
        width = maxWidth;
        height = Math.round(maxWidth / aspectRatio);
    }
    else {
        height = maxHeight;
        width = Math.round(maxHeight * aspectRatio);
    }
    // Ensure even dimensions (required by many codecs)
    width = Math.max(2, width & ~1);
    height = Math.max(2, height & ~1);
    return { width, height };
}
/**
 * Merge ASR segments that are close together.
 * Segments within mergeGapSec of each other are combined.
 */
export function mergeASRSegments(segments, mergeGapSec, maxDurationSec) {
    if (segments.length === 0)
        return [];
    const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
    const merged = [];
    let current = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const gap = next.startSec - current.endSec;
        const mergedDuration = next.endSec - current.startSec;
        if (gap <= mergeGapSec && mergedDuration <= maxDurationSec) {
            current = {
                ...current,
                endSec: next.endSec,
                text: current.text + ' ' + next.text,
                confidence: Math.min(current.confidence, next.confidence),
            };
        }
        else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
}
/**
 * Detect language from ASR text using character range heuristics.
 */
export function detectLanguageFromASR(text) {
    if (!text || text.trim().length === 0)
        return 'unknown';
    const cjk = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
    const japanese = /[\u3040-\u309f\u30a0-\u30ff]/g;
    const korean = /[\uac00-\ud7af]/g;
    const cjkCount = (text.match(cjk) || []).length;
    const jpCount = (text.match(japanese) || []).length;
    const koCount = (text.match(korean) || []).length;
    const totalLen = text.replace(/\s/g, '').length;
    if (totalLen === 0)
        return 'unknown';
    if (jpCount / totalLen > 0.1)
        return 'ja';
    if (koCount / totalLen > 0.1)
        return 'ko';
    if (cjkCount / totalLen > 0.3)
        return 'zh';
    return 'en';
}
/**
 * Generate auto-tags from material metadata.
 * Extracts semantic tags from visual and audio analysis.
 */
export function generateAutoTags(visualProfile, audioProfile, asrSegments) {
    const tags = new Set();
    // Visual tags
    if (visualProfile.motionIntensity > 0.7)
        tags.add('high-motion');
    else if (visualProfile.motionIntensity < 0.2)
        tags.add('static');
    if (visualProfile.avgBrightness > 0.7)
        tags.add('bright');
    else if (visualProfile.avgBrightness < 0.3)
        tags.add('dark');
    if (visualProfile.faceCount > 0)
        tags.add('people');
    if (visualProfile.hasOverlay)
        tags.add('graphics');
    // Scene tags
    for (const [scene, ratio] of Object.entries(visualProfile.sceneDistribution)) {
        if (ratio > 0.3)
            tags.add(scene);
    }
    // Audio tags
    if (audioProfile.hasMusic)
        tags.add('music');
    if (audioProfile.speechRatio > 0.5)
        tags.add('speech');
    if (audioProfile.noiseLevel === 'noisy')
        tags.add('noisy');
    // Language tags from ASR
    const languages = new Set();
    for (const seg of asrSegments) {
        if (seg.language)
            languages.add(seg.language);
    }
    for (const lang of languages) {
        tags.add(`lang:${lang}`);
    }
    return [...tags].sort();
}
/**
 * Generate a text summary from ASR segments.
 * Concatenates all transcript text.
 */
export function buildTranscriptText(segments) {
    return segments.map(s => s.text.trim()).filter(Boolean).join(' ');
}
/**
 * Estimate the upload size of material metadata in bytes.
 * Only counts text and optional low-res previews.
 */
export function estimateMetadataUploadSize(metadata) {
    let size = JSON.stringify({
        ...metadata,
        keyFrames: metadata.keyFrames.map(kf => ({
            ...kf,
            lowResPreview: undefined,
        })),
    }).length;
    // Add base64 preview sizes
    for (const kf of metadata.keyFrames) {
        if (kf.lowResPreview) {
            size += kf.lowResPreview.length;
        }
    }
    return size;
}
/**
 * Build MaterialMetadata from extracted components.
 * This is the aggregation step that combines all local analysis results.
 */
export function aggregateMetadata(source, keyFrames, asrSegments, audioProfile, visualProfile, config) {
    const warnings = [];
    // Validate source info
    if (source.durationSec <= 0) {
        warnings.push('Source duration is zero or negative');
    }
    if (source.width <= 0 || source.height <= 0) {
        warnings.push('Source dimensions are invalid');
    }
    // Merge ASR segments
    const mergedASR = config.enableASR
        ? mergeASRSegments(asrSegments, 0.3, 30)
        : [];
    // Detect language
    const transcriptText = buildTranscriptText(mergedASR);
    const detectedLang = detectLanguageFromASR(transcriptText);
    // Enrich ASR with language
    const enrichedASR = mergedASR.map(seg => ({
        ...seg,
        language: seg.language ?? detectedLang,
    }));
    // Generate tags
    const tags = generateAutoTags(visualProfile, audioProfile, enrichedASR);
    const metadata = {
        version: '1.0',
        source,
        extractedAt: new Date().toISOString(),
        keyFrames,
        asrSegments: enrichedASR,
        transcriptText,
        audioProfile,
        visualProfile,
        tags,
    };
    return { metadata, warnings };
}
/**
 * Privacy check: validate that metadata contains no raw media data.
 * Returns true if safe to upload.
 */
export function validateMetadataPrivacy(metadata) {
    const violations = [];
    // Check key frames don't contain high-res images
    for (let i = 0; i < metadata.keyFrames.length; i++) {
        const kf = metadata.keyFrames[i];
        if (kf.previewWidth && kf.previewWidth > 640) {
            violations.push(`keyFrame[${i}].previewWidth exceeds 640px`);
        }
        if (kf.previewHeight && kf.previewHeight > 360) {
            violations.push(`keyFrame[${i}].previewHeight exceeds 360px`);
        }
        // Check base64 size (rough estimate: each char = 0.75 bytes)
        if (kf.lowResPreview && kf.lowResPreview.length > 50000) {
            violations.push(`keyFrame[${i}].lowResPreview exceeds 50KB`);
        }
    }
    return { safe: violations.length === 0, violations };
}
//# sourceMappingURL=semantic-extractor.js.map
import { getProjectSequences } from '../model';
import { getTimelinePlaybackDuration } from '../timeline';
import { isFrameRateMismatch } from '../vfr';
const GENERIC_FONT_FAMILIES = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'cursive',
    'fantasy',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
]);
const PLATFORM_DURATION_LIMIT_SECONDS = {
    'instagram-reels': 90,
    'twitter-x': 140,
};
export function runExportPreflight(project, options = {}) {
    const clips = collectReachableTimelineClips(project);
    const results = [];
    const missingMedia = collectMissingMedia(project, clips);
    if (missingMedia.items.length > 0) {
        results.push({
            id: 'missing-media',
            type: 'missing-media',
            severity: 'blocking',
            message: 'Missing media must be relinked before export.',
            items: missingMedia.items,
            clipIds: missingMedia.clipIds,
            mediaIds: missingMedia.mediaIds,
        });
    }
    const missingFonts = collectMissingFonts(clips, options.isFontFamilyAvailable);
    if (missingFonts.items.length > 0) {
        results.push({
            id: 'missing-font',
            type: 'missing-font',
            severity: 'warning',
            message: 'Some text clips use fonts that were not found on this system.',
            items: missingFonts.items,
            clipIds: missingFonts.clipIds,
        });
    }
    if (clips.some((clip) => clip.type === 'subtitle') && options.whisperReady === false) {
        results.push({
            id: 'whisper-path',
            type: 'whisper-path',
            severity: 'warning',
            message: options.whisperMessage ?? 'Whisper is not configured.',
            items: [options.whisperMessage ?? 'Whisper is not configured.'],
            clipIds: clips.filter((clip) => clip.type === 'subtitle').map((clip) => clip.id),
        });
    }
    if (options.ffmpegAvailable === false) {
        results.push({
            id: 'ffmpeg',
            type: 'ffmpeg',
            severity: 'blocking',
            message: 'FFmpeg was not found on PATH.',
            items: ['ffmpeg'],
        });
    }
    const platformDurationWarning = buildPlatformDurationWarning(project, options.platformPreset);
    if (platformDurationWarning) {
        results.push(platformDurationWarning);
    }
    const vfrWarning = collectVfrMedia(project, clips);
    if (vfrWarning.items.length > 0) {
        results.push({
            id: 'vfr-media',
            type: 'vfr-media',
            severity: 'warning',
            message: 'Timeline contains variable frame rate media.',
            items: vfrWarning.items,
            clipIds: vfrWarning.clipIds,
            mediaIds: vfrWarning.mediaIds,
        });
    }
    const frameRateWarning = collectFrameRateMismatchedMedia(project, clips);
    if (frameRateWarning.items.length > 0) {
        results.push({
            id: 'frame-rate-mismatch',
            type: 'frame-rate-mismatch',
            severity: 'warning',
            message: 'Timeline contains media with a frame rate that differs from the project.',
            items: frameRateWarning.items,
            clipIds: frameRateWarning.clipIds,
            mediaIds: frameRateWarning.mediaIds,
            projectFrameRate: project.settings.fps,
        });
    }
    return results;
}
export function getPlatformDurationLimitSeconds(platformPreset) {
    return platformPreset ? PLATFORM_DURATION_LIMIT_SECONDS[platformPreset] : undefined;
}
function buildPlatformDurationWarning(project, platformPreset) {
    const limitSeconds = getPlatformDurationLimitSeconds(platformPreset);
    if (!platformPreset || limitSeconds === undefined) {
        return undefined;
    }
    const durationSeconds = getTimelinePlaybackDuration(project.timeline);
    if (durationSeconds <= limitSeconds + 0.001) {
        return undefined;
    }
    return {
        id: `platform-duration-${platformPreset}`,
        type: 'platform-duration',
        severity: 'warning',
        message: 'Timeline duration exceeds the selected platform recommendation.',
        items: [],
        platformPreset,
        durationSeconds,
        limitSeconds,
    };
}
function collectReachableTimelineClips(project) {
    const sequences = getProjectSequences(project);
    const sequenceById = new Map(sequences.map((sequence) => [sequence.id, sequence]));
    const clips = [];
    const visitedSequences = new Set();
    const visitTimeline = (timeline) => {
        for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
            clips.push(clip);
            if (clip.type !== 'nested-sequence' || visitedSequences.has(clip.sequenceId)) {
                continue;
            }
            const sequence = sequenceById.get(clip.sequenceId);
            if (sequence) {
                visitedSequences.add(clip.sequenceId);
                visitTimeline(sequence.timeline);
            }
        }
    };
    visitTimeline(project.timeline);
    return clips;
}
function collectMissingMedia(project, clips) {
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const itemByMediaId = new Map();
    const clipIds = new Set();
    for (const clip of clips) {
        if (!('mediaId' in clip)) {
            continue;
        }
        const asset = mediaById.get(clip.mediaId);
        if (asset && !asset.missing && asset.path.trim()) {
            continue;
        }
        const mediaId = asset?.id ?? clip.mediaId;
        itemByMediaId.set(mediaId, asset?.name || clip.name || mediaId);
        clipIds.add(clip.id);
    }
    return {
        items: Array.from(itemByMediaId.values()).sort((left, right) => left.localeCompare(right)),
        clipIds: Array.from(clipIds),
        mediaIds: Array.from(itemByMediaId.keys()),
    };
}
function collectVfrMedia(project, clips) {
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const itemByMediaId = new Map();
    const clipIds = new Set();
    for (const clip of clips) {
        if (!('mediaId' in clip)) {
            continue;
        }
        const asset = mediaById.get(clip.mediaId);
        if (!asset?.variableFrameRate) {
            continue;
        }
        itemByMediaId.set(asset.id, asset.name);
        clipIds.add(clip.id);
    }
    return {
        items: Array.from(itemByMediaId.values()).sort((left, right) => left.localeCompare(right)),
        clipIds: Array.from(clipIds),
        mediaIds: Array.from(itemByMediaId.keys()),
    };
}
function collectFrameRateMismatchedMedia(project, clips) {
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const itemByMediaId = new Map();
    const clipIds = new Set();
    for (const clip of clips) {
        if (!('mediaId' in clip)) {
            continue;
        }
        const asset = mediaById.get(clip.mediaId);
        if (asset?.type !== 'video' || !isFrameRateMismatch(asset.frameRate, project.settings.fps)) {
            continue;
        }
        itemByMediaId.set(asset.id, asset.name);
        clipIds.add(clip.id);
    }
    return {
        items: Array.from(itemByMediaId.values()).sort((left, right) => left.localeCompare(right)),
        clipIds: Array.from(clipIds),
        mediaIds: Array.from(itemByMediaId.keys()),
    };
}
function collectMissingFonts(clips, isFontFamilyAvailable) {
    if (!isFontFamilyAvailable) {
        return { items: [], clipIds: [] };
    }
    const missing = new Map();
    for (const clip of clips) {
        if ((clip.type !== 'text' && clip.type !== 'subtitle' && clip.type !== 'credits') ||
            !clip.style.fontFamily.trim()) {
            continue;
        }
        const families = parseFontFamilyList(clip.style.fontFamily);
        if (families.length === 0 ||
            families.some((family) => isGenericFontFamily(family) || isFontFamilyAvailable(family))) {
            continue;
        }
        const label = families[0] ?? clip.style.fontFamily;
        const clipIds = missing.get(label) ?? new Set();
        clipIds.add(clip.id);
        missing.set(label, clipIds);
    }
    return {
        items: Array.from(missing.keys()).sort((left, right) => left.localeCompare(right)),
        clipIds: Array.from(new Set(Array.from(missing.values()).flatMap((ids) => Array.from(ids)))),
    };
}
export function parseFontFamilyList(fontFamily) {
    const families = [];
    let current = '';
    let quote;
    for (const char of fontFamily) {
        if ((char === '"' || char === "'") && !quote) {
            quote = char;
            continue;
        }
        if (quote === char) {
            quote = undefined;
            continue;
        }
        if (char === ',' && !quote) {
            pushFontFamily(families, current);
            current = '';
            continue;
        }
        current += char;
    }
    pushFontFamily(families, current);
    return families;
}
function pushFontFamily(families, value) {
    const trimmed = value.trim();
    if (trimmed) {
        families.push(trimmed);
    }
}
function isGenericFontFamily(fontFamily) {
    return GENERIC_FONT_FAMILIES.has(fontFamily.trim().toLowerCase());
}
//# sourceMappingURL=preflight.js.map
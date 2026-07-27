import { DEFAULT_AUDIO_DENOISE, DEFAULT_AUDIO_FADE_CURVE, DEFAULT_AUDIO_FADE_DURATION, DEFAULT_AUDIO_PITCH_SEMITONES, DEFAULT_AUDIO_REVERSE, DEFAULT_CHROMA_KEY, DEFAULT_CLIP_SPEED, DEFAULT_COLOR_CORRECTION, DEFAULT_FRAME_INTERPOLATION, DEFAULT_SLOW_MOTION_MODE, DEFAULT_STABILIZATION, DEFAULT_TRANSFORM, createSequence, createTrack, getProjectSequences, normalizeChromaKey, replaceProjectActiveTimeline, } from '../model';
import { normalizePath } from '../project/relative-paths';
import { round } from '../time';
const TIMECODE_RE = /^\d{2}:\d{2}:\d{2}[:;]\d{2}$/;
const COMMENT_CLIP_NAME_RE = /^\*\s*(?:FROM\s+)?CLIP\s+NAME\s*:\s*(.+)$/i;
const COMMENT_SOURCE_FILE_RE = /^\*\s*SOURCE\s+FILE\s*:\s*(.+)$/i;
export function parseCmx3600Edl(contents, fps = 30) {
    const normalizedFps = normalizeFps(fps);
    const events = [];
    let title;
    let current;
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const titleMatch = line.match(/^TITLE:\s*(.+)$/i);
        if (titleMatch) {
            title = titleMatch[1].trim();
            continue;
        }
        const event = parseEdlEventLine(line, normalizedFps, events.length);
        if (event) {
            events.push(event);
            current = event;
            continue;
        }
        if (!current || !line.startsWith('*')) {
            continue;
        }
        current.comments.push(line);
        const clipName = line.match(COMMENT_CLIP_NAME_RE)?.[1]?.trim();
        if (clipName) {
            current.clipName = sanitizeEdlValue(clipName);
            continue;
        }
        const sourceFile = line.match(COMMENT_SOURCE_FILE_RE)?.[1]?.trim();
        if (sourceFile) {
            current.sourceFile = normalizeSourceFileComment(sourceFile);
        }
    }
    return { title, events };
}
export function matchEdlEventsToMedia(events, media) {
    return events.map((event) => {
        const compatible = media.filter((asset) => isCompatibleAsset(event, asset));
        const exact = compatible.find((asset) => isExactMediaMatch(event, asset));
        if (exact) {
            return { event, asset: exact, kind: 'exact', score: 1 };
        }
        const fuzzy = compatible
            .map((asset) => ({ asset, score: scoreFuzzyMediaMatch(event, asset) }))
            .filter((candidate) => candidate.score >= 0.5)
            .sort((left, right) => right.score - left.score || left.asset.name.localeCompare(right.asset.name))[0];
        if (fuzzy) {
            return { event, asset: fuzzy.asset, kind: 'fuzzy', score: fuzzy.score };
        }
        return { event, kind: 'missing', score: 0 };
    });
}
export function buildCmx3600EdlImport(project, contents, options = {}) {
    const fps = normalizeFps(options.fps ?? project.settings.fps);
    const parsed = parseCmx3600Edl(contents, fps);
    const events = parsed.events
        .filter((event) => event.recordEnd > event.recordStart && event.sourceEnd >= event.sourceStart)
        .sort((left, right) => left.recordStart - right.recordStart ||
        left.trackType.localeCompare(right.trackType) ||
        left.id.localeCompare(right.id));
    const matches = matchEdlEventsToMedia(events, project.media);
    const usedIds = new Set([
        ...project.media.map((asset) => asset.id),
        ...getProjectSequences(project).map((sequence) => sequence.id),
        ...getProjectSequences(project).flatMap((sequence) => sequence.timeline.tracks.flatMap((track) => [track.id, ...track.clips.map((clip) => clip.id)])),
    ]);
    const missingMediaByKey = new Map();
    const importedMedia = [];
    const clipInputs = [];
    for (const match of matches) {
        const asset = match.asset ?? getOrCreateMissingMedia(match.event, project, usedIds, missingMediaByKey);
        if (!match.asset && !importedMedia.some((item) => item.id === asset.id)) {
            importedMedia.push(asset);
        }
        const clip = createClipForImportedEvent(match.event, asset, usedIds);
        clipInputs.push({ event: match.event, asset, clip });
    }
    const tracks = buildImportedTracks(clipInputs);
    const timeline = {
        tracks,
        transitions: buildImportedTransitions(clipInputs, fps),
        markers: [],
    };
    const title = normalizeImportTitle(options.sequenceName ?? parsed.title);
    const sequence = createSequence({
        id: uniqueId(`sequence-edl-${slug(title)}`, usedIds),
        name: title,
        timeline,
    });
    return {
        title,
        sequence,
        media: importedMedia,
        matches,
        matchedCount: matches.filter((match) => match.kind !== 'missing').length,
        missingCount: matches.filter((match) => match.kind === 'missing').length,
    };
}
export function applyCmx3600EdlImport(project, result) {
    const synced = replaceProjectActiveTimeline(project, project.timeline);
    const existingMediaIds = new Set(synced.media.map((asset) => asset.id));
    const media = [...synced.media, ...result.media.filter((asset) => !existingMediaIds.has(asset.id))];
    const sequences = [
        ...getProjectSequences(synced).filter((sequence) => sequence.id !== result.sequence.id),
        result.sequence,
    ];
    return {
        ...synced,
        media,
        sequences,
        timeline: result.sequence.timeline,
        activeSequenceId: result.sequence.id,
        updatedAt: new Date().toISOString(),
    };
}
function parseEdlEventLine(line, fps, index) {
    const match = line.match(/^(\d{3,})\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) {
        return undefined;
    }
    const [, editNumber, reel, rawTrack, rawTransition, rest] = match;
    const tokens = rest.split(/\s+/).filter(Boolean);
    const timecodeStart = tokens.findIndex((token) => TIMECODE_RE.test(token));
    if (timecodeStart < 0 || tokens.length - timecodeStart < 4) {
        return undefined;
    }
    const timecodes = tokens.slice(timecodeStart, timecodeStart + 4);
    if (!timecodes.every((token) => TIMECODE_RE.test(token))) {
        return undefined;
    }
    const transitionDurationToken = tokens.slice(0, timecodeStart).find((token) => /^\d+$/.test(token));
    return {
        id: `${editNumber}-${index + 1}`,
        editNumber,
        reel,
        trackType: rawTrack.toUpperCase().includes('A') && !rawTrack.toUpperCase().includes('V') ? 'audio' : 'video',
        transition: normalizeTransition(rawTransition),
        rawTransition,
        transitionDurationFrames: transitionDurationToken ? Number(transitionDurationToken) : undefined,
        sourceStart: timecodeToSeconds(timecodes[0], fps),
        sourceEnd: timecodeToSeconds(timecodes[1], fps),
        recordStart: timecodeToSeconds(timecodes[2], fps),
        recordEnd: timecodeToSeconds(timecodes[3], fps),
        comments: [],
    };
}
function normalizeTransition(value) {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'C') {
        return 'cut';
    }
    if (normalized === 'D') {
        return 'dissolve';
    }
    return 'unknown';
}
function timecodeToSeconds(value, fps) {
    const [hours, minutes, seconds, frames] = value
        .replace(';', ':')
        .split(':')
        .map((part) => Number(part));
    return round(hours * 3600 + minutes * 60 + seconds + frames / fps);
}
function normalizeFps(fps) {
    return Math.max(1, Math.round(Number.isFinite(fps) ? fps : 30));
}
function sanitizeEdlValue(value) {
    return value.replace(/\r?\n/g, ' ').trim();
}
function normalizeSourceFileComment(value) {
    const sanitized = sanitizeEdlValue(value);
    const withoutFileUrl = sanitized.replace(/^file:\/\/localhost\//i, '').replace(/^file:\/\//i, '');
    try {
        return normalizePath(decodeURIComponent(withoutFileUrl).replace(/^([A-Za-z])%3A/i, '$1:'));
    }
    catch {
        return normalizePath(withoutFileUrl.replace(/^([A-Za-z])%3A/i, '$1:'));
    }
}
function isCompatibleAsset(event, asset) {
    if (event.trackType === 'audio') {
        return asset.type === 'audio' || asset.hasAudio === true;
    }
    return asset.type === 'video' || asset.type === 'image';
}
function isExactMediaMatch(event, asset) {
    if (event.sourceFile && normalizePath(event.sourceFile).toLowerCase() === normalizePath(asset.path).toLowerCase()) {
        return true;
    }
    const eventNames = eventCandidateNames(event).map((name) => name.toLowerCase());
    const assetNames = assetCandidateNames(asset).map((name) => name.toLowerCase());
    return eventNames.some((eventName) => assetNames.includes(eventName));
}
function scoreFuzzyMediaMatch(event, asset) {
    const eventNames = eventCandidateNames(event).map(normalizeSearchName).filter(Boolean);
    const assetNames = assetCandidateNames(asset).map(normalizeSearchName).filter(Boolean);
    let best = 0;
    for (const eventName of eventNames) {
        for (const assetName of assetNames) {
            if (eventName === assetName) {
                best = Math.max(best, 0.95);
            }
            else if (eventName.length >= 4 && assetName.includes(eventName)) {
                best = Math.max(best, 0.82);
            }
            else if (assetName.length >= 4 && eventName.includes(assetName)) {
                best = Math.max(best, 0.72);
            }
            else {
                best = Math.max(best, tokenOverlapScore(eventName, assetName));
            }
        }
    }
    return round(best);
}
function tokenOverlapScore(left, right) {
    const leftTokens = new Set(left.split(' ').filter((token) => token.length > 1));
    const rightTokens = new Set(right.split(' ').filter((token) => token.length > 1));
    if (leftTokens.size === 0 || rightTokens.size === 0) {
        return 0;
    }
    const intersection = Array.from(leftTokens).filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
}
function eventCandidateNames(event) {
    return uniqueStrings([
        event.clipName,
        event.sourceFile ? basename(event.sourceFile) : undefined,
        event.reel,
        stripExtension(event.clipName),
        event.sourceFile ? stripExtension(basename(event.sourceFile)) : undefined,
    ]);
}
function assetCandidateNames(asset) {
    const base = basename(asset.path);
    return uniqueStrings([asset.name, base, stripExtension(asset.name), stripExtension(base)]);
}
function normalizeSearchName(value) {
    return (stripExtension(value) ?? value)
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
function uniqueStrings(values) {
    return Array.from(new Set(values.map((value) => value?.trim()).filter((value) => Boolean(value))));
}
function basename(path) {
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(index + 1) : normalized;
}
function stripExtension(value) {
    return value?.replace(/\.[^.\\/]+$/, '');
}
function getOrCreateMissingMedia(event, project, usedIds, missingMediaByKey) {
    const key = normalizeSearchName(event.clipName ?? event.sourceFile ?? event.reel);
    const existing = missingMediaByKey.get(key);
    if (existing) {
        return existing;
    }
    const name = event.clipName ?? (event.sourceFile ? basename(event.sourceFile) : event.reel);
    const duration = round(Math.max(event.sourceEnd, event.sourceEnd - event.sourceStart, event.recordEnd - event.recordStart, 1 / normalizeFps(project.settings.fps)));
    const asset = {
        id: uniqueId(`media-edl-${slug(name)}`, usedIds),
        type: event.trackType === 'audio' ? 'audio' : 'video',
        name,
        path: event.sourceFile ?? name,
        duration,
        width: event.trackType === 'video' ? project.settings.width : 0,
        height: event.trackType === 'video' ? project.settings.height : 0,
        missing: true,
        hasAudio: event.trackType === 'audio',
    };
    missingMediaByKey.set(key, asset);
    return asset;
}
function createClipForImportedEvent(event, asset, usedIds) {
    const id = uniqueId(`clip-edl-${event.editNumber}-${slug(event.clipName ?? asset.name)}`, usedIds);
    const duration = round(event.recordEnd - event.recordStart);
    const trimEnd = round(Math.max(0, asset.duration - event.sourceEnd));
    const base = {
        id,
        name: event.clipName ?? asset.name,
        mediaId: asset.id,
        start: event.recordStart,
        duration,
        trimStart: event.trackType === 'video' && asset.type === 'image' ? 0 : event.sourceStart,
        trimEnd: event.trackType === 'video' && asset.type === 'image' ? 0 : trimEnd,
        speed: DEFAULT_CLIP_SPEED,
        colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
        transform: { ...DEFAULT_TRANSFORM },
        chromaKey: normalizeChromaKey(DEFAULT_CHROMA_KEY),
        stabilization: { ...DEFAULT_STABILIZATION },
        frameInterpolation: { ...DEFAULT_FRAME_INTERPOLATION },
        slowMotionMode: DEFAULT_SLOW_MOTION_MODE,
        audioDenoise: { ...DEFAULT_AUDIO_DENOISE },
        masks: [],
        motionTrack: undefined,
        keyframes: undefined,
        effects: undefined,
    };
    if (event.trackType === 'video' && asset.type === 'image') {
        return { ...base, type: 'image', trackId: 'track-edl-video' };
    }
    const audioDefaults = {
        volume: 1,
        muted: false,
        pitchSemitones: DEFAULT_AUDIO_PITCH_SEMITONES,
        reverseAudio: DEFAULT_AUDIO_REVERSE,
        fadeInDuration: DEFAULT_AUDIO_FADE_DURATION,
        fadeOutDuration: DEFAULT_AUDIO_FADE_DURATION,
        fadeInCurve: DEFAULT_AUDIO_FADE_CURVE,
        fadeOutCurve: DEFAULT_AUDIO_FADE_CURVE,
    };
    if (event.trackType === 'audio') {
        return { ...base, ...audioDefaults, type: 'audio', trackId: 'track-edl-audio' };
    }
    return { ...base, ...audioDefaults, type: 'video', trackId: 'track-edl-video' };
}
function buildImportedTracks(inputs) {
    const videoClips = inputs
        .filter((input) => input.event.trackType === 'video')
        .map((input) => ({ ...input.clip, trackId: 'track-edl-video' }))
        .sort(sortClips);
    const audioClips = inputs
        .filter((input) => input.event.trackType === 'audio')
        .map((input) => ({ ...input.clip, trackId: 'track-edl-audio' }))
        .sort(sortClips);
    return [
        createTrack({ id: 'track-edl-video', type: 'video', name: 'EDL Video', clips: videoClips }),
        createTrack({ id: 'track-edl-audio', type: 'audio', name: 'EDL Audio', clips: audioClips }),
        createTrack({ id: 'track-edl-text', type: 'text', name: 'EDL Text', clips: [] }),
    ];
}
function buildImportedTransitions(inputs, fps) {
    const transitions = [];
    for (const trackType of ['video', 'audio']) {
        const items = inputs
            .filter((input) => input.event.trackType === trackType)
            .sort((left, right) => sortClips(left.clip, right.clip));
        for (let index = 1; index < items.length; index += 1) {
            const current = items[index];
            const previous = items[index - 1];
            if (current.event.transition !== 'dissolve') {
                continue;
            }
            const previousEnd = round(previous.clip.start + previous.clip.duration);
            if (Math.abs(previousEnd - current.clip.start) > 0.001) {
                continue;
            }
            const requested = round((current.event.transitionDurationFrames ?? 1) / fps);
            const duration = round(Math.min(previous.clip.duration, current.clip.duration, Math.max(1 / fps, requested)));
            transitions.push({
                id: `transition-edl-${previous.clip.id}-${current.clip.id}`,
                type: 'dissolve',
                duration,
                fromClipId: previous.clip.id,
                toClipId: current.clip.id,
            });
        }
    }
    return transitions;
}
function sortClips(left, right) {
    return left.start - right.start || left.id.localeCompare(right.id);
}
function normalizeImportTitle(value) {
    const trimmed = value?.trim();
    return trimmed ? `EDL ${trimmed}` : 'EDL Import';
}
function uniqueId(base, usedIds) {
    const safeBase = base.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'edl-import';
    let candidate = safeBase;
    let index = 2;
    while (usedIds.has(candidate)) {
        candidate = `${safeBase}-${index}`;
        index += 1;
    }
    usedIds.add(candidate);
    return candidate;
}
function slug(value) {
    const normalized = normalizeSearchName(value).replace(/\s+/g, '-');
    return normalized || 'clip';
}
//# sourceMappingURL=timeline-import.js.map
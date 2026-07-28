import { getTimelineDuration } from './timeline';
import { round } from './time';
export function diffTimelineSnapshots(current, snapshot) {
    const duration = Math.max(getTimelineDuration(current), getTimelineDuration(snapshot));
    const boundaries = collectTimelineBoundaries(current, snapshot, duration);
    const ranges = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        if (end - start <= 0.000001) {
            continue;
        }
        const sampleTime = start + (end - start) / 2;
        if (timelineSignatureAt(current, sampleTime) !== timelineSignatureAt(snapshot, sampleTime)) {
            ranges.push({ start, end });
        }
    }
    return mergeDiffRanges(ranges);
}
export function diffTimelineVersions(before, after) {
    const beforeTracks = new Map(before.tracks.map((track) => [track.id, track]));
    const afterTracks = new Map(after.tracks.map((track) => [track.id, track]));
    const items = [];
    for (const track of after.tracks) {
        if (!beforeTracks.has(track.id)) {
            items.push({
                id: `track-added:${track.id}`,
                type: 'track-added',
                label: track.name,
                trackId: track.id,
                fields: [{ field: 'track', before: null, after: compactTrack(track) }],
            });
        }
    }
    for (const track of before.tracks) {
        if (!afterTracks.has(track.id)) {
            items.push({
                id: `track-removed:${track.id}`,
                type: 'track-removed',
                label: track.name,
                trackId: track.id,
                fields: [{ field: 'track', before: compactTrack(track), after: null }],
            });
        }
    }
    const beforeClips = indexClips(before);
    const afterClips = indexClips(after);
    for (const [clipId, afterClip] of afterClips) {
        const beforeClip = beforeClips.get(clipId);
        if (!beforeClip) {
            items.push({
                id: `clip-added:${clipId}`,
                type: 'clip-added',
                label: afterClip.clip.name,
                trackId: afterClip.trackId,
                clipId,
                fields: [{ field: 'clip', before: null, after: compactClip(afterClip.clip) }],
            });
            continue;
        }
        const fields = diffClipFields(beforeClip.clip, afterClip.clip, beforeClip.trackId, afterClip.trackId);
        if (fields.length > 0) {
            const type = isMoveOnlyDiff(fields) ? 'clip-moved' : 'clip-modified';
            items.push({
                id: `${type}:${clipId}`,
                type,
                label: afterClip.clip.name,
                trackId: afterClip.trackId,
                clipId,
                fields,
            });
        }
    }
    for (const [clipId, beforeClip] of beforeClips) {
        if (!afterClips.has(clipId)) {
            items.push({
                id: `clip-deleted:${clipId}`,
                type: 'clip-deleted',
                label: beforeClip.clip.name,
                trackId: beforeClip.trackId,
                clipId,
                fields: [{ field: 'clip', before: compactClip(beforeClip.clip), after: null }],
            });
        }
    }
    const summary = items.reduce((acc, item) => {
        if (item.type === 'clip-added')
            acc.added += 1;
        if (item.type === 'clip-deleted')
            acc.deleted += 1;
        if (item.type === 'clip-modified' || item.type === 'clip-moved')
            acc.modified += 1;
        if (item.type === 'track-added' || item.type === 'track-removed')
            acc.trackChanges += 1;
        return acc;
    }, { added: 0, deleted: 0, modified: 0, trackChanges: 0 });
    return { items, summary };
}
export function applyTimelineVersionDiffSelection(target, source, selectedItemIds) {
    const selected = new Set(selectedItemIds);
    if (selected.size === 0) {
        return target;
    }
    const diff = diffTimelineVersions(target, source);
    let next = cloneTimeline(target);
    for (const item of diff.items) {
        if (!selected.has(item.id)) {
            continue;
        }
        if (item.type === 'track-added' && item.trackId) {
            const sourceTrack = source.tracks.find((track) => track.id === item.trackId);
            if (sourceTrack && !next.tracks.some((track) => track.id === sourceTrack.id)) {
                next = { ...next, tracks: [...next.tracks, cloneTrack(sourceTrack)] };
            }
        }
        else if (item.type === 'track-removed' && item.trackId) {
            next = { ...next, tracks: next.tracks.filter((track) => track.id !== item.trackId) };
        }
        else if (item.type === 'clip-added' && item.clipId) {
            const sourceClip = findClipWithTrack(source, item.clipId);
            if (sourceClip) {
                next = upsertClip(next, sourceClip.trackId, sourceClip.clip);
            }
        }
        else if (item.type === 'clip-deleted' && item.clipId) {
            next = removeClipById(next, item.clipId);
        }
        else if ((item.type === 'clip-modified' || item.type === 'clip-moved') && item.clipId) {
            const sourceClip = findClipWithTrack(source, item.clipId);
            if (sourceClip) {
                next = upsertClip(removeClipById(next, item.clipId), sourceClip.trackId, sourceClip.clip);
            }
        }
    }
    return next;
}
export function getTimelineVersionDiffNavigationIndex(items, currentIndex, direction) {
    if (items.length === 0) {
        return -1;
    }
    if (direction === 'previous') {
        return currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }
    return currentIndex < 0 || currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
}
export function calculateTimelineCompareScrollSync(sourceScrollLeft, sourceScrollWidth, sourceViewportWidth, targetScrollWidth, targetViewportWidth) {
    const sourceMax = Math.max(0, sourceScrollWidth - sourceViewportWidth);
    const targetMax = Math.max(0, targetScrollWidth - targetViewportWidth);
    if (sourceMax <= 0 || targetMax <= 0) {
        return 0;
    }
    const ratio = Math.min(1, Math.max(0, sourceScrollLeft / sourceMax));
    return round(ratio * targetMax);
}
function collectTimelineBoundaries(current, snapshot, duration) {
    const points = [0, duration];
    for (const timeline of [current, snapshot]) {
        for (const clip of timeline.tracks.flatMap((track) => track.clips)) {
            points.push(clip.start, clip.start + clip.duration);
        }
    }
    return Array.from(new Set(points.map((time) => round(Math.max(0, time)))))
        .filter((time) => time >= 0 && time <= duration)
        .sort((left, right) => left - right);
}
function timelineSignatureAt(timeline, time) {
    return timeline.tracks
        .map((track, trackIndex) => {
        const clips = track.clips
            .filter((clip) => time >= clip.start && time < clip.start + clip.duration)
            .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
            .map((clip) => clipSignature(clip));
        return `${trackIndex}:${track.type}:${track.muted === true ? 'muted' : 'live'}:${clips.join('|')}`;
    })
        .join('::');
}
function clipSignature(clip) {
    return JSON.stringify({
        id: clip.id,
        type: clip.type,
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        speed: clip.speed,
        transform: clip.transform,
        colorCorrection: clip.colorCorrection,
        chromaKey: clip.chromaKey,
        masks: clip.masks,
        effects: clip.effects,
        mediaId: 'mediaId' in clip ? clip.mediaId : undefined,
        sequenceId: 'sequenceId' in clip ? clip.sequenceId : undefined,
        text: 'text' in clip ? clip.text : undefined,
        rows: clip.type === 'credits' ? clip.rows : undefined,
        rollSpeed: clip.type === 'credits' ? clip.rollSpeed : undefined,
        style: 'style' in clip ? clip.style : undefined,
        pathText: clip.type === 'text' ? clip.pathText : undefined,
        volume: 'volume' in clip ? clip.volume : undefined,
        muted: 'muted' in clip ? clip.muted : undefined,
        keyframes: clip.keyframes,
    });
}
function mergeDiffRanges(ranges) {
    const output = [];
    for (const range of ranges) {
        const previous = output.at(-1);
        if (previous && Math.abs(previous.end - range.start) <= 0.000001) {
            previous.end = range.end;
        }
        else {
            output.push({ ...range });
        }
    }
    return output.map((range) => ({ start: round(range.start), end: round(range.end) }));
}
function indexClips(timeline) {
    const output = new Map();
    timeline.tracks.forEach((track, trackIndex) => {
        track.clips.forEach((clip) => output.set(clip.id, { clip, trackId: track.id, trackIndex }));
    });
    return output;
}
function diffClipFields(before, after, beforeTrackId, afterTrackId) {
    const fields = [];
    if (beforeTrackId !== afterTrackId) {
        fields.push({ field: 'trackId', before: beforeTrackId, after: afterTrackId });
    }
    const beforeRecord = compactClip(before);
    const afterRecord = compactClip(after);
    for (const key of Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])).sort()) {
        const beforeValue = beforeRecord[key];
        const afterValue = afterRecord[key];
        if (stableStringify(beforeValue) !== stableStringify(afterValue)) {
            fields.push({ field: key, before: beforeValue, after: afterValue });
        }
    }
    return fields;
}
function isMoveOnlyDiff(fields) {
    return fields.length > 0 && fields.every((field) => field.field === 'start' || field.field === 'trackId');
}
function compactClip(clip) {
    return {
        type: clip.type,
        name: clip.name,
        start: clip.start,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        speed: clip.speed,
        transform: clip.transform,
        colorCorrection: clip.colorCorrection,
        chromaKey: clip.chromaKey,
        masks: clip.masks,
        effects: clip.effects,
        keyframes: clip.keyframes,
        mediaId: 'mediaId' in clip ? clip.mediaId : undefined,
        sequenceId: 'sequenceId' in clip ? clip.sequenceId : undefined,
        text: 'text' in clip ? clip.text : undefined,
        rows: clip.type === 'credits' ? clip.rows : undefined,
        rollSpeed: clip.type === 'credits' ? clip.rollSpeed : undefined,
        style: 'style' in clip ? clip.style : undefined,
        volume: 'volume' in clip ? clip.volume : undefined,
        muted: 'muted' in clip ? clip.muted : undefined,
    };
}
function compactTrack(track) {
    return {
        type: track.type,
        name: track.name,
        muted: track.muted,
        solo: track.solo,
        locked: track.locked,
        clipCount: track.clips.length,
    };
}
function cloneTimeline(timeline) {
    return {
        ...timeline,
        tracks: timeline.tracks.map(cloneTrack),
        transitions: timeline.transitions ? timeline.transitions.map((transition) => ({ ...transition })) : undefined,
        markers: timeline.markers ? timeline.markers.map((marker) => ({ ...marker })) : undefined,
    };
}
function cloneTrack(track) {
    return {
        ...track,
        clips: track.clips.map((clip) => structuredCloneCompat(clip)),
    };
}
function findClipWithTrack(timeline, clipId) {
    for (const track of timeline.tracks) {
        const clip = track.clips.find((item) => item.id === clipId);
        if (clip) {
            return { clip: structuredCloneCompat(clip), trackId: track.id };
        }
    }
    return undefined;
}
function upsertClip(timeline, trackId, clip) {
    const sourceClip = structuredCloneCompat(clip);
    const hasTrack = timeline.tracks.some((track) => track.id === trackId);
    const tracks = (hasTrack
        ? timeline.tracks
        : [
            ...timeline.tracks,
            { id: trackId, type: clipTypeToTrackType(sourceClip.type), name: trackId, clips: [] },
        ]).map((track) => {
        if (track.id !== trackId) {
            return { ...track, clips: track.clips.filter((item) => item.id !== sourceClip.id) };
        }
        const clips = track.clips.filter((item) => item.id !== sourceClip.id);
        return {
            ...track,
            clips: [...clips, { ...sourceClip, trackId }].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
        };
    });
    return { ...timeline, tracks };
}
function clipTypeToTrackType(type) {
    if (type === 'audio') {
        return 'audio';
    }
    if (type === 'text' || type === 'credits') {
        return 'text';
    }
    if (type === 'subtitle') {
        return 'subtitle';
    }
    return 'video';
}
function removeClipById(timeline, clipId) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({ ...track, clips: track.clips.filter((clip) => clip.id !== clipId) })),
    };
}
function stableStringify(value) {
    return (JSON.stringify(value, Object.keys(value && typeof value === 'object' ? flattenKeys(value) : { value }).sort()) ??
        'undefined');
}
function flattenKeys(value) {
    const keys = {};
    const visit = (item) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        for (const key of Object.keys(item)) {
            keys[key] = true;
            visit(item[key]);
        }
    };
    visit(value);
    return keys;
}
function structuredCloneCompat(value) {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
//# sourceMappingURL=timeline-compare.js.map
export function searchTimeline(project, options) {
    const matcher = buildTimelineSearchMatcher(options.query, options.useRegex);
    if (!matcher) {
        return { results: [], error: 'invalid-regex' };
    }
    const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
    const groupNamesByClipId = buildGroupNamesByClipId(project);
    const hasActiveFilter = hasTimelineSearchFilter(options);
    const results = [];
    for (const track of project.timeline.tracks) {
        for (const clip of track.clips) {
            if (!clipPassesTimelineSearchFilters(clip, options)) {
                continue;
            }
            const asset = 'mediaId' in clip ? mediaById.get(clip.mediaId) : undefined;
            const reasons = collectClipSearchReasons(clip, track, asset, groupNamesByClipId.get(clip.id) ?? [], matcher);
            if (reasons.length === 0 && !(matcher.empty && hasActiveFilter)) {
                continue;
            }
            results.push({
                id: clip.id,
                kind: 'clip',
                label: clip.name,
                start: clip.start,
                duration: clip.duration,
                trackId: track.id,
                trackName: track.name,
                clipId: clip.id,
                clipType: clip.type,
                mediaId: asset?.id,
                mediaName: asset?.name,
                matchReasons: reasons.length > 0 ? reasons : ['filter'],
            });
        }
    }
    if (!hasActiveFilter) {
        for (const marker of project.timeline.markers ?? []) {
            if (matcher.matches(marker.label)) {
                results.push(markerToSearchResult(marker));
            }
        }
    }
    return {
        results: results.sort((left, right) => left.start - right.start || kindSort(left.kind) - kindSort(right.kind) || left.label.localeCompare(right.label)),
    };
}
export function buildTimelineSearchMatcher(query, useRegex = false) {
    const trimmed = query.trim();
    if (!trimmed) {
        return { empty: true, matches: () => false };
    }
    if (useRegex) {
        try {
            const regex = new RegExp(trimmed, 'i');
            return { empty: false, matches: (value) => Boolean(value && regex.test(value)) };
        }
        catch {
            return undefined;
        }
    }
    const normalized = trimmed.toLowerCase();
    return { empty: false, matches: (value) => Boolean(value?.toLowerCase().includes(normalized)) };
}
export function clipPassesTimelineSearchFilters(clip, options) {
    const mediaFilter = options.mediaFilter ?? 'all';
    if (mediaFilter !== 'all' && clip.type !== mediaFilter) {
        return false;
    }
    const effectCount = clip.effects?.length ?? 0;
    if (options.effectFilter === 'has-effects' && effectCount === 0) {
        return false;
    }
    if (options.effectFilter === 'no-effects' && effectCount > 0) {
        return false;
    }
    const hasKeyframes = clipHasTimelineSearchKeyframes(clip);
    if (options.keyframeFilter === 'has-keyframes' && !hasKeyframes) {
        return false;
    }
    if (options.keyframeFilter === 'no-keyframes' && hasKeyframes) {
        return false;
    }
    return true;
}
export function createTimelineSearchJump(result) {
    return {
        playheadTime: result.start,
        selectedClipIds: result.kind === 'clip' && result.clipId ? [result.clipId] : [],
    };
}
function collectClipSearchReasons(clip, track, asset, groupNames, matcher) {
    const reasons = [];
    addReason(reasons, matcher.matches(clip.name), 'clip-name');
    addReason(reasons, matcher.matches(asset?.name) || matcher.matches(asset?.path), 'file-name');
    addReason(reasons, matcher.matches(clip.colorLabel ?? undefined) || matcher.matches(track.color ?? undefined), 'color-label');
    addReason(reasons, (clip.effects ?? []).some((effect) => matcher.matches(effect.type)), 'effect-type');
    addReason(reasons, clip.type === 'subtitle' && matcher.matches(clip.text), 'subtitle-text');
    addReason(reasons, groupNames.some((name) => matcher.matches(name)), 'group-name');
    return reasons;
}
function addReason(reasons, matched, reason) {
    if (matched) {
        reasons.push(reason);
    }
}
function buildGroupNamesByClipId(project) {
    const map = new Map();
    for (const group of project.clipGroups ?? []) {
        for (const clipId of group.clipIds) {
            const names = map.get(clipId) ?? [];
            names.push(group.name);
            map.set(clipId, names);
        }
    }
    return map;
}
function markerToSearchResult(marker) {
    return {
        id: marker.id,
        kind: 'marker',
        label: marker.label,
        start: marker.time,
        trackName: 'Markers',
        matchReasons: ['marker-name'],
    };
}
function clipHasTimelineSearchKeyframes(clip) {
    return Object.values(clip.keyframes ?? {}).some((frames) => Array.isArray(frames) && frames.length > 0);
}
function hasTimelineSearchFilter(options) {
    return ((options.mediaFilter ?? 'all') !== 'all' ||
        (options.effectFilter ?? 'all') !== 'all' ||
        (options.keyframeFilter ?? 'all') !== 'all');
}
function kindSort(kind) {
    return kind === 'clip' ? 0 : 1;
}
//# sourceMappingURL=timeline-search.js.map
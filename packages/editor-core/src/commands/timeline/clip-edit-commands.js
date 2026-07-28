import { DEFAULT_CLIP_SPEED, normalizeAudioFadeDuration } from '../../model';
import { round } from '../../time';
import { detectOverlap, getClipSpeed, removeClip, replaceClip } from '../../timeline';
import { asReplaceableMediaClip, findClip, findTrack, insertClip, isReplaceableMediaClip } from './utils';
export class DeleteClipCommand {
    accessor;
    clipId;
    description = 'Delete clip';
    removed;
    removedIndex = -1;
    constructor(accessor, clipId) {
        this.accessor = accessor;
        this.clipId = clipId;
    }
    execute() {
        const result = removeClip(this.accessor.getTimeline(), this.clipId);
        this.removed = result.clip;
        this.removedIndex = result.index;
        this.accessor.setTimeline(result.timeline);
    }
    undo() {
        if (this.removed) {
            this.accessor.setTimeline(insertClip(this.accessor.getTimeline(), this.removed, this.removedIndex));
        }
    }
}
export function calculateReplaceMediaPatch(clip, media, durationMode) {
    const minDuration = 1 / 30;
    const originalDuration = Math.max(minDuration, clip.duration);
    const mediaDuration = Math.max(minDuration, Number.isFinite(media.duration) ? media.duration : originalDuration);
    if (durationMode === 'stretch-to-fit') {
        return {
            mediaId: media.id,
            duration: round(originalDuration),
            trimStart: 0,
            trimEnd: 0,
            speed: getClipSpeed({ speed: mediaDuration / originalDuration }),
        };
    }
    if (durationMode === 'use-new-duration') {
        return {
            mediaId: media.id,
            duration: round(mediaDuration),
            trimStart: 0,
            trimEnd: 0,
            speed: DEFAULT_CLIP_SPEED,
        };
    }
    const duration = Math.min(originalDuration, mediaDuration);
    return {
        mediaId: media.id,
        duration: round(duration),
        trimStart: 0,
        trimEnd: round(Math.max(0, mediaDuration - duration)),
        speed: DEFAULT_CLIP_SPEED,
    };
}
export function getReplaceMediaCompatibilityWarnings(clip, media) {
    if (!isReplaceableMediaClip(clip)) {
        return ['media-type-mismatch'];
    }
    const warnings = new Set();
    if (clip.type !== media.type) {
        warnings.add('media-type-mismatch');
    }
    const newMediaHasAudio = media.type === 'audio' || (media.type === 'video' && media.hasAudio !== false);
    const clipHasAudioProperties = clip.type === 'audio' ||
        ('volume' in clip && clip.volume !== undefined) ||
        Boolean(clip.keyframes?.volume?.length) ||
        ('fadeInDuration' in clip && ((clip.fadeInDuration ?? 0) > 0 || (clip.fadeOutDuration ?? 0) > 0));
    if (clipHasAudioProperties && !newMediaHasAudio) {
        warnings.add('missing-audio-for-audio-properties');
    }
    return Array.from(warnings);
}
export class ReplaceMediaCommand {
    accessor;
    clipId;
    media;
    durationMode;
    description = 'Replace media';
    before;
    after;
    constructor(accessor, clipId, media, durationMode) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.media = media;
        this.durationMode = durationMode;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
        const patch = calculateReplaceMediaPatch(this.before, this.media, this.durationMode);
        this.after = {
            ...this.before,
            ...patch,
        };
        if (this.after.type === 'video' || this.after.type === 'audio') {
            this.after = {
                ...this.after,
                fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
                fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
            };
        }
        const track = findTrack(timeline, this.after.trackId);
        if (detectOverlap(track, this.after, this.before.id)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class SwitchMediaVersionCommand {
    accessor;
    clipId;
    media;
    description = 'Switch media version';
    before;
    after;
    constructor(accessor, clipId, media) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.media = media;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
        const patch = calculateReplaceMediaPatch(this.before, this.media, 'trim-to-original');
        this.after = {
            ...this.before,
            ...patch,
        };
        if (this.after.type === 'video' || this.after.type === 'audio') {
            this.after = {
                ...this.after,
                fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
                fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
            };
        }
        const track = findTrack(timeline, this.after.trackId);
        if (detectOverlap(track, this.after, this.before.id)) {
            throw new Error('Clip overlaps another clip on this track');
        }
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
//# sourceMappingURL=clip-edit-commands.js.map
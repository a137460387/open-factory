import { filterShortSceneCuts } from '../../scene-cuts';
import { buildDialogueRoughCutClips, buildRhythmAssembleClips, buildSmartMontageClips } from '../../smart-rough-cut-v2';
import { replaceClip } from '../../timeline';
import { buildKeptRanges, buildSplitRanges, findClip, insertGeneratedClips, removeClipsFromTimeline, replaceClipWithGeneratedClips, replaceClipWithSlices } from './utils';
export class BatchSplitAtSceneCutsCommand {
    accessor;
    items;
    description = 'Split clips at scene cuts';
    before;
    after;
    constructor(accessor, items) {
        this.accessor = accessor;
        this.items = items;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            let next = timeline;
            let splitCount = 0;
            for (const item of this.items) {
                const clip = findClip(next, item.clipId);
                const cuts = item.cuts ?? clip.scenecuts ?? [];
                const splitTimes = filterShortSceneCuts(cuts, clip.duration, item.minSceneSeconds ?? 0);
                if (splitTimes.length === 0) {
                    continue;
                }
                const ranges = buildSplitRanges(clip.duration, splitTimes);
                if (ranges.length <= 1) {
                    continue;
                }
                next = replaceClip(next, { ...clip, scenecuts: splitTimes });
                next = replaceClipWithSlices(next, item.clipId, ranges, false);
                splitCount += splitTimes.length;
            }
            if (splitCount === 0) {
                throw new Error('No valid scene cuts inside clip bounds');
            }
            this.after = next;
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
export class RemoveSilenceCommand {
    accessor;
    clipId;
    ranges;
    description = 'Remove silence';
    before;
    after;
    constructor(accessor, clipId, ranges) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.ranges = ranges;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            const clip = findClip(timeline, this.clipId);
            const keptRanges = buildKeptRanges(clip.duration, this.ranges);
            if (keptRanges.length === 0) {
                throw new Error('Silence removal would remove the entire clip');
            }
            if (keptRanges.length === 1 && keptRanges[0].start <= 0.000001 && keptRanges[0].end >= clip.duration - 0.000001) {
                throw new Error('No silence ranges inside clip bounds');
            }
            this.after = replaceClipWithSlices(timeline, this.clipId, keptRanges, true);
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setTimeline(this.before);
    }
}
export class DialogueRoughCutCommand {
    accessor;
    clipId;
    intervals;
    description = 'Dialogue rough cut';
    before;
    after;
    generatedCount = 0;
    constructor(accessor, clipId, intervals) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.intervals = intervals;
    }
    get clipCount() {
        return this.generatedCount;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            const clip = findClip(timeline, this.clipId);
            if (clip.type !== 'audio' && clip.type !== 'video') {
                throw new Error('Dialogue rough cut requires an audio or video clip');
            }
            const clips = buildDialogueRoughCutClips(clip, this.intervals);
            if (clips.length === 0) {
                throw new Error('No dialogue intervals inside clip bounds');
            }
            this.generatedCount = clips.length;
            this.after = replaceClipWithGeneratedClips(timeline, clip.id, clips);
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class BrollInsertCommand {
    accessor;
    clips;
    description = 'Insert B-roll clips';
    before;
    after;
    constructor(accessor, clips) {
        this.accessor = accessor;
        this.clips = clips;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            if (this.clips.length === 0) {
                throw new Error('No B-roll clips to insert');
            }
            this.after = insertGeneratedClips(timeline, this.clips);
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class RhythmAssembleCommand {
    accessor;
    clipIds;
    beatTimes;
    targetTrackId;
    description = 'Rhythm assemble clips';
    before;
    after;
    generatedCount = 0;
    constructor(accessor, clipIds, beatTimes, targetTrackId) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.beatTimes = beatTimes;
        this.targetTrackId = targetTrackId;
    }
    get clipCount() {
        return this.generatedCount;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            const selected = new Set(this.clipIds);
            const clips = timeline.tracks
                .flatMap((track) => track.clips)
                .filter((clip) => selected.has(clip.id) && (clip.type === 'video' || clip.type === 'image'));
            const assembled = buildRhythmAssembleClips(clips, this.beatTimes, this.targetTrackId);
            if (assembled.length === 0) {
                throw new Error('No rhythm clips to assemble');
            }
            this.generatedCount = assembled.length;
            const withoutSources = removeClipsFromTimeline(timeline, new Set(clips.map((clip) => clip.id)));
            this.after = insertGeneratedClips(withoutSources, assembled);
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class SmartMontageCommand {
    accessor;
    config;
    description = 'AI smart montage';
    before;
    after;
    result = { clipCount: 0, estimatedBpm: 0 };
    constructor(accessor, config) {
        this.accessor = accessor;
        this.config = config;
    }
    get montageResult() {
        return this.result;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= timeline;
        if (!this.after) {
            const montage = buildSmartMontageClips(this.config);
            if (!montage) {
                throw new Error('Smart montage: unable to build clips from the provided assets and beat data');
            }
            const allClips = [...montage.visualClips, montage.audioClip];
            this.result = { clipCount: montage.visualClips.length, estimatedBpm: montage.estimatedBpm };
            this.after = insertGeneratedClips(timeline, allClips);
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=clip-smart-commands.js.map
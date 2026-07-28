import { normalizeClipBorder, normalizeTransform } from '../../model';
import { calculatePiPTransform, createFullFrameTransform } from '../../pip-layout';
import { calculateSplitLayoutTransforms } from '../../split-layout';
import { findClip, isPiPVisualClip } from './utils';
export class PiPLayoutCommand {
    accessor;
    mainClipId;
    pipClipId;
    options;
    description = 'Apply PiP layout';
    before;
    constructor(accessor, mainClipId, pipClipId, options) {
        this.accessor = accessor;
        this.mainClipId = mainClipId;
        this.pipClipId = pipClipId;
        this.options = options;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        if (this.mainClipId === this.pipClipId) {
            throw new Error('PiP layout requires two different clips');
        }
        const mainClip = findClip(timeline, this.mainClipId);
        const pipClip = findClip(timeline, this.pipClipId);
        if (!isPiPVisualClip(mainClip) || !isPiPVisualClip(pipClip)) {
            throw new Error('PiP layout requires two visual clips');
        }
        this.before ??= timeline;
        const pipTransform = calculatePiPTransform({
            position: this.options.position ?? 'bottom-right',
            canvasWidth: this.options.canvasWidth,
            canvasHeight: this.options.canvasHeight,
            sourceWidth: this.options.pipSourceWidth,
            sourceHeight: this.options.pipSourceHeight,
            scale: this.options.scale,
            margin: this.options.margin,
        });
        const nextById = new Map([
            [
                mainClip.id,
                {
                    ...mainClip,
                    transform: normalizeTransform(createFullFrameTransform()),
                    border: normalizeClipBorder({ enabled: false }),
                },
            ],
            [
                pipClip.id,
                {
                    ...pipClip,
                    transform: normalizeTransform(pipTransform),
                    border: normalizeClipBorder({
                        enabled: true,
                        color: '#ffffff',
                        width: 6,
                        ...this.options.border,
                    }),
                },
            ],
        ]);
        this.accessor.setTimeline({
            ...timeline,
            tracks: timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => nextById.get(clip.id) ?? clip),
            })),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class ApplySplitLayoutCommand {
    accessor;
    clipIds;
    options;
    description = 'Apply split-screen layout';
    before;
    constructor(accessor, clipIds, options) {
        this.accessor = accessor;
        this.clipIds = clipIds;
        this.options = options;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        const uniqueIds = Array.from(new Set(this.clipIds));
        if (uniqueIds.length < 2 || uniqueIds.length > 4) {
            throw new Error('Split layout requires 2 to 4 clips');
        }
        const clips = uniqueIds.map((clipId) => findClip(timeline, clipId));
        if (!clips.every(isPiPVisualClip)) {
            throw new Error('Split layout requires visual clips');
        }
        this.before ??= timeline;
        const sources = clips.map((clip) => {
            const source = this.options.sources?.[clip.id];
            return {
                clipId: clip.id,
                sourceWidth: source?.width,
                sourceHeight: source?.height,
            };
        });
        const transforms = new Map(calculateSplitLayoutTransforms({
            layout: this.options.layout,
            clips: sources,
            canvasWidth: this.options.canvasWidth,
            canvasHeight: this.options.canvasHeight,
        }).map((item) => [item.clipId, item.transform]));
        if (transforms.size === 0) {
            throw new Error('Split layout has no usable cells');
        }
        this.accessor.setTimeline({
            ...timeline,
            tracks: timeline.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) => {
                    const transform = transforms.get(clip.id);
                    return transform ? { ...clip, transform: normalizeTransform(transform) } : clip;
                }),
            })),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
//# sourceMappingURL=clip-layout-commands.js.map
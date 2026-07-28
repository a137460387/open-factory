import { createMask, normalizeMask, normalizeMasks } from '../../model';
import { replaceClip } from '../../timeline';
import { findClip } from './utils';
export class AddMaskCommand {
    accessor;
    clipId;
    input;
    description = 'Add mask';
    before;
    after;
    mask;
    constructor(accessor, clipId, input = {}) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        this.mask ??= createMask(this.input);
        this.after = {
            ...this.before,
            masks: [...normalizeMasks(this.before.masks), this.mask],
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class RemoveMaskCommand {
    accessor;
    clipId;
    maskId;
    description = 'Remove mask';
    before;
    after;
    constructor(accessor, clipId, maskId) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.maskId = maskId;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const masks = normalizeMasks(this.before.masks);
        if (!masks.some((mask) => mask.id === this.maskId)) {
            throw new Error(`Mask ${this.maskId} not found`);
        }
        this.after = {
            ...this.before,
            masks: masks.filter((mask) => mask.id !== this.maskId),
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class UpdateMaskCommand {
    accessor;
    clipId;
    maskId;
    patch;
    description = 'Update mask';
    before;
    after;
    constructor(accessor, clipId, maskId, patch) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.maskId = maskId;
        this.patch = patch;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const masks = normalizeMasks(this.before.masks);
        if (!masks.some((mask) => mask.id === this.maskId)) {
            throw new Error(`Mask ${this.maskId} not found`);
        }
        this.after = {
            ...this.before,
            masks: masks.map((mask) => mask.id === this.maskId ? normalizeMask({ ...mask, ...this.patch, id: mask.id }) : mask),
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
//# sourceMappingURL=mask-commands.js.map
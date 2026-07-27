import { buildEffectPresetClipPatch } from '../../effect-presets';
import { cloneEffects, normalizeEffect, normalizeEffects } from '../../effects';
import { createId } from '../../model';
import { replaceClip } from '../../timeline';
import { UpdateClipCommand } from './clip-update-commands';
import { findClip } from './utils';
export class ApplyEffectPresetCommand {
    accessor;
    clipId;
    preset;
    description = 'Apply effect preset';
    before;
    after;
    constructor(accessor, clipId, preset) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.preset = preset;
    }
    execute() {
        this.before ??= this.accessor.getTimeline();
        if (!this.after) {
            let timeline = this.before;
            const clip = findClip(timeline, this.clipId);
            const patch = buildEffectPresetClipPatch(this.preset, clip.duration);
            const commandAccessor = {
                getTimeline: () => timeline,
                setTimeline: (nextTimeline) => {
                    timeline = nextTimeline;
                },
            };
            new UpdateClipCommand(commandAccessor, this.clipId, patch).execute();
            this.after = timeline;
        }
        this.accessor.setTimeline(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(this.before);
        }
    }
}
export class AddEffectCommand {
    accessor;
    clipId;
    input;
    description = 'Add effect';
    before;
    after;
    effect;
    constructor(accessor, clipId, input) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.input = input;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        this.effect ??= normalizeEffect({
            id: this.input.id ?? createId('effect'),
            type: this.input.type,
            enabled: this.input.enabled ?? true,
            params: this.input.params,
        });
        if (!this.effect) {
            throw new Error('Invalid effect');
        }
        this.after = {
            ...this.before,
            effects: [...(cloneEffects(this.before.effects) ?? []), this.effect],
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class RemoveEffectCommand {
    accessor;
    clipId;
    effectId;
    description = 'Remove effect';
    before;
    after;
    constructor(accessor, clipId, effectId) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.effectId = effectId;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const effects = cloneEffects(this.before.effects) ?? [];
        if (!effects.some((effect) => effect.id === this.effectId)) {
            throw new Error(`Effect ${this.effectId} not found`);
        }
        this.after = {
            ...this.before,
            effects: normalizeEffects(effects.filter((effect) => effect.id !== this.effectId)),
        };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class UpdateEffectCommand {
    accessor;
    clipId;
    effectId;
    patch;
    description = 'Update effect';
    before;
    after;
    constructor(accessor, clipId, effectId, patch) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.effectId = effectId;
        this.patch = patch;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const effects = cloneEffects(this.before.effects) ?? [];
        const index = effects.findIndex((effect) => effect.id === this.effectId);
        if (index === -1) {
            throw new Error(`Effect ${this.effectId} not found`);
        }
        const existing = effects[index];
        const nextEffect = normalizeEffect({
            ...existing,
            ...this.patch,
            params: { ...existing.params, ...this.patch.params },
        });
        if (!nextEffect) {
            throw new Error('Invalid effect');
        }
        effects[index] = nextEffect;
        this.after = { ...this.before, effects };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
export class ReorderEffectsCommand {
    accessor;
    clipId;
    orderedEffectIds;
    description = 'Reorder effects';
    before;
    after;
    constructor(accessor, clipId, orderedEffectIds) {
        this.accessor = accessor;
        this.clipId = clipId;
        this.orderedEffectIds = orderedEffectIds;
    }
    execute() {
        const timeline = this.accessor.getTimeline();
        this.before ??= findClip(timeline, this.clipId);
        const effects = cloneEffects(this.before.effects) ?? [];
        const byId = new Map(effects.map((effect) => [effect.id, effect]));
        if (this.orderedEffectIds.some((id) => !byId.has(id))) {
            throw new Error('Effect order does not match current effect stack');
        }
        const reordered = this.orderedEffectIds.flatMap((id) => {
            const effect = byId.get(id);
            return effect ? [effect] : [];
        });
        const included = new Set(reordered.map((effect) => effect.id));
        reordered.push(...effects.filter((effect) => !included.has(effect.id)));
        if (reordered.length !== effects.length) {
            throw new Error('Effect order does not match current effect stack');
        }
        this.after = { ...this.before, effects: reordered };
        this.accessor.setTimeline(replaceClip(timeline, this.after));
    }
    undo() {
        if (this.before) {
            this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
        }
    }
}
//# sourceMappingURL=effect-commands.js.map
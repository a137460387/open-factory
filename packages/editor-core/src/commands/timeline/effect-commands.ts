import type { TimelineAccessor, ProjectAccessor } from "./index";
import { EffectPreset, buildEffectPresetClipPatch } from '../../effect-presets';
import { Effect, EffectParams, EffectType, cloneEffects, normalizeEffect, normalizeEffects } from '../../effects';
import { Timeline, createId } from '../../model';
import type { Clip } from '../../model';
import { replaceClip } from '../../timeline';
import { Command } from '../command';
import { UpdateClipCommand } from './clip-update-commands';
import { TimelineAccessor, findClip } from './utils';

export class ApplyEffectPresetCommand implements Command {
  readonly description = 'Apply effect preset';
  private before?: Timeline;
  private after?: Timeline;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly preset: EffectPreset,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getTimeline();
    if (!this.after) {
      let timeline = this.before;
      const clip = findClip(timeline, this.clipId);
      const patch = buildEffectPresetClipPatch(this.preset, clip.duration);
      const commandAccessor: TimelineAccessor = {
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

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(this.before);
    }
  }
}

export interface AddEffectInput {
  id?: string;
  type: EffectType;
  enabled?: boolean;
  params?: EffectParams;
}

export class AddEffectCommand implements Command {
  readonly description = 'Add effect';
  private before?: Clip;
  private after?: Clip;
  private effect?: Effect;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: AddEffectInput,
  ) {}

  execute(): void {
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
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveEffectCommand implements Command {
  readonly description = 'Remove effect';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly effectId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const effects = cloneEffects(this.before.effects) ?? [];
    if (!effects.some((effect) => effect.id === this.effectId)) {
      throw new Error(`Effect ${this.effectId} not found`);
    }
    this.after = {
      ...this.before,
      effects: normalizeEffects(effects.filter((effect) => effect.id !== this.effectId)),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type EffectPatch = Partial<Pick<Effect, 'enabled' | 'params' | 'type'>>;

export class UpdateEffectCommand implements Command {
  readonly description = 'Update effect';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly effectId: string,
    private readonly patch: EffectPatch,
  ) {}

  execute(): void {
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
    this.after = { ...this.before, effects } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class ReorderEffectsCommand implements Command {
  readonly description = 'Reorder effects';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly orderedEffectIds: string[],
  ) {}

  execute(): void {
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
    this.after = { ...this.before, effects: reordered } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

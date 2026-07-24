import type { TimelineAccessor, ProjectAccessor } from "./index";
import { ClipMask, createMask, normalizeMask, normalizeMasks } from '../../model';
import type { Clip } from '../../model';
import { replaceClip } from '../../timeline';
import { Command } from '../command';
import { TimelineAccessor, findClip } from './utils';

export class AddMaskCommand implements Command {
  readonly description = 'Add mask';
  private before?: Clip;
  private after?: Clip;
  private mask?: ClipMask;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly input: Partial<ClipMask> = {},
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    this.mask ??= createMask(this.input);
    this.after = {
      ...this.before,
      masks: [...normalizeMasks(this.before.masks), this.mask],
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class RemoveMaskCommand implements Command {
  readonly description = 'Remove mask';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly maskId: string,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.filter((mask) => mask.id !== this.maskId),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export type MaskPatch = Partial<Omit<ClipMask, 'id'>>;

export class UpdateMaskCommand implements Command {
  readonly description = 'Update mask';
  private before?: Clip;
  private after?: Clip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly maskId: string,
    private readonly patch: MaskPatch,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= findClip(timeline, this.clipId);
    const masks = normalizeMasks(this.before.masks);
    if (!masks.some((mask) => mask.id === this.maskId)) {
      throw new Error(`Mask ${this.maskId} not found`);
    }
    this.after = {
      ...this.before,
      masks: masks.map((mask) =>
        mask.id === this.maskId ? normalizeMask({ ...mask, ...this.patch, id: mask.id }) : mask,
      ),
    } as Clip;
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

/**
 * Command merge utilities for operation coalescing.
 *
 * Provides reusable merge strategies for common timeline operations:
 * - Time-window merge: merge within 200ms
 * - Property change merge: consecutive changes to the same property
 * - Batch merge: group multiple operations into one undo step
 */

import type { Command } from './command';

// ==================== Merge Strategies ====================

/**
 * Property change command — supports merging consecutive changes
 * to the same property of the same entity.
 */
export class PropertyChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly entityId: string,
    private readonly propertyName: string,
    private readonly oldValue: unknown,
    private readonly newValue: unknown,
    private readonly applyFn: (entityId: string, value: unknown) => void,
    descriptionTemplate?: string,
  ) {
    this.description = descriptionTemplate
      ?? `修改 ${entityId}.${propertyName}`;
  }

  execute(): void {
    this.applyFn(this.entityId, this.newValue);
  }

  undo(): void {
    this.applyFn(this.entityId, this.oldValue);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof PropertyChangeCommand)) return null;
    if (other.entityId !== this.entityId) return null;
    if (other.propertyName !== this.propertyName) return null;

    // Merge: keep original old value, use new command's new value
    return new PropertyChangeCommand(
      this.entityId,
      this.propertyName,
      this.oldValue,
      other.newValue,
      this.applyFn,
      this.description,
    );
  }
}

/**
 * Position change command — merges consecutive position changes
 * (e.g., dragging a clip on the timeline).
 */
export class PositionChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly clipId: string,
    private readonly oldPosition: { start: number; trackIndex: number },
    private readonly newPosition: { start: number; trackIndex: number },
    private readonly applyFn: (clipId: string, pos: { start: number; trackIndex: number }) => void,
  ) {
    this.description = `移动片段 ${clipId}`;
  }

  execute(): void {
    this.applyFn(this.clipId, this.newPosition);
  }

  undo(): void {
    this.applyFn(this.clipId, this.oldPosition);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof PositionChangeCommand)) return null;
    if (other.clipId !== this.clipId) return null;

    // Merge: keep original start position, use latest end position
    return new PositionChangeCommand(
      this.clipId,
      this.oldPosition,
      other.newPosition,
      this.applyFn,
    );
  }
}

/**
 * Scale change command — merges consecutive scale/resize operations.
 */
export class ScaleChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly clipId: string,
    private readonly oldScale: number,
    private readonly newScale: number,
    private readonly applyFn: (clipId: string, scale: number) => void,
  ) {
    this.description = `缩放片段 ${clipId}`;
  }

  execute(): void {
    this.applyFn(this.clipId, this.newScale);
  }

  undo(): void {
    this.applyFn(this.clipId, this.oldScale);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof ScaleChangeCommand)) return null;
    if (other.clipId !== this.clipId) return null;

    return new ScaleChangeCommand(
      this.clipId,
      this.oldScale,
      other.newScale,
      this.applyFn,
    );
  }
}

/**
 * Volume change command — merges consecutive volume adjustments.
 */
export class VolumeChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly clipId: string,
    private readonly oldVolume: number,
    private readonly newVolume: number,
    private readonly applyFn: (clipId: string, volume: number) => void,
  ) {
    this.description = `调整音量 ${clipId}`;
  }

  execute(): void {
    this.applyFn(this.clipId, this.newVolume);
  }

  undo(): void {
    this.applyFn(this.clipId, this.oldVolume);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof VolumeChangeCommand)) return null;
    if (other.clipId !== this.clipId) return null;

    return new VolumeChangeCommand(
      this.clipId,
      this.oldVolume,
      other.newVolume,
      this.applyFn,
    );
  }
}

/**
 * Opacity change command — merges consecutive opacity adjustments.
 */
export class OpacityChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly clipId: string,
    private readonly oldOpacity: number,
    private readonly newOpacity: number,
    private readonly applyFn: (clipId: string, opacity: number) => void,
  ) {
    this.description = `调整透明度 ${clipId}`;
  }

  execute(): void {
    this.applyFn(this.clipId, this.newOpacity);
  }

  undo(): void {
    this.applyFn(this.clipId, this.oldOpacity);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof OpacityChangeCommand)) return null;
    if (other.clipId !== this.clipId) return null;

    return new OpacityChangeCommand(
      this.clipId,
      this.oldOpacity,
      other.newOpacity,
      this.applyFn,
    );
  }
}

/**
 * Playback rate change command — merges consecutive speed adjustments.
 */
export class PlaybackRateChangeCommand implements Command {
  readonly description: string;

  constructor(
    private readonly clipId: string,
    private readonly oldRate: number,
    private readonly newRate: number,
    private readonly applyFn: (clipId: string, rate: number) => void,
  ) {
    this.description = `调整速度 ${clipId}`;
  }

  execute(): void {
    this.applyFn(this.clipId, this.newRate);
  }

  undo(): void {
    this.applyFn(this.clipId, this.oldRate);
  }

  merge(other: Command): Command | null {
    if (!(other instanceof PlaybackRateChangeCommand)) return null;
    if (other.clipId !== this.clipId) return null;

    return new PlaybackRateChangeCommand(
      this.clipId,
      this.oldRate,
      other.newRate,
      this.applyFn,
    );
  }
}

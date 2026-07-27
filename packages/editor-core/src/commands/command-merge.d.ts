/**
 * Command merge utilities for operation coalescing.
 *
 * Provides reusable merge strategies for common timeline operations:
 * - Time-window merge: merge within 200ms
 * - Property change merge: consecutive changes to the same property
 * - Batch merge: group multiple operations into one undo step
 */
import type { Command } from './command';
/**
 * Property change command — supports merging consecutive changes
 * to the same property of the same entity.
 */
export declare class PropertyChangeCommand implements Command {
    private readonly entityId;
    private readonly propertyName;
    private readonly oldValue;
    private readonly newValue;
    private readonly applyFn;
    readonly description: string;
    constructor(entityId: string, propertyName: string, oldValue: unknown, newValue: unknown, applyFn: (entityId: string, value: unknown) => void, descriptionTemplate?: string);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
/**
 * Position change command — merges consecutive position changes
 * (e.g., dragging a clip on the timeline).
 */
export declare class PositionChangeCommand implements Command {
    private readonly clipId;
    private readonly oldPosition;
    private readonly newPosition;
    private readonly applyFn;
    readonly description: string;
    constructor(clipId: string, oldPosition: {
        start: number;
        trackIndex: number;
    }, newPosition: {
        start: number;
        trackIndex: number;
    }, applyFn: (clipId: string, pos: {
        start: number;
        trackIndex: number;
    }) => void);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
/**
 * Scale change command — merges consecutive scale/resize operations.
 */
export declare class ScaleChangeCommand implements Command {
    private readonly clipId;
    private readonly oldScale;
    private readonly newScale;
    private readonly applyFn;
    readonly description: string;
    constructor(clipId: string, oldScale: number, newScale: number, applyFn: (clipId: string, scale: number) => void);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
/**
 * Volume change command — merges consecutive volume adjustments.
 */
export declare class VolumeChangeCommand implements Command {
    private readonly clipId;
    private readonly oldVolume;
    private readonly newVolume;
    private readonly applyFn;
    readonly description: string;
    constructor(clipId: string, oldVolume: number, newVolume: number, applyFn: (clipId: string, volume: number) => void);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
/**
 * Opacity change command — merges consecutive opacity adjustments.
 */
export declare class OpacityChangeCommand implements Command {
    private readonly clipId;
    private readonly oldOpacity;
    private readonly newOpacity;
    private readonly applyFn;
    readonly description: string;
    constructor(clipId: string, oldOpacity: number, newOpacity: number, applyFn: (clipId: string, opacity: number) => void);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
/**
 * Playback rate change command — merges consecutive speed adjustments.
 */
export declare class PlaybackRateChangeCommand implements Command {
    private readonly clipId;
    private readonly oldRate;
    private readonly newRate;
    private readonly applyFn;
    readonly description: string;
    constructor(clipId: string, oldRate: number, newRate: number, applyFn: (clipId: string, rate: number) => void);
    execute(): void;
    undo(): void;
    merge(other: Command): Command | null;
}
//# sourceMappingURL=command-merge.d.ts.map
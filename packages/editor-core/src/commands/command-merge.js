/**
 * Command merge utilities for operation coalescing.
 *
 * Provides reusable merge strategies for common timeline operations:
 * - Time-window merge: merge within 200ms
 * - Property change merge: consecutive changes to the same property
 * - Batch merge: group multiple operations into one undo step
 */
// ==================== Merge Strategies ====================
/**
 * Property change command — supports merging consecutive changes
 * to the same property of the same entity.
 */
export class PropertyChangeCommand {
    entityId;
    propertyName;
    oldValue;
    newValue;
    applyFn;
    description;
    constructor(entityId, propertyName, oldValue, newValue, applyFn, descriptionTemplate) {
        this.entityId = entityId;
        this.propertyName = propertyName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.applyFn = applyFn;
        this.description = descriptionTemplate
            ?? `修改 ${entityId}.${propertyName}`;
    }
    execute() {
        this.applyFn(this.entityId, this.newValue);
    }
    undo() {
        this.applyFn(this.entityId, this.oldValue);
    }
    merge(other) {
        if (!(other instanceof PropertyChangeCommand))
            return null;
        if (other.entityId !== this.entityId)
            return null;
        if (other.propertyName !== this.propertyName)
            return null;
        // Merge: keep original old value, use new command's new value
        return new PropertyChangeCommand(this.entityId, this.propertyName, this.oldValue, other.newValue, this.applyFn, this.description);
    }
}
/**
 * Position change command — merges consecutive position changes
 * (e.g., dragging a clip on the timeline).
 */
export class PositionChangeCommand {
    clipId;
    oldPosition;
    newPosition;
    applyFn;
    description;
    constructor(clipId, oldPosition, newPosition, applyFn) {
        this.clipId = clipId;
        this.oldPosition = oldPosition;
        this.newPosition = newPosition;
        this.applyFn = applyFn;
        this.description = `移动片段 ${clipId}`;
    }
    execute() {
        this.applyFn(this.clipId, this.newPosition);
    }
    undo() {
        this.applyFn(this.clipId, this.oldPosition);
    }
    merge(other) {
        if (!(other instanceof PositionChangeCommand))
            return null;
        if (other.clipId !== this.clipId)
            return null;
        // Merge: keep original start position, use latest end position
        return new PositionChangeCommand(this.clipId, this.oldPosition, other.newPosition, this.applyFn);
    }
}
/**
 * Scale change command — merges consecutive scale/resize operations.
 */
export class ScaleChangeCommand {
    clipId;
    oldScale;
    newScale;
    applyFn;
    description;
    constructor(clipId, oldScale, newScale, applyFn) {
        this.clipId = clipId;
        this.oldScale = oldScale;
        this.newScale = newScale;
        this.applyFn = applyFn;
        this.description = `缩放片段 ${clipId}`;
    }
    execute() {
        this.applyFn(this.clipId, this.newScale);
    }
    undo() {
        this.applyFn(this.clipId, this.oldScale);
    }
    merge(other) {
        if (!(other instanceof ScaleChangeCommand))
            return null;
        if (other.clipId !== this.clipId)
            return null;
        return new ScaleChangeCommand(this.clipId, this.oldScale, other.newScale, this.applyFn);
    }
}
/**
 * Volume change command — merges consecutive volume adjustments.
 */
export class VolumeChangeCommand {
    clipId;
    oldVolume;
    newVolume;
    applyFn;
    description;
    constructor(clipId, oldVolume, newVolume, applyFn) {
        this.clipId = clipId;
        this.oldVolume = oldVolume;
        this.newVolume = newVolume;
        this.applyFn = applyFn;
        this.description = `调整音量 ${clipId}`;
    }
    execute() {
        this.applyFn(this.clipId, this.newVolume);
    }
    undo() {
        this.applyFn(this.clipId, this.oldVolume);
    }
    merge(other) {
        if (!(other instanceof VolumeChangeCommand))
            return null;
        if (other.clipId !== this.clipId)
            return null;
        return new VolumeChangeCommand(this.clipId, this.oldVolume, other.newVolume, this.applyFn);
    }
}
/**
 * Opacity change command — merges consecutive opacity adjustments.
 */
export class OpacityChangeCommand {
    clipId;
    oldOpacity;
    newOpacity;
    applyFn;
    description;
    constructor(clipId, oldOpacity, newOpacity, applyFn) {
        this.clipId = clipId;
        this.oldOpacity = oldOpacity;
        this.newOpacity = newOpacity;
        this.applyFn = applyFn;
        this.description = `调整透明度 ${clipId}`;
    }
    execute() {
        this.applyFn(this.clipId, this.newOpacity);
    }
    undo() {
        this.applyFn(this.clipId, this.oldOpacity);
    }
    merge(other) {
        if (!(other instanceof OpacityChangeCommand))
            return null;
        if (other.clipId !== this.clipId)
            return null;
        return new OpacityChangeCommand(this.clipId, this.oldOpacity, other.newOpacity, this.applyFn);
    }
}
/**
 * Playback rate change command — merges consecutive speed adjustments.
 */
export class PlaybackRateChangeCommand {
    clipId;
    oldRate;
    newRate;
    applyFn;
    description;
    constructor(clipId, oldRate, newRate, applyFn) {
        this.clipId = clipId;
        this.oldRate = oldRate;
        this.newRate = newRate;
        this.applyFn = applyFn;
        this.description = `调整速度 ${clipId}`;
    }
    execute() {
        this.applyFn(this.clipId, this.newRate);
    }
    undo() {
        this.applyFn(this.clipId, this.oldRate);
    }
    merge(other) {
        if (!(other instanceof PlaybackRateChangeCommand))
            return null;
        if (other.clipId !== this.clipId)
            return null;
        return new PlaybackRateChangeCommand(this.clipId, this.oldRate, other.newRate, this.applyFn);
    }
}
//# sourceMappingURL=command-merge.js.map
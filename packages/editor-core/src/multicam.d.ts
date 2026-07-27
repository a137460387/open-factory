import { type MulticamAngle, type MulticamClip, type MulticamClipAngle, type MulticamSequence, type MulticamSwitch, type Project, type SwitchPoint } from './model';
export interface MulticamCreateOptions {
    sequenceName?: string;
    offsetsByClipId?: Record<string, number>;
}
export interface MulticamCreateResult {
    project: Project;
    multicamClipId: string;
    sequenceId: string;
}
export interface MulticamSwitchHistoryEntry {
    switchId: string;
    time: number;
    endTime: number;
    duration: number;
    angleId: string;
    angleName: string;
    angleIndex: number;
    timecode: string;
    durationTimecode: string;
    tooFrequent: boolean;
}
export interface MulticamSwitchWarning {
    fromSwitchId: string;
    toSwitchId: string;
    frameGap: number;
}
export interface ParsedMulticamTimecode {
    raw: string;
    seconds: number;
    totalFrames: number;
    hours: number;
    minutes: number;
    secondsPart: number;
    frames: number;
}
export interface MulticamTimecodeSyncPoint {
    clipId: string;
    timecode: string;
}
export interface MulticamManualSyncPoint {
    clipId: string;
    markerTime: number;
}
export declare function calculateAudioAlignmentOffset(reference: ArrayLike<number>, candidate: ArrayLike<number>, sampleRate: number, maxOffsetSeconds?: number): number;
export declare function parseLtcTimecode(value: string, fps?: number): ParsedMulticamTimecode | undefined;
export declare const parseVitcTimecode: typeof parseLtcTimecode;
export declare function calculateTimecodeAlignmentOffsets(points: MulticamTimecodeSyncPoint[], referenceClipId: string, fps?: number): Record<string, number>;
export declare function calculateManualMarkerAlignmentOffsets(points: MulticamManualSyncPoint[], referenceClipId: string): Record<string, number>;
export declare function setMulticamSwitch(multicam: MulticamSequence, time: number, angleId: string, duration: number): MulticamSwitch[];
export declare function getActiveMulticamAngle(multicam: MulticamSequence, time: number): MulticamAngle;
export declare function buildMulticamSwitchHistory(multicam: MulticamSequence, duration: number, fps?: number): MulticamSwitchHistoryEntry[];
export declare function serializeMulticamSwitchHistory(multicam: MulticamSequence, duration: number, fps?: number): string;
export declare function findFrequentMulticamSwitchWarnings(multicam: MulticamSequence, duration: number, fps?: number, minFrames?: number): MulticamSwitchWarning[];
export declare function trimMulticamSwitch(multicam: MulticamSequence, switchId: string, frameDelta: number, fps: number, duration: number): MulticamSwitch[];
export declare function createMulticamSequenceProject(project: Project, clipIds: string[], options?: MulticamCreateOptions): MulticamCreateResult;
export declare function flattenMulticamProjectForExport(project: Project): Project;
/**
 * Get the active angle at a given time for a MulticamClip.
 * Switch points are assumed to be sorted by time.
 */
export declare function getActiveAngleAtTime(multicamClip: MulticamClip, time: number): MulticamClipAngle;
/**
 * Add a switch point to the array, maintaining sorted order by time.
 * If a switch point at the same time already exists, it is replaced.
 * Returns a new array (immutable).
 */
export declare function addSwitchPoint(switchPoints: SwitchPoint[], switchPoint: SwitchPoint): SwitchPoint[];
/**
 * Delete a switch point by index.
 * Returns a new array (immutable).
 * Throws if the index is out of range.
 */
export declare function deleteSwitchPoint(switchPoints: SwitchPoint[], index: number): SwitchPoint[];
/**
 * Update a switch point at the given index with partial updates.
 * If the time is changed, the array is re-sorted.
 * Returns a new array (immutable).
 * Throws if the index is out of range.
 */
export declare function updateSwitchPoint(switchPoints: SwitchPoint[], index: number, updates: Partial<SwitchPoint>): SwitchPoint[];
//# sourceMappingURL=multicam.d.ts.map
import type { Command } from './commands/command';
import type { Project } from './model';
export declare const OPERATION_RECORDING_FORMAT = "open-factory-operation-recording";
export declare const OPERATION_RECORDING_EXTENSION = "ofrecording.json";
export type OperationReplaySpeed = 1 | 2 | 4;
export interface RecordedOperationCommand {
    id: string;
    index: number;
    commandType: string;
    description: string;
    timestampMs: number;
    relativeTimeMs: number;
    payload?: unknown;
    projectAfter: Project;
}
export interface OperationRecordingFile {
    format: typeof OPERATION_RECORDING_FORMAT;
    version: 1;
    createdAt: string;
    startedAtMs: number;
    initialProject: Project;
    commands: RecordedOperationCommand[];
}
export interface OperationRecordingSlide {
    stepIndex: number;
    title: string;
    description: string;
    clipCount: number;
    trackCount: number;
    timestampMs: number;
}
export declare function createOperationRecording(initialProject: Project, options?: {
    createdAt?: string;
    startedAtMs?: number;
}): OperationRecordingFile;
export declare function recordOperationCommand(recording: OperationRecordingFile, command: Command, projectAfter: Project, timestampMs?: number): OperationRecordingFile;
export declare function serializeOperationRecording(recording: OperationRecordingFile): string;
export declare function parseOperationRecording(raw: string): OperationRecordingFile | undefined;
export declare function normalizeOperationRecording(input: unknown): OperationRecordingFile;
export declare function getOperationReplayDelayMs(previous: RecordedOperationCommand | undefined, next: RecordedOperationCommand, speed: OperationReplaySpeed): number;
export declare function buildOperationReplaySchedule(recording: OperationRecordingFile, speed: OperationReplaySpeed): Array<{
    index: number;
    delayMs: number;
}>;
export declare function getOperationProjectAtStep(recording: OperationRecordingFile, stepIndex: number): Project;
export declare function replayOperationRecording(recording: OperationRecordingFile, applyProject: (project: Project, command: RecordedOperationCommand, index: number) => void, upToIndex?: number): void;
export declare function buildOperationRecordingSlides(recording: OperationRecordingFile, everyNSteps?: number): OperationRecordingSlide[];
export declare function generateOperationRecordingSlidesHtml(recording: OperationRecordingFile, everyNSteps?: number): string;
export declare function normalizeOperationReplaySpeed(value: unknown): OperationReplaySpeed;
//# sourceMappingURL=operation-recording.d.ts.map
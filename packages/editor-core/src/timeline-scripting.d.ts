import type { Command } from './commands/command';
import { type AddTimelineMarkerInput, type ClipPatch, type TimelineAccessor } from './commands/timeline-commands';
import type { Clip, Project, TimelineMarker } from './model';
export type TimelineScriptApiFunctionName = 'getClips' | 'updateClip' | 'addClip' | 'deleteClip' | 'getMarkers' | 'addMarker' | 'exportProject';
export interface TimelineScriptApiSignature {
    name: TimelineScriptApiFunctionName;
    signature: string;
    description: string;
}
export declare const TIMELINE_SCRIPT_API_SIGNATURES: TimelineScriptApiSignature[];
export interface BuiltinTimelineScript {
    id: string;
    code: string;
}
export declare const BUILTIN_TIMELINE_SCRIPTS: BuiltinTimelineScript[];
export interface TimelineScriptSnapshot {
    clips: Clip[];
    markers: TimelineMarker[];
    duration: number;
}
export type TimelineScriptOperation = {
    type: 'updateClip';
    clipId: string;
    patch: ClipPatch;
} | {
    type: 'addClip';
    clip: Clip;
} | {
    type: 'deleteClip';
    clipId: string;
} | {
    type: 'addMarker';
    marker: AddTimelineMarkerInput;
} | {
    type: 'exportProject';
    preset: string;
};
export interface TimelineScriptExecutionPlan {
    operations: TimelineScriptOperation[];
    logs: string[];
    durationMs: number;
}
export declare function createTimelineScriptSnapshot(project: Pick<Project, 'timeline'>): TimelineScriptSnapshot;
export declare function getTimelineScriptApiFunctionNames(): TimelineScriptApiFunctionName[];
export declare function normalizeTimelineScriptOperations(operations: TimelineScriptOperation[]): TimelineScriptOperation[];
export declare function getTimelineScriptExportRequests(operations: TimelineScriptOperation[]): Array<Extract<TimelineScriptOperation, {
    type: 'exportProject';
}>>;
export declare class RunScriptCommand implements Command {
    private readonly accessor;
    private readonly operations;
    readonly description: string;
    private before?;
    private after?;
    private appliedCount;
    constructor(accessor: TimelineAccessor, operations: TimelineScriptOperation[], description?: string);
    get appliedOperationCount(): number;
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=timeline-scripting.d.ts.map
import type { TimelineAccessor } from './index';
import { ClipBorder } from '../../model';
import { PiPLayoutPosition } from '../../pip-layout';
import { SplitLayoutDefinition } from '../../split-layout';
import { Command } from '../command';
export interface PiPLayoutCommandOptions {
    position?: PiPLayoutPosition;
    canvasWidth: number;
    canvasHeight: number;
    pipSourceWidth: number;
    pipSourceHeight: number;
    scale?: number;
    margin?: number;
    border?: Partial<ClipBorder>;
}
export declare class PiPLayoutCommand implements Command {
    private readonly accessor;
    private readonly mainClipId;
    private readonly pipClipId;
    private readonly options;
    readonly description = "Apply PiP layout";
    private before?;
    constructor(accessor: TimelineAccessor, mainClipId: string, pipClipId: string, options: PiPLayoutCommandOptions);
    execute(): void;
    undo(): void;
}
export interface ApplySplitLayoutCommandOptions {
    layout: SplitLayoutDefinition;
    canvasWidth: number;
    canvasHeight: number;
    sources?: Record<string, {
        width?: number;
        height?: number;
    }>;
}
export declare class ApplySplitLayoutCommand implements Command {
    private readonly accessor;
    private readonly clipIds;
    private readonly options;
    readonly description = "Apply split-screen layout";
    private before?;
    constructor(accessor: TimelineAccessor, clipIds: string[], options: ApplySplitLayoutCommandOptions);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-layout-commands.d.ts.map
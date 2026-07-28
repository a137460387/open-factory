import type { ProjectAccessor } from './index';
import { FcpXmlImportOptions, FcpXmlImportResult } from '../../export/fcpxml-import';
import { Cmx3600EdlImportOptions, Cmx3600EdlImportResult } from '../../export/timeline-import';
import { Project, ProjectDocumentation, ProjectSettings, ProjectSpeaker } from '../../model';
import { SequenceSettings } from '../../model-types';
import { ConformMediaReplacement } from '../../project/conform-media';
import { Command } from '../command';
export declare class NewProjectCommand implements Command {
    private readonly accessor;
    private readonly nextProject;
    description: string;
    private before?;
    constructor(accessor: ProjectAccessor, nextProject: Project, description?: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectSpeakerLabelsCommand implements Command {
    private readonly accessor;
    private readonly speakerLabels;
    readonly description = "Update project speaker labels";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, speakerLabels: Record<number, string>);
    execute(): void;
    undo(): void;
}
/** 更新序列独立设置（帧率/分辨率/时长） */
export declare class UpdateSequenceSettingsCommand implements Command {
    private readonly accessor;
    private readonly sequenceId;
    private readonly newSettings;
    readonly description: string;
    private before?;
    constructor(accessor: ProjectAccessor, sequenceId: string, newSettings: SequenceSettings | undefined);
    execute(): void;
    undo(): void;
}
/** 批量设置所有轨道高度 */
export declare class BatchUpdateTrackHeightCommand implements Command {
    private readonly accessor;
    readonly description: string;
    private before?;
    private readonly height;
    constructor(accessor: ProjectAccessor, height: number);
    execute(): void;
    undo(): void;
}
export declare class LoadProjectCommand implements Command {
    private readonly accessor;
    private readonly nextProject;
    description: string;
    private before?;
    constructor(accessor: ProjectAccessor, nextProject: Project, description?: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectSettingsCommand implements Command {
    private readonly accessor;
    private readonly patch;
    readonly description = "Update project settings";
    private before?;
    constructor(accessor: ProjectAccessor, patch: Partial<ProjectSettings>);
    execute(): void;
    undo(): void;
}
export declare class ConformMediaCommand implements Command {
    private readonly accessor;
    private readonly replacements;
    description: string;
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, replacements: ConformMediaReplacement[], description?: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectReleaseVersionCommand implements Command {
    private readonly accessor;
    private readonly releaseVersion;
    readonly description = "Update project release version";
    private before?;
    constructor(accessor: ProjectAccessor, releaseVersion: string);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectCoverCommand implements Command {
    private readonly accessor;
    private readonly coverPath?;
    readonly description = "Update project cover";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, coverPath?: string | undefined);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectSpeakersCommand implements Command {
    private readonly accessor;
    private readonly speakers;
    readonly description = "Update project speakers";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, speakers: ProjectSpeaker[]);
    execute(): void;
    undo(): void;
}
export declare class UpdateProjectDocumentationCommand implements Command {
    private readonly accessor;
    private readonly documentation;
    readonly description = "Update project documentation";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, documentation: ProjectDocumentation);
    execute(): void;
    undo(): void;
}
export declare class ImportEDLCommand implements Command {
    private readonly accessor;
    private readonly contents;
    private readonly options;
    readonly description = "Import EDL";
    private before?;
    private after?;
    private importResult?;
    constructor(accessor: ProjectAccessor, contents: string, options?: Cmx3600EdlImportOptions);
    get result(): Cmx3600EdlImportResult | undefined;
    execute(): void;
    undo(): void;
}
export declare class ImportFCPXMLCommand implements Command {
    private readonly accessor;
    private readonly contents;
    private readonly options;
    readonly description = "Import FCPXML";
    private before?;
    private after?;
    private importResult?;
    constructor(accessor: ProjectAccessor, contents: string, options?: FcpXmlImportOptions);
    get result(): FcpXmlImportResult | undefined;
    execute(): void;
    undo(): void;
}
export type ProjectAudioPatch = Partial<Pick<Project, 'masterVolume'>>;
export declare class UpdateProjectAudioCommand implements Command {
    private readonly accessor;
    private readonly patch;
    readonly description = "Update project audio";
    private before?;
    private after?;
    constructor(accessor: ProjectAccessor, patch: ProjectAudioPatch);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=project-commands.d.ts.map
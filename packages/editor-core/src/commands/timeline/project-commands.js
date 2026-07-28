import { applyFcpXmlImport, buildFcpXmlImport } from '../../export/fcpxml-import';
import { applyCmx3600EdlImport, buildCmx3600EdlImport } from '../../export/timeline-import';
import { normalizeMasterVolume, normalizeProjectSettings, normalizeProjectSpeakers } from '../../model';
import { applyConformMedia } from '../../project/conform-media';
import { normalizeProjectDocumentation } from '../../project/documentation';
import { normalizeProjectReleaseVersion } from '../../project/release-workflow';
import { recalculateClipStartsForFrameRate } from '../../sequence-settings';
import { clampTrackHeight } from '../../track-height';
export class NewProjectCommand {
    accessor;
    nextProject;
    description;
    before;
    constructor(accessor, nextProject, description = 'New project') {
        this.accessor = accessor;
        this.nextProject = nextProject;
        this.description = description;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(this.nextProject);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectSpeakerLabelsCommand {
    accessor;
    speakerLabels;
    description = 'Update project speaker labels';
    before;
    after;
    constructor(accessor, speakerLabels) {
        this.accessor = accessor;
        this.speakerLabels = speakerLabels;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        this.after = {
            ...project,
            speakerLabels: { ...this.speakerLabels },
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/** 更新序列独立设置（帧率/分辨率/时长） */
export class UpdateSequenceSettingsCommand {
    accessor;
    sequenceId;
    newSettings;
    description;
    before;
    constructor(accessor, sequenceId, newSettings) {
        this.accessor = accessor;
        this.sequenceId = sequenceId;
        this.newSettings = newSettings;
        this.description = 'Update sequence settings';
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        const oldSequence = project.sequences.find((s) => s.id === this.sequenceId);
        if (!oldSequence)
            return;
        const oldSettings = oldSequence.settings;
        const oldFps = oldSettings?.frameRate ?? project.settings.fps;
        const newFps = this.newSettings?.frameRate ?? project.settings.fps;
        const sequences = project.sequences.map((seq) => {
            if (seq.id !== this.sequenceId)
                return seq;
            return { ...seq, settings: this.newSettings };
        });
        // 帧率变更时重新对齐 clip 位置
        if (oldFps !== newFps) {
            for (const seq of sequences) {
                if (seq.id !== this.sequenceId)
                    continue;
                recalculateClipStartsForFrameRate(seq.timeline, oldFps, newFps);
            }
        }
        // 如果当前活跃序列就是被修改的序列，同步 timeline
        let timeline = project.timeline;
        if (project.activeSequenceId === this.sequenceId) {
            const activeSeq = sequences.find((s) => s.id === this.sequenceId);
            if (activeSeq)
                timeline = activeSeq.timeline;
        }
        this.accessor.setProject({
            ...project,
            timeline,
            sequences,
            updatedAt: new Date().toISOString(),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
/** 批量设置所有轨道高度 */
export class BatchUpdateTrackHeightCommand {
    accessor;
    description;
    before;
    height;
    constructor(accessor, height) {
        this.accessor = accessor;
        this.description = 'Batch update track height';
        this.height = clampTrackHeight(height);
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        const tracks = project.timeline.tracks.map((track) => ({
            ...track,
            displayHeight: this.height,
        }));
        this.accessor.setProject({
            ...project,
            timeline: { ...project.timeline, tracks },
            updatedAt: new Date().toISOString(),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class LoadProjectCommand {
    accessor;
    nextProject;
    description;
    before;
    constructor(accessor, nextProject, description = 'Load project') {
        this.accessor = accessor;
        this.nextProject = nextProject;
        this.description = description;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        this.accessor.setProject(this.nextProject);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectSettingsCommand {
    accessor;
    patch;
    description = 'Update project settings';
    before;
    constructor(accessor, patch) {
        this.accessor = accessor;
        this.patch = patch;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject({
            ...project,
            settings: normalizeProjectSettings({ ...project.settings, ...this.patch }),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class ConformMediaCommand {
    accessor;
    replacements;
    description;
    before;
    after;
    constructor(accessor, replacements, description = 'Conform media') {
        this.accessor = accessor;
        this.replacements = replacements;
        this.description = description;
    }
    execute() {
        if (this.after) {
            this.accessor.setProject(this.after);
            return;
        }
        this.before ??= this.accessor.getProject();
        this.after = {
            ...applyConformMedia(this.accessor.getProject(), this.replacements),
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectReleaseVersionCommand {
    accessor;
    releaseVersion;
    description = 'Update project release version';
    before;
    constructor(accessor, releaseVersion) {
        this.accessor = accessor;
        this.releaseVersion = releaseVersion;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject({
            ...project,
            releaseVersion: normalizeProjectReleaseVersion(this.releaseVersion),
            updatedAt: new Date().toISOString(),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectCoverCommand {
    accessor;
    coverPath;
    description = 'Update project cover';
    before;
    after;
    constructor(accessor, coverPath) {
        this.accessor = accessor;
        this.coverPath = coverPath;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        const normalized = typeof this.coverPath === 'string' && this.coverPath.trim()
            ? this.coverPath.trim().replace(/\\/g, '/')
            : undefined;
        this.after = {
            ...this.before,
            coverPath: normalized,
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectSpeakersCommand {
    accessor;
    speakers;
    description = 'Update project speakers';
    before;
    after;
    constructor(accessor, speakers) {
        this.accessor = accessor;
        this.speakers = speakers;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        this.after = {
            ...project,
            speakers: normalizeProjectSpeakers(this.speakers),
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectDocumentationCommand {
    accessor;
    documentation;
    description = 'Update project documentation';
    before;
    after;
    constructor(accessor, documentation) {
        this.accessor = accessor;
        this.documentation = documentation;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        this.after = {
            ...project,
            documentation: normalizeProjectDocumentation(this.documentation),
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class ImportEDLCommand {
    accessor;
    contents;
    options;
    description = 'Import EDL';
    before;
    after;
    importResult;
    constructor(accessor, contents, options = {}) {
        this.accessor = accessor;
        this.contents = contents;
        this.options = options;
    }
    get result() {
        return this.importResult;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            this.importResult = buildCmx3600EdlImport(this.before, this.contents, this.options);
            this.after = applyCmx3600EdlImport(this.before, this.importResult);
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class ImportFCPXMLCommand {
    accessor;
    contents;
    options;
    description = 'Import FCPXML';
    before;
    after;
    importResult;
    constructor(accessor, contents, options = {}) {
        this.accessor = accessor;
        this.contents = contents;
        this.options = options;
    }
    get result() {
        return this.importResult;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            this.importResult = buildFcpXmlImport(this.before, this.contents, this.options);
            this.after = applyFcpXmlImport(this.before, this.importResult);
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectAudioCommand {
    accessor;
    patch;
    description = 'Update project audio';
    before;
    after;
    constructor(accessor, patch) {
        this.accessor = accessor;
        this.patch = patch;
    }
    execute() {
        const project = this.accessor.getProject();
        this.before ??= project;
        this.after = {
            ...this.before,
            ...this.patch,
            masterVolume: this.patch.masterVolume === undefined
                ? this.before.masterVolume
                : normalizeMasterVolume(this.patch.masterVolume),
            updatedAt: new Date().toISOString(),
        };
        this.accessor.setProject(this.after);
    }
    undo() {
        if (!this.before) {
            return;
        }
        this.accessor.setProject(this.before);
    }
}
//# sourceMappingURL=project-commands.js.map
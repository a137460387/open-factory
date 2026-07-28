import { touchProject } from './utils';
export class AddSubclipCommand {
    accessor;
    subclip;
    description;
    before;
    constructor(accessor, subclip) {
        this.accessor = accessor;
        this.subclip = subclip;
        this.description = `Add subclip "${subclip.name}"`;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject({
            ...project,
            subclips: [...(project.subclips ?? []), this.subclip],
            updatedAt: new Date().toISOString(),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateSubclipCommand {
    accessor;
    subclipId;
    patch;
    description;
    before;
    constructor(accessor, subclipId, patch) {
        this.accessor = accessor;
        this.subclipId = subclipId;
        this.patch = patch;
        this.description = `Update subclip`;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        const subclips = (project.subclips ?? []).map((s) => {
            if (s.id !== this.subclipId)
                return s;
            return {
                ...s,
                ...(this.patch.name !== undefined ? { name: this.patch.name } : {}),
                ...(this.patch.inPoint !== undefined ? { inPoint: Math.max(0, this.patch.inPoint) } : {}),
                ...(this.patch.outPoint !== undefined ? { outPoint: Math.max(s.inPoint, this.patch.outPoint) } : {}),
                ...(this.patch.color !== undefined ? { color: this.patch.color } : {}),
                ...(this.patch.description !== undefined ? { description: this.patch.description } : {}),
            };
        });
        this.accessor.setProject({ ...project, subclips, updatedAt: new Date().toISOString() });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class DeleteSubclipCommand {
    accessor;
    subclipId;
    description;
    before;
    constructor(accessor, subclipId) {
        this.accessor = accessor;
        this.subclipId = subclipId;
        this.description = `Delete subclip`;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject({
            ...project,
            subclips: (project.subclips ?? []).filter((s) => s.id !== this.subclipId),
            updatedAt: new Date().toISOString(),
        });
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectBeatSnapSuggestionsCommand {
    accessor;
    suggestions;
    description = 'Update beat snap suggestions';
    before;
    constructor(accessor, suggestions) {
        this.accessor = accessor;
        this.suggestions = suggestions;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({ ...project, beatSnapSuggestions: [...this.suggestions] }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class UpdateProjectMediaCollectionsCommand {
    accessor;
    collections;
    description = 'Update media collections';
    before;
    constructor(accessor, collections) {
        this.accessor = accessor;
        this.collections = collections;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        const project = this.accessor.getProject();
        this.accessor.setProject(touchProject({ ...project, mediaCollections: [...this.collections] }));
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
// ── Independent MulticamClip commands ──
/**
 * 创建独立多机位片段命令
 */
//# sourceMappingURL=subclip-commands.js.map
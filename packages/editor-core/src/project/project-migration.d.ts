import type { Project } from '../model-types';
import type { MigrationResult, ProjectFile, ProjectFileV1, ProjectFileV2 } from './project-types';
export declare function serializeProjectFile(project: Project, projectPath?: string): ProjectFileV2;
export declare function serializeProject(project: Project, projectPath?: string): ProjectFileV2;
export declare function deserializeProject(file: ProjectFile, projectPath?: string): Project;
export declare function migrateProjectFile(file: ProjectFile, projectPath?: string): MigrationResult;
export declare function isProjectFileV2(file: ProjectFile | unknown): file is ProjectFileV2;
export declare function isProjectFileV1(file: ProjectFile | unknown): file is ProjectFileV1;
//# sourceMappingURL=project-migration.d.ts.map
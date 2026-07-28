import type { Project, ProjectDocumentation } from '../model-types';
export declare const PROJECT_DOCUMENTATION_SECTIONS: readonly [{
    readonly id: "description";
    readonly title: "项目说明";
}, {
    readonly id: "notes";
    readonly title: "制作备注";
}, {
    readonly id: "copyright";
    readonly title: "版权信息";
}, {
    readonly id: "approvals";
    readonly title: "审批记录";
}];
export type ProjectDocumentationSectionId = (typeof PROJECT_DOCUMENTATION_SECTIONS)[number]['id'];
export declare function normalizeProjectDocumentation(input: unknown): ProjectDocumentation;
export declare function renderSimpleMarkdown(markdown: string): string;
export declare function buildProjectDocumentationHtml(project: Project): string;
//# sourceMappingURL=documentation.d.ts.map
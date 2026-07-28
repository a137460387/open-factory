export interface NamingTemplateVariable {
    key: string;
    label: string;
    placeholder: string;
}
export declare const NAMING_TEMPLATE_VARIABLES: NamingTemplateVariable[];
export interface NamingTemplateContext {
    projectName: string;
    presetName: string;
    date?: string;
    time?: string;
    index?: number;
    indexPadding?: number;
    indexStart?: number;
    resolution?: string;
    fps?: number;
    customText?: string;
    dateFormat?: 'YYYYMMDD' | 'YYYY-MM-DD';
}
export interface NamingTemplateConfig {
    template: string;
    indexStart?: number;
    indexPadding?: number;
    dateFormat?: 'YYYYMMDD' | 'YYYY-MM-DD';
    customText?: string;
}
export declare const DEFAULT_NAMING_TEMPLATE: NamingTemplateConfig;
export declare function formatDateForNaming(date: Date, format: 'YYYYMMDD' | 'YYYY-MM-DD'): string;
export declare function formatTimeForNaming(date: Date): string;
export declare function formatIndexForNaming(index: number, padding: number): string;
export declare function resolveNamingTemplate(config: NamingTemplateConfig, context: NamingTemplateContext): string;
export declare function resolveNamingTemplateBatch(config: NamingTemplateConfig, baseContext: Omit<NamingTemplateContext, 'index'>, count: number): string[];
export declare function previewNamingTemplate(config: NamingTemplateConfig): string;
export declare function serializeNamingTemplateConfig(config: NamingTemplateConfig): string;
export declare function deserializeNamingTemplateConfig(json: string): NamingTemplateConfig | undefined;
//# sourceMappingURL=naming-template.d.ts.map
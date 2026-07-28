import { type ExportPublishPlatform, type ExportPublishSmtpSettings, type ExportPublishWebhookSettings, type ExportPublishWindow } from './publish-pipeline';
export type ExportPipelineNodeType = 'export-mp4' | 'generate-gif' | 'extract-cover' | 'quality-check' | 'script-hook' | 'webdav-upload' | 'notification' | 'publish-platform' | 'email-notification' | 'webhook-callback' | 'write-release-record';
export type ExportPipelineCondition = 'on-success' | 'on-failure' | 'always';
export type ExportPipelineNodeStatus = 'waiting' | 'running' | 'complete' | 'failed' | 'skipped';
export interface ExportPipelineNode {
    id: string;
    type: ExportPipelineNodeType;
    name: string;
    condition?: ExportPipelineCondition;
    retryOnFailure?: boolean;
    script?: string;
    platform?: ExportPublishPlatform;
    smtp?: ExportPublishSmtpSettings;
    webhook?: ExportPublishWebhookSettings;
    publishWindow?: ExportPublishWindow;
}
export interface ExportPipelineEdge {
    from: string;
    to: string;
}
export interface ExportPipeline {
    id: string;
    name: string;
    nodes: ExportPipelineNode[];
    edges: ExportPipelineEdge[];
}
export declare class ExportPipelineCycleError extends Error {
    readonly cycleIds: string[];
    constructor(cycleIds: string[]);
}
export declare function createTwoStepExportPipeline(name?: string): ExportPipeline;
export declare function createPublishAutomationPipeline(name?: string): ExportPipeline;
export declare function normalizeExportPipeline(input: Partial<ExportPipeline> | undefined): ExportPipeline;
export declare function serializeExportPipeline(pipeline: ExportPipeline): string;
export declare function parseExportPipeline(contents: string): ExportPipeline;
export declare function topologicallySortExportPipeline(pipeline: ExportPipeline): ExportPipelineNode[];
export declare function getPipelineUpstreamNodeIds(pipeline: ExportPipeline, nodeId: string): string[];
export declare function shouldRunExportPipelineNode(node: Pick<ExportPipelineNode, 'condition'>, upstreamStatuses: readonly ExportPipelineNodeStatus[]): boolean;
//# sourceMappingURL=pipeline.d.ts.map
/**
 * 发布管线共享类型 — 零本地依赖叶节点。
 * publish-pipeline.ts 和 release-workflow.ts 共同依赖此文件，避免循环引用。
 */

export type ExportPublishNodeType =
  'publish-platform' | 'email-notification' | 'webhook-callback' | 'write-release-record';
export type ExportPublishNodeStatus = 'success' | 'failed' | 'skipped';

export interface ExportPublishNodeLog {
  nodeId: string;
  nodeType: ExportPublishNodeType;
  status: ExportPublishNodeStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message: string;
}

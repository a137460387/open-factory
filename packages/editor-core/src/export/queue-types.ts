/**
 * 导出队列共享类型 — 仅依赖 export-types 和 progressive/render-farm，
 * 不依赖 export-queue.ts 运行时。
 * scheduling.ts 和 versioned-batch.ts 导入 ExportTask 类型时从此文件读取，
 * 避免与 export-queue.ts 形成循环引用。
 */

import type { ExportReport, FfmpegExportPlan } from './export-types';
import type { ProgressiveExportState } from './progressive';
import type { RenderFarmSegmentStatus, RenderFarmTaskConfig } from './render-farm';

export type ExportTaskStatus = 'scheduled' | 'pending' | 'running' | 'interrupted' | 'canceled' | 'error' | 'success';
export type ExportTaskPriority = 'high' | 'normal' | 'low';
export type ExportUploadTargetType = 'webdav' | 'local';
export type ExportUploadStatus = 'pending' | 'running' | 'success' | 'error';

export interface ExportUploadState {
  targetType: ExportUploadTargetType;
  status: ExportUploadStatus;
  progress: number;
  attempts: number;
  destination?: string;
  error?: string;
  updatedAt: string;
}

/** versioned-batch 模块使用的批次元数据，从 versioned-batch.ts 提取到此处消除循环 */
export interface VersionedExportTaskMetadata {
  batchId: string;
  versionId: string;
  versionName: string;
  platform?: string;
  language?: string;
}

export interface ExportTask {
  id: string;
  name: string;
  projectName?: string;
  outputPath: string;
  plan: FfmpegExportPlan;
  priority: ExportTaskPriority;
  status: ExportTaskStatus;
  progress: number;
  createdAt: string;
  scheduledStartAt?: string;
  startedAt?: string;
  finishedAt?: string;
  logPath?: string;
  error?: string;
  report?: ExportReport;
  renderFarm?: RenderFarmTaskConfig;
  segments?: RenderFarmSegmentStatus[];
  progressive?: ProgressiveExportState;
  versionedBatch?: VersionedExportTaskMetadata;
}

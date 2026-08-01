/**
 * Validation and normalization for workflow definitions
 */

import type { Workflow } from './workflow-engine-types';

/** 验证工作流 */
export declare function validateWorkflow(workflow: Workflow): Workflow;
/** 规范化工作流数据 */
export declare function normalizeWorkflow(data: unknown): Workflow;

import {
  normalizePublishPlatform,
  normalizePublishWindow,
  normalizeSmtpSettings,
  normalizeWebhookSettings,
  type ExportPublishPlatform,
  type ExportPublishSmtpSettings,
  type ExportPublishWebhookSettings,
  type ExportPublishWindow,
} from './publish-pipeline';

export type ExportPipelineNodeType =
  | 'export-mp4'
  | 'generate-gif'
  | 'extract-cover'
  | 'quality-check'
  | 'script-hook'
  | 'webdav-upload'
  | 'notification'
  | 'publish-platform'
  | 'email-notification'
  | 'webhook-callback'
  | 'write-release-record';
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

export class ExportPipelineCycleError extends Error {
  constructor(readonly cycleIds: string[]) {
    super(`Export pipeline contains a cycle: ${cycleIds.join(' -> ')}`);
    this.name = 'ExportPipelineCycleError';
  }
}

export function createTwoStepExportPipeline(name = 'Export Pipeline'): ExportPipeline {
  return normalizeExportPipeline({
    id: 'pipeline-two-step',
    name,
    nodes: [
      { id: 'node-export-mp4', type: 'export-mp4', name: 'Export MP4', condition: 'always' },
      {
        id: 'node-script-hook',
        type: 'script-hook',
        name: 'Script Hook',
        condition: 'on-success',
        script: 'echo {output}',
      },
    ],
    edges: [{ from: 'node-export-mp4', to: 'node-script-hook' }],
  });
}

export function createPublishAutomationPipeline(name = 'Publish Pipeline'): ExportPipeline {
  return normalizeExportPipeline({
    id: 'pipeline-publish',
    name,
    nodes: [
      { id: 'node-export-mp4', type: 'export-mp4', name: 'Export MP4', condition: 'always' },
      {
        id: 'node-email-notification',
        type: 'email-notification',
        name: 'Email Notification',
        condition: 'on-success',
        smtp: {
          host: 'smtp.example.local',
          port: 587,
          from: 'open-factory@example.local',
          to: ['producer@example.local'],
          subject: 'Open Factory export complete',
          passwordKey: 'default',
        },
        publishWindow: { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startHour: 0, endHour: 24 },
      },
      {
        id: 'node-publish-platform',
        type: 'publish-platform',
        name: 'Publish to Platform',
        condition: 'on-success',
        platform: 'youtube',
      },
      {
        id: 'node-webhook-callback',
        type: 'webhook-callback',
        name: 'Webhook Callback',
        condition: 'on-success',
        webhook: {
          url: 'https://example.invalid/open-factory/export-complete',
          headers: { 'X-Open-Factory': 'export' },
          timeoutMs: 5000,
        },
      },
      {
        id: 'node-release-record',
        type: 'write-release-record',
        name: 'Write Release Record',
        condition: 'on-success',
      },
    ],
    edges: [
      { from: 'node-export-mp4', to: 'node-email-notification' },
      { from: 'node-export-mp4', to: 'node-publish-platform' },
      { from: 'node-export-mp4', to: 'node-webhook-callback' },
      { from: 'node-export-mp4', to: 'node-release-record' },
    ],
  });
}

export function normalizeExportPipeline(input: Partial<ExportPipeline> | undefined): ExportPipeline {
  const nodes = Array.isArray(input?.nodes)
    ? input.nodes.map(normalizePipelineNode).filter((node): node is ExportPipelineNode => Boolean(node))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(input?.edges)
    ? input.edges
        .map((edge) => ({
          from: typeof edge.from === 'string' ? edge.from.trim() : '',
          to: typeof edge.to === 'string' ? edge.to.trim() : '',
        }))
        .filter(
          (edge) => edge.from && edge.to && edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to),
        )
    : [];
  return {
    id: typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : 'pipeline',
    name: typeof input?.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 120) : 'Export Pipeline',
    nodes,
    edges,
  };
}

export function serializeExportPipeline(pipeline: ExportPipeline): string {
  return JSON.stringify(normalizeExportPipeline(pipeline), null, 2);
}

export function parseExportPipeline(contents: string): ExportPipeline {
  return normalizeExportPipeline(JSON.parse(contents) as Partial<ExportPipeline>);
}

export function topologicallySortExportPipeline(pipeline: ExportPipeline): ExportPipelineNode[] {
  const normalized = normalizeExportPipeline(pipeline);
  const nodesById = new Map(normalized.nodes.map((node) => [node.id, node]));
  const indegree = new Map(normalized.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of normalized.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const ready = normalized.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).sort(comparePipelineNodes);
  const sorted: ExportPipelineNode[] = [];
  while (ready.length > 0) {
    const node = ready.shift()!;
    sorted.push(node);
    for (const targetId of (outgoing.get(node.id) ?? []).sort()) {
      const nextDegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextDegree);
      if (nextDegree === 0) {
        const target = nodesById.get(targetId);
        if (target) {
          ready.push(target);
          ready.sort(comparePipelineNodes);
        }
      }
    }
  }
  if (sorted.length !== normalized.nodes.length) {
    throw new ExportPipelineCycleError(findPipelineCycle(normalized));
  }
  return sorted;
}

export function getPipelineUpstreamNodeIds(pipeline: ExportPipeline, nodeId: string): string[] {
  return normalizeExportPipeline(pipeline)
    .edges.filter((edge) => edge.to === nodeId)
    .map((edge) => edge.from)
    .sort();
}

export function shouldRunExportPipelineNode(
  node: Pick<ExportPipelineNode, 'condition'>,
  upstreamStatuses: readonly ExportPipelineNodeStatus[],
): boolean {
  const condition = node.condition ?? 'on-success';
  if (condition === 'always') {
    return true;
  }
  if (condition === 'on-failure') {
    return upstreamStatuses.some((status) => status === 'failed');
  }
  return upstreamStatuses.length === 0 || upstreamStatuses.every((status) => status === 'complete');
}

function normalizePipelineNode(node: Partial<ExportPipelineNode>): ExportPipelineNode | undefined {
  const id = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : '';
  if (!id) {
    return undefined;
  }
  const type = normalizePipelineNodeType(node.type);
  return {
    id,
    type,
    name: typeof node.name === 'string' && node.name.trim() ? node.name.trim().slice(0, 120) : defaultNodeName(type),
    condition: normalizePipelineCondition(node.condition),
    retryOnFailure: node.retryOnFailure === true,
    ...(typeof node.script === 'string' && node.script.trim() ? { script: node.script.trim() } : {}),
    ...(type === 'publish-platform' ? { platform: normalizePublishPlatform(node.platform) } : {}),
    ...(type === 'email-notification' && normalizeSmtpSettings(node.smtp)
      ? { smtp: normalizeSmtpSettings(node.smtp) }
      : {}),
    ...(type === 'webhook-callback' && normalizeWebhookSettings(node.webhook)
      ? { webhook: normalizeWebhookSettings(node.webhook) }
      : {}),
    ...(normalizePublishWindow(node.publishWindow)
      ? { publishWindow: normalizePublishWindow(node.publishWindow) }
      : {}),
  };
}

function normalizePipelineNodeType(type: ExportPipelineNodeType | string | undefined): ExportPipelineNodeType {
  return type === 'generate-gif' ||
    type === 'extract-cover' ||
    type === 'quality-check' ||
    type === 'script-hook' ||
    type === 'webdav-upload' ||
    type === 'notification' ||
    type === 'publish-platform' ||
    type === 'email-notification' ||
    type === 'webhook-callback' ||
    type === 'write-release-record'
    ? type
    : 'export-mp4';
}

function normalizePipelineCondition(condition: ExportPipelineCondition | string | undefined): ExportPipelineCondition {
  return condition === 'on-failure' || condition === 'always' ? condition : 'on-success';
}

function defaultNodeName(type: ExportPipelineNodeType): string {
  return {
    'export-mp4': 'Export MP4',
    'generate-gif': 'Generate GIF',
    'extract-cover': 'Extract Cover Frame',
    'quality-check': 'Run Quality Check',
    'script-hook': 'Script Hook',
    'webdav-upload': 'Upload WebDAV',
    notification: 'Send Notification',
    'publish-platform': 'Publish Platform',
    'email-notification': 'Email Notification',
    'webhook-callback': 'Webhook Callback',
    'write-release-record': 'Write Release Record',
  }[type];
}

function comparePipelineNodes(left: ExportPipelineNode, right: ExportPipelineNode): number {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function findPipelineCycle(pipeline: ExportPipeline): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const outgoing = new Map<string, string[]>();
  for (const edge of pipeline.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const visit = (nodeId: string): string[] | undefined => {
    if (visiting.has(nodeId)) {
      const start = path.indexOf(nodeId);
      return [...path.slice(Math.max(0, start)), nodeId];
    }
    if (visited.has(nodeId)) {
      return undefined;
    }
    visiting.add(nodeId);
    path.push(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      const cycle = visit(target);
      if (cycle) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    return undefined;
  };
  for (const node of pipeline.nodes) {
    const cycle = visit(node.id);
    if (cycle) {
      return cycle;
    }
  }
  return [];
}

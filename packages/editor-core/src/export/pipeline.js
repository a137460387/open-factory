import { normalizePublishPlatform, normalizePublishWindow, normalizeSmtpSettings, normalizeWebhookSettings, } from './publish-pipeline';
export class ExportPipelineCycleError extends Error {
    cycleIds;
    constructor(cycleIds) {
        super(`Export pipeline contains a cycle: ${cycleIds.join(' -> ')}`);
        this.cycleIds = cycleIds;
        this.name = 'ExportPipelineCycleError';
    }
}
export function createTwoStepExportPipeline(name = 'Export Pipeline') {
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
export function createPublishAutomationPipeline(name = 'Publish Pipeline') {
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
export function normalizeExportPipeline(input) {
    const nodes = Array.isArray(input?.nodes)
        ? input.nodes.map(normalizePipelineNode).filter((node) => Boolean(node))
        : [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(input?.edges)
        ? input.edges
            .map((edge) => ({
            from: typeof edge.from === 'string' ? edge.from.trim() : '',
            to: typeof edge.to === 'string' ? edge.to.trim() : '',
        }))
            .filter((edge) => edge.from && edge.to && edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to))
        : [];
    return {
        id: typeof input?.id === 'string' && input.id.trim() ? input.id.trim() : 'pipeline',
        name: typeof input?.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 120) : 'Export Pipeline',
        nodes,
        edges,
    };
}
export function serializeExportPipeline(pipeline) {
    return JSON.stringify(normalizeExportPipeline(pipeline), null, 2);
}
export function parseExportPipeline(contents) {
    return normalizeExportPipeline(JSON.parse(contents));
}
export function topologicallySortExportPipeline(pipeline) {
    const normalized = normalizeExportPipeline(pipeline);
    const nodesById = new Map(normalized.nodes.map((node) => [node.id, node]));
    const indegree = new Map(normalized.nodes.map((node) => [node.id, 0]));
    const outgoing = new Map();
    for (const edge of normalized.edges) {
        indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
        outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    }
    const ready = normalized.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).sort(comparePipelineNodes);
    const sorted = [];
    while (ready.length > 0) {
        const node = ready.shift();
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
export function getPipelineUpstreamNodeIds(pipeline, nodeId) {
    return normalizeExportPipeline(pipeline)
        .edges.filter((edge) => edge.to === nodeId)
        .map((edge) => edge.from)
        .sort();
}
export function shouldRunExportPipelineNode(node, upstreamStatuses) {
    const condition = node.condition ?? 'on-success';
    if (condition === 'always') {
        return true;
    }
    if (condition === 'on-failure') {
        return upstreamStatuses.some((status) => status === 'failed');
    }
    return upstreamStatuses.length === 0 || upstreamStatuses.every((status) => status === 'complete');
}
function normalizePipelineNode(node) {
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
function normalizePipelineNodeType(type) {
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
function normalizePipelineCondition(condition) {
    return condition === 'on-failure' || condition === 'always' ? condition : 'on-success';
}
function defaultNodeName(type) {
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
function comparePipelineNodes(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function findPipelineCycle(pipeline) {
    const visiting = new Set();
    const visited = new Set();
    const path = [];
    const outgoing = new Map();
    for (const edge of pipeline.edges) {
        outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    }
    const visit = (nodeId) => {
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
//# sourceMappingURL=pipeline.js.map
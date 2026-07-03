import { useMemo } from 'react';
import type { ExportPipeline, ExportPipelineNodeStatus, ExportPublishNodeLog } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { pipelineStatusClass } from '../lib/pipelineHelpers';

export function PipelineSection({
  pipeline,
  statuses,
  publishLogs,
  onCreateTemplate,
  onCreatePublishTemplate
}: {
  pipeline: ExportPipeline;
  statuses: Record<string, ExportPipelineNodeStatus>;
  publishLogs: ExportPublishNodeLog[];
  onCreateTemplate(): void;
  onCreatePublishTemplate(): void;
}) {
  const t = zhCN.exportDialog.pipeline;
  const downstreamMap = useMemo(() => {
    const nameById = new Map(pipeline.nodes.map((node) => [node.id, node.name]));
    const map = new Map<string, string[]>();
    for (const edge of pipeline.edges) {
      const existing = map.get(edge.from);
      const name = nameById.get(edge.to) ?? edge.to;
      if (existing) {
        existing.push(name);
      } else {
        map.set(edge.from, [name]);
      }
    }
    return map;
  }, [pipeline.nodes, pipeline.edges]);
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 rounded-md border border-line p-3" data-testid="export-pipeline-tab">
      <label className="pt-1 text-xs font-medium text-slate-600">{t.title}</label>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{t.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            data-testid="export-pipeline-create-two-node"
            onClick={onCreateTemplate}
          >
            {t.createTwoNode}
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-panel"
            data-testid="export-pipeline-create-publish"
            onClick={onCreatePublishTemplate}
          >
            {t.createPublish}
          </button>
          <span className="text-xs text-slate-500" data-testid="export-pipeline-summary">
            {t.summary(pipeline.nodes.length, pipeline.edges.length)}
          </span>
        </div>
        {pipeline.nodes.length === 0 ? (
          <div className="rounded-md border border-dashed border-line bg-panel px-3 py-6 text-center text-xs text-slate-500" data-testid="export-pipeline-empty">
            {t.empty}
          </div>
        ) : (
          <div className="grid gap-2" data-testid="export-pipeline-node-list">
            {pipeline.nodes.map((node) => {
              const status = statuses[node.id] ?? 'waiting';
              const downstream = downstreamMap.get(node.id) ?? [];
              return (
                <div key={node.id} className="rounded-md border border-line bg-white p-3 text-xs" data-testid="export-pipeline-node" data-node-id={node.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{node.name}</div>
                      <div className="mt-1 text-slate-500">{t.nodeTypes[node.type]}</div>
                      {downstream.length > 0 ? <div className="mt-1 text-slate-500">{t.downstream(downstream.join(' / '))}</div> : null}
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pipelineStatusClass(status)}`} data-testid="export-pipeline-node-status" data-status={status}>
                      {t.status[status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {publishLogs.length > 0 ? (
          <div className="grid gap-1 rounded-md border border-line bg-panel p-2 text-xs" data-testid="export-publish-log-list">
            {publishLogs.map((log) => (
              <div key={`${log.nodeId}-${log.finishedAt}`} className="flex items-center justify-between gap-2" data-testid="export-publish-log" data-status={log.status}>
                <span className="min-w-0 truncate">{log.message}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{log.durationMs} ms</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

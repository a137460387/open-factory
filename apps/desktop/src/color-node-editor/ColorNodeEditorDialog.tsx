import {Download, GitCompareArrows, Link2, Plus, Save, Trash2, Upload, X} from 'lucide-react';
import {BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES, type ColorNodeType} from '@open-factory/editor-core';
import {zhCN} from '../i18n/strings';
import type {ColorNodeEditorDialogProps} from './types';
import {useColorNodeEditor} from './useColorNodeEditor';
import {NodeCard} from './NodeCard';
import {ConnectionsPanel, NodeInspector} from './InspectorPanel';
import {buildConnectionPath} from './utils';

export type {ColorNodeEditorDialogProps} from './types';

export function ColorNodeEditorDialog({clip, onApply, onClose}: ColorNodeEditorDialogProps) {
  const t = zhCN.colorNodeEditor;
  const {
    boardRef,
    graph,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    connectionDrag,
    boardPorts,
    cycleMessage,
    updateGraph,
    patchNode,
    addNode,
    deleteNode,
    setAsOutputNode,
    connectNodes,
    applyTemplate,
    saveToClip,
    saveTemplateFile,
    loadTemplateFile,
    resetGraph,
    setDragState,
    setConnectionDrag,
  } = useColorNodeEditor(clip, onApply, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="color-node-editor-dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-[1520px] flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">{t.title}</h2>
              <p className="text-sm text-slate-500">{clip.name}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={() => void loadTemplateFile()}
                data-testid="color-node-editor-load-button"
              >
                <Upload size={15} />
                {t.loadGraph}
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={saveToClip}
                data-testid="color-node-editor-apply-button"
              >
                <Save size={15} />
                {t.saveToClip}
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={() => void saveTemplateFile()}
                data-testid="color-node-editor-save-template-button"
              >
                <Download size={15} />
                {t.saveTemplate}
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={resetGraph}
                data-testid="color-node-editor-reset-button"
              >
                <GitCompareArrows size={15} />
                {t.resetGraph}
              </button>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 hover:bg-panel"
                type="button"
                onClick={onClose}
                data-testid="color-node-editor-close-button"
              >
                <X size={15} />
                {zhCN.common.close}
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-line lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 overflow-hidden bg-[#0b1020]">
            <NodePaletteBar addNode={addNode} deleteNode={deleteNode} setAsOutputNode={setAsOutputNode} selectedNode={selectedNode} />
            {cycleMessage ? (
              <div className="border-b border-amber-300/50 bg-amber-300/15 px-4 py-2 text-xs font-medium text-amber-100">
                {cycleMessage}
              </div>
            ) : null}
            <div
              ref={boardRef}
              className="relative h-[calc(92vh-168px)] min-h-[540px] overflow-hidden"
              data-testid="color-node-board"
            >
              <ConnectionSvg graph={graph} boardPorts={boardPorts} connectionDrag={connectionDrag} />
              {graph.nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={node.id === selectedNodeId}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onPatch={(patch) => patchNode(node.id, patch)}
                  onBeginDrag={(event) => {
                    const rect = boardRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setSelectedNodeId(node.id);
                    setDragState({
                      nodeId: node.id,
                      offsetX: event.clientX - rect.left - node.position.x,
                      offsetY: event.clientY - rect.top - node.position.y,
                    });
                    event.preventDefault();
                  }}
                  onBeginConnection={(event) => {
                    const rect = boardRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setSelectedNodeId(node.id);
                    setConnectionDrag({
                      fromNodeId: node.id,
                      pointerX: event.clientX - rect.left,
                      pointerY: event.clientY - rect.top,
                    });
                    event.preventDefault();
                  }}
                  onEndConnection={() => {
                    if (!connectionDrag) return;
                    connectNodes(connectionDrag.fromNodeId, node.id);
                    setConnectionDrag(null);
                  }}
                />
              ))}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto bg-white">
            <TemplateLibrary applyTemplate={applyTemplate} />
            <NodeInspector
              selectedNode={selectedNode}
              graph={graph}
              patchNode={patchNode}
              setSelectedNodeId={setSelectedNodeId}
              updateGraph={updateGraph}
            />
          </aside>
        </div>

        <div className="border-t border-line px-4 py-2 text-xs text-slate-500">{t.hint}</div>
      </div>
    </div>
  );
}

function NodePaletteBar({
  addNode,
  deleteNode,
  setAsOutputNode,
  selectedNode,
}: {
  addNode: (type: ColorNodeType) => void;
  deleteNode: () => void;
  setAsOutputNode: () => void;
  selectedNode: import('@open-factory/editor-core').ColorNode | undefined;
}) {
  const t = zhCN.colorNodeEditor;
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-200">
      <div className="font-semibold">{t.nodePalette}</div>
      {(['input', 'sequential', 'parallel', 'layer', 'output', 'lut'] as ColorNodeType[]).map((type) => (
        <button
          key={type}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white hover:bg-white/10"
          type="button"
          onClick={() => addNode(type)}
          data-testid={`color-node-editor-add-${type}-button`}
        >
          <Plus size={12} />
          {t.nodeTypes[type]}
        </button>
      ))}
      <button
        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        onClick={deleteNode}
        disabled={!selectedNode || selectedNode.type === 'input' || selectedNode.type === 'output'}
        data-testid="color-node-editor-delete-node-button"
      >
        <Trash2 size={12} />
        {t.deleteNode}
      </button>
      <button
        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        onClick={setAsOutputNode}
        disabled={!selectedNode}
        data-testid="color-node-editor-set-output-button"
      >
        <Link2 size={12} />
        {t.setAsOutput}
      </button>
    </div>
  );
}

function ConnectionSvg({
  graph,
  boardPorts,
  connectionDrag,
}: {
  graph: import('@open-factory/editor-core').ColorNodeGraph;
  boardPorts: Map<string, {input: {x: number; y: number}; output: {x: number; y: number}}>;
  connectionDrag: import('./types').ConnectionDragState | null;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1280 720"
      aria-hidden="true"
    >
      {graph.connections.map((connection) => {
        const from = boardPorts.get(connection.from);
        const to = boardPorts.get(connection.to);
        if (!from || !to) return null;
        return (
          <path
            key={connection.id}
            d={buildConnectionPath(from.output, to.input)}
            fill="none"
            stroke="rgba(148, 163, 184, 0.85)"
            strokeWidth={2.5}
            markerEnd="url(#color-node-arrow)"
          />
        );
      })}
      {connectionDrag ? (
        <path
          d={buildConnectionPath(boardPorts.get(connectionDrag.fromNodeId)?.output ?? {x: 0, y: 0}, {
            x: connectionDrag.pointerX,
            y: connectionDrag.pointerY,
          })}
          fill="none"
          stroke="rgba(251, 191, 36, 0.95)"
          strokeDasharray="8 6"
          strokeWidth={2.5}
        />
      ) : null}
      <defs>
        <marker
          id="color-node-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.95)" />
        </marker>
      </defs>
    </svg>
  );
}

function TemplateLibrary({
  applyTemplate,
}: {
  applyTemplate: (template: (typeof BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES)[number]) => void;
}) {
  const t = zhCN.colorNodeEditor;
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="text-sm font-semibold text-ink">{t.templateLibrary}</div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="rounded-md border border-line bg-panel px-3 py-2 text-left hover:border-brand hover:bg-white"
            type="button"
            onClick={() => applyTemplate(template)}
            data-testid={`color-node-template-${template.id}`}
          >
            <div className="text-sm font-medium text-ink">{template.name}</div>
            <div className="text-xs text-slate-500">{template.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

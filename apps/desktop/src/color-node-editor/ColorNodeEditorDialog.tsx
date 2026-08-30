import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES,
  INPUT_COLOR_SPACES,
  createDefaultColorNodeGraph,
  createId,
  detectColorNodeGraphCycle,
  normalizeColorNodeGraph,
  normalizeInputColorSpace,
  parseColorNodeGraphFile,
  serializeColorNodeGraphFile,
  clamp,
  type Clip,
  type ColorNode,
  type ColorNodeBlendMode,
  type ColorNodeGraph,
  type ColorNodeType,
  type InputColorSpace,
} from '@open-factory/editor-core';
import {
  ChevronDown,
  Download,
  FolderOpen,
  GitCompareArrows,
  Link2,
  Move,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { getAppDataDir, openFileDialog, readFile, saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

const BOARD_WIDTH = 1280;
const BOARD_HEIGHT = 720;
const NODE_WIDTH = 224;
const NODE_HEIGHT = 186;
const NODE_SPACING_X = 252;
const NODE_SPACING_Y = 88;

interface ColorNodeEditorDialogProps {
  clip: Clip;
  onApply(graph: ColorNodeGraph): void;
  onClose(): void;
}

interface NodeDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

interface ConnectionDragState {
  fromNodeId: string;
  pointerX: number;
  pointerY: number;
}

export function ColorNodeEditorDialog({ clip, onApply, onClose }: ColorNodeEditorDialogProps) {
  const t = zhCN.colorNodeEditor;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [graph, setGraph] = useState<ColorNodeGraph>(() => buildInitialGraph(clip));
  const [selectedNodeId, setSelectedNodeId] = useState<string>(() => buildInitialGraph(clip).outputNodeId);
  const [dragState, setDragState] = useState<NodeDragState | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const cycle = useMemo(() => detectColorNodeGraphCycle(graph), [graph]);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0],
    [graph.nodes, selectedNodeId],
  );
  const nodeCycleSummary = cycle ? cycle.join(' → ') : '';

  useEffect(() => {
    const next = buildInitialGraph(clip);
    setGraph(next);
    setSelectedNodeId(
      next.nodes.find((node) => node.type !== 'input' && node.type !== 'output')?.id ?? next.outputNodeId,
    );
    setDragState(null);
    setConnectionDrag(null);
  }, [clip.id]);

  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(graph.nodes[0]?.id ?? '');
    }
  }, [graph.nodes, selectedNodeId]);

  useEffect(() => {
    if (!dragState && !connectionDrag) {
      return undefined;
    }
    const handleMove = (event: PointerEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const x = clamp(event.clientX - rect.left, 0, BOARD_WIDTH);
      const y = clamp(event.clientY - rect.top, 0, BOARD_HEIGHT);
      if (dragState) {
        const nextX = clamp(x - dragState.offsetX, 16, BOARD_WIDTH - NODE_WIDTH - 16);
        const nextY = clamp(y - dragState.offsetY, 16, BOARD_HEIGHT - NODE_HEIGHT - 16);
        setGraph((current) =>
          normalizeColorNodeGraph(
            {
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === dragState.nodeId ? { ...node, position: { x: nextX, y: nextY } } : node,
              ),
            },
            clip.colorCorrection,
          ),
        );
      }
      if (connectionDrag) {
        setConnectionDrag((current) => (current ? { ...current, pointerX: x, pointerY: y } : current));
      }
    };
    const handleUp = () => {
      setDragState(null);
      setConnectionDrag(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [clip.colorCorrection, connectionDrag, dragState]);

  const updateGraph = (recipe: (current: ColorNodeGraph) => ColorNodeGraph) => {
    setGraph((current) => normalizeColorNodeGraph(recipe(current), clip.colorCorrection));
  };

  const patchNode = (nodeId: string, patch: Partial<ColorNode>): void => {
    updateGraph((current) => {
      const nextNodes = current.nodes.map((node) =>
        node.id === nodeId ? normalizeNode({ ...node, ...patch }, node, current.nodes.length) : node,
      );
      const nextOutputNodeId =
        patch.type === 'output'
          ? nodeId
          : current.outputNodeId === nodeId && patch.type
            ? (findOutputNodeId(nextNodes) ?? nodeId)
            : current.outputNodeId;
      return {
        ...current,
        nodes: nextNodes,
        outputNodeId: nextOutputNodeId,
      };
    });
  };

  const addNode = (type: ColorNodeType): void => {
    const newNodeId = createId(`color-node-${type}`);
    updateGraph((current) => {
      const anchor = resolveInsertAnchor(current, selectedNodeId);
      const anchorIndex = current.nodes.findIndex((node) => node.id === anchor.id);
      const outgoing = current.connections.filter((connection) => connection.from === anchor.id);
      const downstreamTargets =
        outgoing.length > 0
          ? outgoing.map((connection) => connection.to)
          : anchor.type === 'output'
            ? [findPredecessorNodeId(current, anchor.id) ?? current.nodes[0]?.id ?? anchor.id]
            : [current.outputNodeId];
      const newNode = createNode(
        type,
        anchor.position.x + NODE_SPACING_X,
        clamp(anchor.position.y + (type === 'parallel' ? -NODE_SPACING_Y : 0), 16, BOARD_HEIGHT - NODE_HEIGHT - 16),
        current.nodes.length,
        newNodeId,
      );
      const nextNodes = [...current.nodes];
      nextNodes.splice(Math.max(0, anchorIndex + 1), 0, newNode);
      const nextConnections = current.connections.filter((connection) => connection.from !== anchor.id);
      nextConnections.push({
        id: createId(`color-connection-${newNode.id}-in`),
        from: anchor.id,
        to: newNode.id,
      });
      for (const targetId of downstreamTargets) {
        if (!targetId || targetId === anchor.id) {
          continue;
        }
        nextConnections.push({
          id: createId(`color-connection-${newNode.id}-${targetId}`),
          from: newNode.id,
          to: targetId,
        });
      }
      const nextOutputNodeId =
        current.outputNodeId === anchor.id && outgoing.length === 0 ? newNode.id : current.outputNodeId;
      return {
        ...current,
        nodes: nextNodes,
        connections: dedupeConnections(nextConnections),
        outputNodeId: nextOutputNodeId,
      };
    });
    setSelectedNodeId(newNodeId);
  };

  const deleteNode = (): void => {
    if (!selectedNode || selectedNode.type === 'input' || selectedNode.type === 'output') {
      return;
    }
    updateGraph((current) => {
      const incoming = current.connections
        .filter((connection) => connection.to === selectedNode.id)
        .map((connection) => connection.from);
      const outgoing = current.connections
        .filter((connection) => connection.from === selectedNode.id)
        .map((connection) => connection.to);
      const nextNodes = current.nodes.filter((node) => node.id !== selectedNode.id);
      const nextConnections = current.connections.filter(
        (connection) => connection.from !== selectedNode.id && connection.to !== selectedNode.id,
      );
      for (const from of incoming.length > 0 ? incoming : [findPredecessorNodeId(current, selectedNode.id) ?? '']) {
        for (const to of outgoing.length > 0 ? outgoing : [current.outputNodeId]) {
          if (!from || !to || from === to) {
            continue;
          }
          nextConnections.push({
            id: createId(`color-connection-${from}-${to}`),
            from,
            to,
          });
        }
      }
      return {
        ...current,
        nodes: nextNodes,
        connections: dedupeConnections(nextConnections),
        outputNodeId:
          current.outputNodeId === selectedNode.id
            ? (findOutputNodeId(nextNodes) ?? nextNodes[0]?.id ?? current.outputNodeId)
            : current.outputNodeId,
      };
    });
    setSelectedNodeId(graph.nodes.find((node) => node.id !== selectedNode.id)?.id ?? '');
  };

  const setAsOutputNode = (): void => {
    if (!selectedNode) {
      return;
    }
    updateGraph((current) => ({
      ...current,
      outputNodeId: selectedNode.id,
      nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, type: 'output' } : node)),
    }));
  };

  const connectNodes = (fromNodeId: string, toNodeId: string): void => {
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      return;
    }
    updateGraph((current) => {
      if (current.connections.some((connection) => connection.from === fromNodeId && connection.to === toNodeId)) {
        return current;
      }
      const next = {
        ...current,
        connections: dedupeConnections([
          ...current.connections,
          { id: createId(`color-connection-${fromNodeId}-${toNodeId}`), from: fromNodeId, to: toNodeId },
        ]),
      };
      return next;
    });
  };

  const applyTemplate = (template: (typeof BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES)[number]): void => {
    const next = normalizeColorNodeGraph(template.graph, clip.colorCorrection);
    setGraph(next);
    setSelectedNodeId(
      next.nodes.find((node) => node.type !== 'input' && node.type !== 'output')?.id ?? next.outputNodeId,
    );
  };

  const saveToClip = (): void => {
    try {
      onApply(normalizeColorNodeGraph(graph, clip.colorCorrection));
      showToast({ kind: 'success', title: t.savedTitle, message: clip.name });
      onClose();
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.saveFailed,
        message: error instanceof Error ? error.message : t.saveFailedMessage,
      });
    }
  };

  const saveTemplateFile = async (): Promise<void> => {
    try {
      const appDataDir = await getAppDataDir();
      const defaultPath = `${appDataDir.replace(/[\\/]+$/, '')}/node-graphs/${sanitizeFileBaseName(clip.name)}.ofnodegraph.json`;
      const path = await saveFileDialog(defaultPath, [
        { name: t.nodeGraphFileFilter, extensions: ['ofnodegraph.json', 'json'] },
      ]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeColorNodeGraphFile(graph, clip.name));
      showToast({ kind: 'success', title: t.exportedTitle, message: path });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.exportFailed,
        message: error instanceof Error ? error.message : t.exportFailedMessage,
      });
    }
  };

  const loadTemplateFile = async (): Promise<void> => {
    try {
      const [path] = await openFileDialog(false, [
        { name: t.nodeGraphFileFilter, extensions: ['ofnodegraph.json', 'json'] },
      ]);
      if (!path) {
        return;
      }
      const contents = await readFile(path);
      const next = parseColorNodeGraphFile(contents);
      setGraph(next);
      setSelectedNodeId(
        next.nodes.find((node) => node.type !== 'input' && node.type !== 'output')?.id ?? next.outputNodeId,
      );
      showToast({ kind: 'success', title: t.loadedTitle, message: path });
    } catch (error) {
      showToast({
        kind: 'error',
        title: t.loadFailed,
        message: error instanceof Error ? error.message : t.loadFailedMessage,
      });
    }
  };

  const resetGraph = (): void => {
    const next = createDefaultColorNodeGraph(clip.colorCorrection);
    setGraph(next);
    setSelectedNodeId(next.outputNodeId);
  };

  const boardPorts = useMemo(() => buildBoardPorts(graph), [graph]);
  const cycleMessage = cycle ? t.cycleWarning(nodeCycleSummary) : undefined;

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
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
                aria-hidden="true"
              >
                {graph.connections.map((connection) => {
                  const from = boardPorts.get(connection.from);
                  const to = boardPorts.get(connection.to);
                  if (!from || !to) {
                    return null;
                  }
                  const path = buildConnectionPath(from.output, to.input);
                  return (
                    <path
                      key={connection.id}
                      d={path}
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.85)"
                      strokeWidth={2.5}
                      markerEnd="url(#color-node-arrow)"
                    />
                  );
                })}
                {connectionDrag ? (
                  <path
                    d={buildConnectionPath(boardPorts.get(connectionDrag.fromNodeId)?.output ?? { x: 0, y: 0 }, {
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
              {graph.nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={node.id === selectedNodeId}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onPatch={(patch) => patchNode(node.id, patch)}
                  onBeginDrag={(event) => {
                    const rect = boardRef.current?.getBoundingClientRect();
                    if (!rect) {
                      return;
                    }
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
                    if (!rect) {
                      return;
                    }
                    setSelectedNodeId(node.id);
                    setConnectionDrag({
                      fromNodeId: node.id,
                      pointerX: event.clientX - rect.left,
                      pointerY: event.clientY - rect.top,
                    });
                    event.preventDefault();
                  }}
                  onEndConnection={() => {
                    if (!connectionDrag) {
                      return;
                    }
                    connectNodes(connectionDrag.fromNodeId, node.id);
                    setConnectionDrag(null);
                  }}
                />
              ))}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto bg-white">
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

            <div className="space-y-4 p-4">
              {selectedNode ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{t.nodeInspector}</h3>
                      <p className="text-xs text-slate-500">{selectedNode.id}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        className="h-4 w-4 accent-brand"
                        type="checkbox"
                        checked={selectedNode.enabled !== false}
                        onChange={(event) => patchNode(selectedNode.id, { enabled: event.target.checked })}
                        data-testid="color-node-enabled-toggle"
                      />
                      {t.enabled}
                    </label>
                  </div>

                  <label className="block text-xs font-medium text-slate-600">
                    {t.name}
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                      value={selectedNode.name}
                      onChange={(event) => patchNode(selectedNode.id, { name: event.target.value })}
                      data-testid="color-node-name-input"
                    />
                  </label>

                  <label className="block text-xs font-medium text-slate-600">
                    {t.type}
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={selectedNode.type}
                      onChange={(event) => patchNode(selectedNode.id, { type: event.target.value as ColorNodeType })}
                      data-testid="color-node-type-select"
                    >
                      {(['input', 'sequential', 'parallel', 'layer', 'output', 'lut'] as ColorNodeType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {t.nodeTypes[type]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label={t.positionX}
                      value={selectedNode.position.x}
                      min={0}
                      max={BOARD_WIDTH}
                      step={1}
                      onCommit={(value) =>
                        patchNode(selectedNode.id, { position: { ...selectedNode.position, x: value } })
                      }
                      testId="color-node-position-x-input"
                    />
                    <NumberInput
                      label={t.positionY}
                      value={selectedNode.position.y}
                      min={0}
                      max={BOARD_HEIGHT}
                      step={1}
                      onCommit={(value) =>
                        patchNode(selectedNode.id, { position: { ...selectedNode.position, y: value } })
                      }
                      testId="color-node-position-y-input"
                    />
                  </div>

                  {selectedNode.type !== 'output' && selectedNode.type !== 'input' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <NumberInput
                        label={t.brightness}
                        value={selectedNode.correction.brightness}
                        min={-1}
                        max={1}
                        step={0.01}
                        onCommit={(value) =>
                          patchNode(selectedNode.id, { correction: { ...selectedNode.correction, brightness: value } })
                        }
                        testId="color-node-brightness-input"
                      />
                      <NumberInput
                        label={t.contrast}
                        value={selectedNode.correction.contrast}
                        min={0}
                        max={3}
                        step={0.01}
                        onCommit={(value) =>
                          patchNode(selectedNode.id, { correction: { ...selectedNode.correction, contrast: value } })
                        }
                        testId="color-node-contrast-input"
                      />
                      <NumberInput
                        label={t.saturation}
                        value={selectedNode.correction.saturation}
                        min={0}
                        max={3}
                        step={0.01}
                        onCommit={(value) =>
                          patchNode(selectedNode.id, { correction: { ...selectedNode.correction, saturation: value } })
                        }
                        testId="color-node-saturation-input"
                      />
                      <NumberInput
                        label={t.hue}
                        value={selectedNode.correction.hue}
                        min={-180}
                        max={180}
                        step={1}
                        onCommit={(value) =>
                          patchNode(selectedNode.id, { correction: { ...selectedNode.correction, hue: value } })
                        }
                        testId="color-node-hue-input"
                      />
                    </div>
                  ) : null}

                  <label className="block text-xs font-medium text-slate-600">
                    {t.inputColorSpace}
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                      value={normalizeInputColorSpace(selectedNode.correction.inputColorSpace)}
                      onChange={(event) =>
                        patchNode(selectedNode.id, {
                          correction: {
                            ...selectedNode.correction,
                            inputColorSpace: event.target.value as InputColorSpace,
                          },
                        })
                      }
                      data-testid="color-node-input-color-space-select"
                    >
                      {INPUT_COLOR_SPACES.map((colorSpace) => (
                        <option key={colorSpace} value={colorSpace}>
                          {zhCN.inspector.inputColorSpaces[colorSpace]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-slate-600">
                      {t.blendMode}
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
                        value={selectedNode.blendMode ?? 'average'}
                        onChange={(event) =>
                          patchNode(selectedNode.id, { blendMode: event.target.value as ColorNodeBlendMode })
                        }
                        data-testid="color-node-blend-mode-select"
                      >
                        {(
                          ['average', 'normal', 'multiply', 'screen', 'overlay', 'addition'] as ColorNodeBlendMode[]
                        ).map((mode) => (
                          <option key={mode} value={mode}>
                            {t.blendModes[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <NumberInput
                      label={t.mix}
                      value={selectedNode.mix ?? 1}
                      min={0}
                      max={1}
                      step={0.01}
                      onCommit={(value) => patchNode(selectedNode.id, { mix: value })}
                      testId="color-node-mix-input"
                    />
                  </div>

                  <label className="block text-xs font-medium text-slate-600">
                    {t.lutPath}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        className="h-9 min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                        value={selectedNode.lutPath ?? ''}
                        placeholder={t.noLut}
                        onChange={(event) =>
                          patchNode(selectedNode.id, {
                            lutPath: event.target.value || null,
                            correction: { ...selectedNode.correction, lutPath: event.target.value || null },
                          })
                        }
                        data-testid="color-node-lut-path-input"
                      />
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-slate-700 hover:bg-panel"
                        type="button"
                        title={t.chooseLut}
                        aria-label={t.chooseLut}
                        data-testid="color-node-choose-lut-button"
                        onClick={() =>
                          void chooseLutFile((path) =>
                            patchNode(selectedNode.id, {
                              lutPath: path,
                              correction: { ...selectedNode.correction, lutPath: path },
                            }),
                          )
                        }
                      >
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  </label>
                </section>
              ) : (
                <div className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-slate-500">
                  {t.emptySelection}
                </div>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink">{t.connections}</h3>
                <div className="space-y-2">
                  {graph.connections.length > 0 ? (
                    graph.connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel px-3 py-2 text-xs"
                        data-testid="color-node-connection-row"
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          type="button"
                          onClick={() => setSelectedNodeId(connection.from)}
                          title={connection.from}
                        >
                          <span className="block truncate font-medium text-ink">
                            {resolveNodeLabel(graph, connection.from)}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {resolveNodeLabel(graph, connection.to)}
                          </span>
                        </button>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                          type="button"
                          title={zhCN.common.delete}
                          aria-label={zhCN.common.delete}
                          onClick={() =>
                            updateGraph((current) => ({
                              ...current,
                              connections: current.connections.filter((item) => item.id !== connection.id),
                            }))
                          }
                          data-testid={`color-node-delete-connection-${connection.id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-line px-3 py-4 text-sm text-slate-500">
                      {t.noConnections}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>

        <div className="border-t border-line px-4 py-2 text-xs text-slate-500">{t.hint}</div>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
  onPatch,
  onBeginDrag,
  onBeginConnection,
  onEndConnection,
}: {
  node: ColorNode;
  selected: boolean;
  onSelect(): void;
  onPatch(patch: Partial<ColorNode>): void;
  onBeginDrag(event: ReactPointerEvent<HTMLButtonElement>): void;
  onBeginConnection(event: ReactPointerEvent<HTMLButtonElement>): void;
  onEndConnection(): void;
}) {
  return (
    <div
      className={`absolute rounded-md border shadow-soft ${selected ? 'border-brand bg-white ring-2 ring-brand/30' : 'border-white/10 bg-white/95'}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
      }}
      onMouseDown={onSelect}
      data-testid={`color-node-card-${node.id}`}
      data-node-id={node.id}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel text-slate-600 hover:bg-white"
          type="button"
          title={zhCN.colorNodeEditor.dragNode}
          aria-label={zhCN.colorNodeEditor.dragNode}
          onPointerDown={onBeginDrag}
          data-testid={`color-node-drag-${node.id}`}
        >
          <Move size={13} />
        </button>
        <button
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink"
          type="button"
          onClick={onSelect}
          data-testid={`color-node-select-${node.id}`}
        >
          {node.name}
        </button>
        <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <input
            className="h-3.5 w-3.5 accent-brand"
            type="checkbox"
            checked={node.enabled !== false}
            onChange={(event) => onPatch({ enabled: event.target.checked })}
            data-testid={`color-node-enabled-${node.id}`}
          />
          {zhCN.colorNodeEditor.enabled}
        </label>
      </div>
      <div className="space-y-2 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded border border-line px-2 py-1 text-[11px] font-medium text-slate-600">
            {zhCN.colorNodeEditor.nodeTypes[node.type]}
          </span>
          <select
            className="h-7 rounded-md border border-line bg-white px-2 text-[11px] font-medium text-slate-700"
            value={node.type}
            onChange={(event) => onPatch({ type: event.target.value as ColorNodeType })}
            data-testid={`color-node-type-${node.id}`}
          >
            {(['input', 'sequential', 'parallel', 'layer', 'output', 'lut'] as ColorNodeType[]).map((type) => (
              <option key={type} value={type}>
                {zhCN.colorNodeEditor.nodeTypes[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label={zhCN.colorNodeEditor.positionX}
            value={node.position.x}
            min={0}
            max={BOARD_WIDTH}
            step={1}
            onCommit={(value) => onPatch({ position: { ...node.position, x: value } })}
            testId={`color-node-position-x-${node.id}`}
            compact
          />
          <NumberInput
            label={zhCN.colorNodeEditor.positionY}
            value={node.position.y}
            min={0}
            max={BOARD_HEIGHT}
            step={1}
            onCommit={(value) => onPatch({ position: { ...node.position, y: value } })}
            testId={`color-node-position-y-${node.id}`}
            compact
          />
        </div>
        {node.type !== 'input' && node.type !== 'output' ? (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label={zhCN.colorNodeEditor.brightness}
              value={node.correction.brightness}
              min={-1}
              max={1}
              step={0.01}
              onCommit={(value) => onPatch({ correction: { ...node.correction, brightness: value } })}
              testId={`color-node-brightness-${node.id}`}
              compact
            />
            <NumberInput
              label={zhCN.colorNodeEditor.contrast}
              value={node.correction.contrast}
              min={0}
              max={3}
              step={0.01}
              onCommit={(value) => onPatch({ correction: { ...node.correction, contrast: value } })}
              testId={`color-node-contrast-${node.id}`}
              compact
            />
            <NumberInput
              label={zhCN.colorNodeEditor.saturation}
              value={node.correction.saturation}
              min={0}
              max={3}
              step={0.01}
              onCommit={(value) => onPatch({ correction: { ...node.correction, saturation: value } })}
              testId={`color-node-saturation-${node.id}`}
              compact
            />
            <NumberInput
              label={zhCN.colorNodeEditor.hue}
              value={node.correction.hue}
              min={-180}
              max={180}
              step={1}
              onCommit={(value) => onPatch({ correction: { ...node.correction, hue: value } })}
              testId={`color-node-hue-${node.id}`}
              compact
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{zhCN.colorNodeEditor.blendMode}</span>
            <select
              className="h-7 w-full rounded-md border border-line bg-white px-2 text-[11px] font-medium text-slate-700"
              value={node.blendMode ?? 'average'}
              onChange={(event) => onPatch({ blendMode: event.target.value as ColorNodeBlendMode })}
              data-testid={`color-node-blend-${node.id}`}
            >
              {(['average', 'normal', 'multiply', 'screen', 'overlay', 'addition'] as ColorNodeBlendMode[]).map(
                (mode) => (
                  <option key={mode} value={mode}>
                    {zhCN.colorNodeEditor.blendModes[mode]}
                  </option>
                ),
              )}
            </select>
          </label>
          <NumberInput
            label={zhCN.colorNodeEditor.mix}
            value={node.mix ?? 1}
            min={0}
            max={1}
            step={0.01}
            onCommit={(value) => onPatch({ mix: value })}
            testId={`color-node-mix-${node.id}`}
            compact
          />
        </div>
        {node.type === 'lut' ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{zhCN.colorNodeEditor.lutPath}</span>
            <div className="flex items-center gap-1">
              <input
                className="h-7 min-w-0 flex-1 rounded-md border border-line px-2 text-[11px] text-ink"
                value={node.lutPath ?? ''}
                placeholder={zhCN.colorNodeEditor.noLut}
                onChange={(event) =>
                  onPatch({
                    lutPath: event.target.value || null,
                    correction: { ...node.correction, lutPath: event.target.value || null },
                  })
                }
                data-testid={`color-node-lut-path-${node.id}`}
              />
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-slate-600 hover:bg-panel"
                type="button"
                title={zhCN.colorNodeEditor.chooseLut}
                aria-label={zhCN.colorNodeEditor.chooseLut}
                onClick={() =>
                  void chooseLutFile((path) =>
                    onPatch({ lutPath: path, correction: { ...node.correction, lutPath: path } }),
                  )
                }
                data-testid={`color-node-choose-lut-${node.id}`}
              >
                <FolderOpen size={12} />
              </button>
            </div>
          </label>
        ) : null}
      </div>
      {node.type !== 'output' ? (
        <button
          className="absolute right-[-8px] top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300 bg-amber-300 text-[10px] text-amber-950 shadow-sm"
          type="button"
          title={zhCN.colorNodeEditor.connectionFrom}
          aria-label={zhCN.colorNodeEditor.connectionFrom}
          onPointerDown={onBeginConnection}
          data-testid={`color-node-output-port-${node.id}`}
        >
          <ChevronDown size={10} className="-rotate-90" />
        </button>
      ) : null}
      {node.type !== 'input' ? (
        <button
          className="absolute left-[-8px] top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-sky-300 bg-sky-300 text-[10px] text-sky-950 shadow-sm"
          type="button"
          title={zhCN.colorNodeEditor.connectionTo}
          aria-label={zhCN.colorNodeEditor.connectionTo}
          onPointerUp={onEndConnection}
          data-testid={`color-node-input-port-${node.id}`}
        >
          <ChevronDown size={10} className="rotate-90" />
        </button>
      ) : null}
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onCommit,
  testId,
  compact = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit(value: number): void;
  testId?: string;
  compact?: boolean;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <label className={`block ${compact ? '' : 'text-xs font-medium text-slate-600'}`}>
      <span
        className={`mb-1 flex items-center justify-between gap-2 ${compact ? 'text-[11px] font-medium text-slate-500' : ''}`}
      >
        <span>{label}</span>
        {!compact ? <span className="tabular-nums">{formatNumber(value)}</span> : null}
      </span>
      <input
        className={`w-full rounded-md border border-line px-2 text-right tabular-nums text-ink ${compact ? 'h-7 text-[11px]' : 'h-9 text-sm'}`}
        type="number"
        value={formatNumber(safeValue)}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onCommit(clampNumber(Number(event.target.value), min, max))}
        data-testid={testId}
      />
    </label>
  );
}

async function chooseLutFile(applyPath: (path: string) => void): Promise<void> {
  try {
    const [path] = await openFileDialog(false, [{ name: zhCN.colorNodeEditor.lutFileFilter, extensions: ['cube'] }]);
    if (!path) {
      return;
    }
    applyPath(path);
  } catch (error) {
    showToast({
      kind: 'warning',
      title: zhCN.colorNodeEditor.chooseLut,
      message: error instanceof Error ? error.message : zhCN.common.unavailable,
    });
  }
}

function buildInitialGraph(clip: Clip): ColorNodeGraph {
  return clip.colorNodeGraph
    ? normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection)
    : createDefaultColorNodeGraph(clip.colorCorrection);
}

function createNode(
  type: ColorNodeType,
  x: number,
  y: number,
  index: number,
  id = createId(`color-node-${type}`),
): ColorNode {
  const correction =
    type === 'input' || type === 'output'
      ? createDefaultColorNodeGraph().nodes[0].correction
      : createDefaultColorNodeGraph().nodes[0].correction;
  return normalizeNode(
    {
      id,
      type,
      name: defaultNodeName(type, index),
      position: { x, y },
      correction,
      enabled: true,
    },
    undefined,
    index,
  );
}

function normalizeNode(node: ColorNode, fallback: ColorNode | undefined, index: number): ColorNode {
  return (
    normalizeColorNodeGraph({
      version: 1,
      outputNodeId: node.id,
      nodes: [node],
      connections: [],
    }).nodes[0] ??
    fallback ??
    node
  );
}

function defaultNodeName(type: ColorNodeType, index: number): string {
  const map: Record<ColorNodeType, string> = {
    input: 'Input',
    sequential: 'Sequential',
    parallel: 'Parallel',
    layer: 'Layer',
    output: 'Output',
    lut: 'LUT',
  };
  return `${map[type]} ${index + 1}`;
}

function resolveInsertAnchor(graph: ColorNodeGraph, selectedNodeId: string): ColorNode {
  const selected =
    graph.nodes.find((node) => node.id === selectedNodeId) ??
    graph.nodes.find((node) => node.type !== 'output') ??
    graph.nodes[0];
  if (!selected) {
    return createDefaultColorNodeGraph().nodes[0];
  }
  if (selected.type !== 'output') {
    return selected;
  }
  const predecessorId = findPredecessorNodeId(graph, selected.id);
  return (
    graph.nodes.find((node) => node.id === predecessorId) ??
    graph.nodes.find((node) => node.type !== 'output' && node.id !== selected.id) ??
    selected
  );
}

function findPredecessorNodeId(graph: ColorNodeGraph, nodeId: string): string | undefined {
  return graph.connections.find((connection) => connection.to === nodeId)?.from;
}

function findOutputNodeId(nodes: ColorNode[]): string | undefined {
  return nodes.find((node) => node.type === 'output')?.id;
}

function dedupeConnections(connections: ColorNodeGraph['connections']): ColorNodeGraph['connections'] {
  const seen = new Set<string>();
  return connections.filter((connection) => {
    const key = `${connection.from}\0${connection.to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildBoardPorts(
  graph: ColorNodeGraph,
): Map<string, { input: { x: number; y: number }; output: { x: number; y: number } }> {
  const ports = new Map<string, { input: { x: number; y: number }; output: { x: number; y: number } }>();
  for (const node of graph.nodes) {
    ports.set(node.id, {
      input: {
        x: node.position.x,
        y: node.position.y + NODE_HEIGHT / 2,
      },
      output: {
        x: node.position.x + NODE_WIDTH,
        y: node.position.y + NODE_HEIGHT / 2,
      },
    });
  }
  return ports;
}

function buildConnectionPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.max(48, Math.abs(to.x - from.x) * 0.5);
  const c1x = from.x + dx;
  const c2x = to.x - dx;
  return `M ${formatSvgNumber(from.x)} ${formatSvgNumber(from.y)} C ${formatSvgNumber(c1x)} ${formatSvgNumber(from.y)} ${formatSvgNumber(c2x)} ${formatSvgNumber(to.y)} ${formatSvgNumber(to.x)} ${formatSvgNumber(to.y)}`;
}

function resolveNodeLabel(graph: ColorNodeGraph, nodeId: string): string {
  return graph.nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

function clampNumber(value: number, min: number, max: number): number {
  return clamp(Number.isFinite(value) ? value : min, min, max);
}

function formatNumber(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

function formatSvgNumber(value: number): string {
  return formatNumber(value);
}

function sanitizeFileBaseName(name: string): string {
  return (
    name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'open-factory-node-graph'
  );
}

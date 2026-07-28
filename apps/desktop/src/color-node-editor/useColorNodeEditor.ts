import {useEffect, useMemo, useRef, useState} from 'react';
import {
  BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES,
  clamp,
  createDefaultColorNodeGraph,
  createId,
  detectColorNodeGraphCycle,
  normalizeColorNodeGraph,
  parseColorNodeGraphFile,
  serializeColorNodeGraphFile,
  type Clip,
  type ColorNode,
  type ColorNodeGraph,
  type ColorNodeType,
} from '@open-factory/editor-core';
import {getAppDataDir, openFileDialog, readFile, saveFileDialog, writeFile} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {zhCN} from '../i18n/strings';
import {BOARD_HEIGHT, BOARD_WIDTH, NODE_HEIGHT, NODE_WIDTH} from './types';
import type {ConnectionDragState, NodeDragState} from './types';
import {buildAddNodeGraph, buildInitialGraph, normalizeNode} from './node-helpers';
import {dedupeConnections, findOutputNodeId, findPredecessorNodeId, sanitizeFileBaseName} from './utils';

export function useColorNodeEditor(clip: Clip, onApply: (graph: ColorNodeGraph) => void, onClose: () => void) {
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
  const nodeCycleSummary = cycle ? cycle.join(' -> ') : '';

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
                node.id === dragState.nodeId ? {...node, position: {x: nextX, y: nextY}} : node,
              ),
            },
            clip.colorCorrection,
          ),
        );
      }
      if (connectionDrag) {
        setConnectionDrag((current) => (current ? {...current, pointerX: x, pointerY: y} : current));
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
        node.id === nodeId ? normalizeNode({...node, ...patch}, node, current.nodes.length) : node,
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
    const {newNodeId} = buildAddNodeGraph(graph, type, selectedNodeId);
    setGraph((current) => normalizeColorNodeGraph(buildAddNodeGraph(current, type, selectedNodeId).graph, clip.colorCorrection));
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
      nodes: current.nodes.map((node) => (node.id === selectedNode.id ? {...node, type: 'output'} : node)),
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
      return {
        ...current,
        connections: dedupeConnections([
          ...current.connections,
          {id: createId(`color-connection-${fromNodeId}-${toNodeId}`), from: fromNodeId, to: toNodeId},
        ]),
      };
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
      showToast({kind: 'success', title: t.savedTitle, message: clip.name});
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
        {name: t.nodeGraphFileFilter, extensions: ['ofnodegraph.json', 'json']},
      ]);
      if (!path) {
        return;
      }
      await writeFile(path, serializeColorNodeGraphFile(graph, clip.name));
      showToast({kind: 'success', title: t.exportedTitle, message: path});
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
        {name: t.nodeGraphFileFilter, extensions: ['ofnodegraph.json', 'json']},
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
      showToast({kind: 'success', title: t.loadedTitle, message: path});
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

  return {
    boardRef,
    graph,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    dragState,
    setDragState,
    connectionDrag,
    setConnectionDrag,
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
  };
}

function buildBoardPorts(
  graph: ColorNodeGraph,
): Map<string, {input: {x: number; y: number}; output: {x: number; y: number}}> {
  const ports = new Map<string, {input: {x: number; y: number}; output: {x: number; y: number}}>();
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

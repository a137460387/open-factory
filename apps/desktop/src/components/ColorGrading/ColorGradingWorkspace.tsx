import React, { useCallback, useMemo } from 'react';
import type {
  ColorGradingGraph,
  ColorGradingNode,
  PrimaryWheelParams,
  PrimarySliderParams,
} from '@open-factory/editor-core';
import { createEmptyColorGradingGraph, createColorGradingNode } from '@open-factory/editor-core';
import { ColorWheelPanel } from './ColorWheelPanel';
import { PrimarySlidersPanel } from './PrimarySlidersPanel';
import { NodeGraphView } from './NodeGraphView';

interface ColorGradingWorkspaceProps {
  graph?: ColorGradingGraph;
  onGraphChange: (graph: ColorGradingGraph) => void;
}

export const ColorGradingWorkspace: React.FC<ColorGradingWorkspaceProps> = ({
  graph = createEmptyColorGradingGraph(),
  onGraphChange,
}) => {
  const activeNode = useMemo(() => graph.nodes.find((n) => n.id === graph.activeNodeId) || null, [graph]);

  const handleAddNode = useCallback(
    (node: ColorGradingNode) => {
      onGraphChange({
        ...graph,
        nodes: [...graph.nodes, node],
        activeNodeId: node.id,
      });
    },
    [graph, onGraphChange],
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      onGraphChange({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== nodeId),
        connections: graph.connections.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
        activeNodeId: graph.activeNodeId === nodeId ? null : graph.activeNodeId,
      });
    },
    [graph, onGraphChange],
  );

  const handleSelectNode = useCallback(
    (nodeId: string | null) => {
      onGraphChange({ ...graph, activeNodeId: nodeId });
    },
    [graph, onGraphChange],
  );

  const handleWheelChange = useCallback(
    (params: PrimaryWheelParams) => {
      if (!activeNode) return;
      onGraphChange({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, params } : n)),
      });
    },
    [graph, activeNode, onGraphChange],
  );

  const handleSliderChange = useCallback(
    (params: PrimarySliderParams) => {
      if (!activeNode) return;
      onGraphChange({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, params } : n)),
      });
    },
    [graph, activeNode, onGraphChange],
  );

  return (
    <div className="flex flex-col h-full bg-gray-800" data-testid="color-grading-workspace">
      {/* 节点图视图 */}
      <NodeGraphView
        graph={graph}
        onAddNode={handleAddNode}
        onRemoveNode={handleRemoveNode}
        onSelectNode={handleSelectNode}
      />

      {/* 活动节点的参数面板 */}
      <div className="flex-1 overflow-y-auto border-t border-gray-700">
        {activeNode?.type === 'primary-wheel' && (
          <ColorWheelPanel params={activeNode.params as PrimaryWheelParams} onChange={handleWheelChange} />
        )}
        {activeNode?.type === 'primary-slider' && (
          <PrimarySlidersPanel params={activeNode.params as PrimarySliderParams} onChange={handleSliderChange} />
        )}
        {!activeNode && (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">选择一个节点以编辑参数</div>
        )}
      </div>
    </div>
  );
};

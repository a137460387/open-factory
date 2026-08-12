import React, {useCallback, useMemo} from 'react';
import type {ColorGradingGraph, ColorGradingNode, PrimaryWheelParams, PrimarySliderParams} from '@open-factory/editor-core';
import {createEmptyColorGradingGraph} from '@open-factory/editor-core';
import {ColorWheelPanel} from './ColorWheelPanel';
import {PrimarySlidersPanel} from './PrimarySlidersPanel';
import {NodeGraphView} from './NodeGraphView';
import {zhCN} from '../../i18n/strings';

interface ColorGradingWorkspaceProps {
  graph?: ColorGradingGraph;
  onGraphChange: (graph: ColorGradingGraph) => void;
  /** 只读模式（协作查看者角色）：展示 collab-readonly-notice 并禁用全部调色控件。 */
  readOnly?: boolean;
}

export const ColorGradingWorkspace: React.FC<ColorGradingWorkspaceProps> = ({
  graph = createEmptyColorGradingGraph(),
  onGraphChange,
  readOnly = false,
}) => {
  const activeNode = useMemo(() => graph.nodes.find((n) => n.id === graph.activeNodeId) || null, [graph]);

  const handleAddNode = useCallback(
    (node: ColorGradingNode) => {
      if (readOnly) return;
      onGraphChange({
        ...graph,
        nodes: [...graph.nodes, node],
        activeNodeId: node.id,
      });
    },
    [graph, onGraphChange, readOnly],
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      onGraphChange({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== nodeId),
        connections: graph.connections.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId),
        activeNodeId: graph.activeNodeId === nodeId ? null : graph.activeNodeId,
      });
    },
    [graph, onGraphChange, readOnly],
  );

  const handleSelectNode = useCallback(
    (nodeId: string | null) => {
      onGraphChange({ ...graph, activeNodeId: nodeId });
    },
    [graph, onGraphChange],
  );

  const handleWheelChange = useCallback(
    (params: PrimaryWheelParams) => {
      if (!activeNode || readOnly) return;
      onGraphChange({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, params } : n)),
      });
    },
    [graph, activeNode, onGraphChange, readOnly],
  );

  const handleSliderChange = useCallback(
    (params: PrimarySliderParams) => {
      if (!activeNode || readOnly) return;
      onGraphChange({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === activeNode.id ? { ...n, params } : n)),
      });
    },
    [graph, activeNode, onGraphChange, readOnly],
  );

  return (
    <div className="flex flex-col h-full bg-gray-800" data-testid="color-grading-workspace">
      {readOnly ? (
        <div
          className="mx-3 mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
          data-testid="collab-readonly-notice"
        >
          {zhCN.collabPanel.readonlyNotice}
        </div>
      ) : null}
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
          <ColorWheelPanel
            params={activeNode.params as PrimaryWheelParams}
            onChange={handleWheelChange}
            disabled={readOnly}
          />
        )}
        {activeNode?.type === 'primary-slider' && (
          <PrimarySlidersPanel
            params={activeNode.params as PrimarySliderParams}
            onChange={handleSliderChange}
            disabled={readOnly}
          />
        )}
        {!activeNode && (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">选择一个节点以编辑参数</div>
        )}
      </div>
    </div>
  );
};

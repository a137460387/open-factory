import React, { useCallback } from 'react';
import type { ColorGradingGraph, ColorNode, ColorNodeType } from '@open-factory/editor-core';
import { createColorNode } from '@open-factory/editor-core';

interface NodeGraphViewProps {
  graph: ColorGradingGraph;
  onAddNode: (node: ColorNode) => void;
  onRemoveNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
}

const NODE_COLORS: Record<ColorNodeType, string> = {
  'primary-wheel': '#3b82f6',
  'primary-slider': '#10b981',
  'curves': '#f59e0b',
  'hsl-qualifier': '#ef4444',
  'window-mask': '#8b5cf6',
  'tracking-mask': '#ec4899',
  'lut-apply': '#06b6d4',
  'color-space': '#6366f1',
  'mixer-node': '#f97316',
  'output': '#6b7280',
};

const NODE_LABELS: Record<ColorNodeType, string> = {
  'primary-wheel': '色轮',
  'primary-slider': '滑块',
  'curves': '曲线',
  'hsl-qualifier': 'HSL限定',
  'window-mask': '窗口遮罩',
  'tracking-mask': '跟踪遮罩',
  'lut-apply': 'LUT',
  'color-space': '色彩空间',
  'mixer-node': '混合',
  'output': '输出',
};

export const NodeGraphView: React.FC<NodeGraphViewProps> = ({
  graph,
  onAddNode,
  onRemoveNode,
  onSelectNode,
}) => {
  const handleAddNode = useCallback((type: ColorNodeType) => {
    const node = createColorNode(type, { x: 100 + graph.nodes.length * 150, y: 100 });
    onAddNode(node);
  }, [graph.nodes.length, onAddNode]);

  return (
    <div className="p-3" data-testid="node-graph-view">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-200">节点图</h3>
        <div className="flex gap-1">
          <button
            onClick={() => handleAddNode('primary-wheel')}
            className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-500"
            data-testid="add-wheel-node"
          >
            + 色轮
          </button>
          <button
            onClick={() => handleAddNode('primary-slider')}
            className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-500"
            data-testid="add-slider-node"
          >
            + 滑块
          </button>
        </div>
      </div>

      <div className="relative h-48 bg-gray-900 rounded border border-gray-700 overflow-auto">
        {graph.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            点击上方按钮添加调色节点
          </div>
        ) : (
          graph.nodes.map(node => (
            <div
              key={node.id}
              className="absolute px-3 py-2 rounded cursor-pointer text-xs text-white shadow-lg"
              style={{
                left: node.position.x,
                top: node.position.y,
                backgroundColor: NODE_COLORS[node.type],
              }}
              onClick={() => onSelectNode(node.id)}
              data-testid={`node-${node.type}`}
            >
              {NODE_LABELS[node.type]}
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id); }}
                className="ml-2 text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>
          ))
        )}

        {/* 连接线 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {graph.connections.map(conn => {
            const from = graph.nodes.find(n => n.id === conn.fromNodeId);
            const to = graph.nodes.find(n => n.id === conn.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={conn.id}
                x1={from.position.x + 60}
                y1={from.position.y + 15}
                x2={to.position.x}
                y2={to.position.y + 15}
                stroke="#9ca3af"
                strokeWidth={2}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

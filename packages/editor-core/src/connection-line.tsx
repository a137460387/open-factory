import React from 'react';
import type {ConnectionLineProps} from './node-editor-panel-types';

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  sourceNode,
  targetNode,
  sourceDef,
  targetDef,
}) => {
  const sourcePort = sourceDef.outputs.find(p => p.id === connection.sourcePortId);
  const targetPort = targetDef.inputs.find(p => p.id === connection.targetPortId);

  if (!sourcePort || !targetPort) return null;

  // Calculate port positions (simplified)
  const sourceX = sourceNode.position.x + 200; // Right side of source node
  const sourceY = sourceNode.position.y + 50; // Middle of source node
  const targetX = targetNode.position.x; // Left side of target node
  const targetY = targetNode.position.y + 50; // Middle of target node

  // Create bezier curve
  const midX = (sourceX + targetX) / 2;
  const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

  return (
    <path
      className="connection-line"
      d={path}
      stroke="#666"
      strokeWidth={2}
      fill="none"
    />
  );
};

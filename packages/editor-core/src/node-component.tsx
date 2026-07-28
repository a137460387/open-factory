import React from 'react';
import type {NodeComponentProps} from './node-editor-panel-types';

export const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  definition,
  isSelected,
  onSelect,
  onDragStart,
}) => {
  const inputPorts = definition.inputs;
  const outputPorts = definition.outputs;

  return (
    <div
      className={`node-component ${isSelected ? 'selected' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        borderColor: definition.color ?? '#666',
      }}
      onClick={() => onSelect(node.id)}
      onMouseDown={e => onDragStart(node.id, e)}
    >
      <div className="node-header" style={{ background: definition.color ?? '#333' }}>
        <span className="node-icon">{definition.icon ?? '⚙️'}</span>
        <span className="node-title">{node.label ?? definition.name}</span>
      </div>

      <div className="node-body">
        <div className="node-ports input-ports">
          {inputPorts.map(port => (
            <div key={port.id} className="node-port input-port">
              <div className="port-dot input-dot" data-port-id={port.id} />
              <span className="port-label">{port.name}</span>
            </div>
          ))}
        </div>

        <div className="node-ports output-ports">
          {outputPorts.map(port => (
            <div key={port.id} className="node-port output-port">
              <span className="port-label">{port.name}</span>
              <div className="port-dot output-dot" data-port-id={port.id} />
            </div>
          ))}
        </div>
      </div>

      {!node.enabled && <div className="node-disabled-overlay">Disabled</div>}
    </div>
  );
};

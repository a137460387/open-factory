/**
 * Node Editor Panel - Visual node-based workflow editor UI
 *
 * Provides a React component for creating and editing workflow graphs
 * with drag-and-drop node creation and connection management.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type {
  WorkflowGraph,
  WorkflowNode,
  NodeConnection,
  NodeDefinition,
  NodeCategory,
  WorkflowTemplate,
  WorkflowExecutionProgress,
} from './node-editor-types';
import { NodeEditorEngine, createNodeEditorEngine } from './node-editor-engine';
import { WorkflowExecutor, createWorkflowExecutor } from './workflow-executor';
import { getWorkflowTemplateLibrary } from './workflow-templates';

// ─── Types ─────────────────────────────────────────────────────────────────

interface NodeEditorPanelProps {
  initialGraph?: WorkflowGraph;
  onGraphChange?: (graph: WorkflowGraph) => void;
  onClose?: () => void;
}

interface NodeComponentProps {
  node: WorkflowNode;
  definition: NodeDefinition;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
}

interface NodePaletteProps {
  definitions: NodeDefinition[];
  onAddNode: (type: string) => void;
}

interface ExecutionPanelProps {
  progress: WorkflowExecutionProgress | null;
  onExecute: () => void;
  onAbort: () => void;
}

// ─── Node Component ────────────────────────────────────────────────────────

const NodeComponent: React.FC<NodeComponentProps> = ({
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

// ─── Node Palette ──────────────────────────────────────────────────────────

const NodePalette: React.FC<NodePaletteProps> = ({ definitions, onAddNode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | null>(null);

  const categories: NodeCategory[] = ['input', 'ai-engine', 'transform', 'output', 'control', 'utility'];

  const filteredDefinitions = useMemo(() => {
    let result = definitions;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        d =>
          d.name.toLowerCase().includes(lowerQuery) ||
          d.description.toLowerCase().includes(lowerQuery),
      );
    }

    if (selectedCategory) {
      result = result.filter(d => d.category === selectedCategory);
    }

    return result;
  }, [definitions, searchQuery, selectedCategory]);

  return (
    <div className="node-palette">
      <div className="palette-header">
        <h3>Nodes</h3>
        <input
          type="text"
          className="palette-search"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="palette-categories">
        <button
          className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="palette-nodes">
        {filteredDefinitions.map(def => (
          <div
            key={def.type}
            className="palette-node-item"
            onClick={() => onAddNode(def.type)}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('nodeType', def.type);
            }}
          >
            <span className="palette-node-icon">{def.icon ?? '⚙️'}</span>
            <div className="palette-node-info">
              <span className="palette-node-name">{def.name}</span>
              <span className="palette-node-desc">{def.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Connection Line ───────────────────────────────────────────────────────

interface ConnectionLineProps {
  connection: NodeConnection;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  sourceDef: NodeDefinition;
  targetDef: NodeDefinition;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
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

// ─── Execution Panel ───────────────────────────────────────────────────────

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  progress,
  onExecute,
  onAbort,
}) => {
  if (!progress) {
    return (
      <div className="execution-panel">
        <button className="execute-btn" onClick={onExecute}>
          ▶ Execute Workflow
        </button>
      </div>
    );
  }

  const percentage =
    progress.totalNodes > 0
      ? Math.round((progress.completedNodes / progress.totalNodes) * 100)
      : 0;

  return (
    <div className="execution-panel">
      <div className="execution-header">
        <span className="execution-status">{progress.status}</span>
        {progress.status === 'running' && (
          <button className="abort-btn" onClick={onAbort}>
            Abort
          </button>
        )}
      </div>

      <div className="execution-progress">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${percentage}%` }} />
        </div>
        <div className="progress-info">
          <span>{progress.completedNodes} / {progress.totalNodes} nodes</span>
          <span>{percentage}%</span>
        </div>
      </div>

      {progress.currentNodeId && (
        <div className="current-node">
          Processing: {progress.currentNodeId}
        </div>
      )}
    </div>
  );
};

// ─── Template Browser ──────────────────────────────────────────────────────

interface TemplateBrowserProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onClose: () => void;
}

const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  onSelectTemplate,
  onClose,
}) => {
  const library = useMemo(() => getWorkflowTemplateLibrary(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => library.getCategories(), [library]);
  const templates = useMemo(() => {
    let result = searchQuery ? library.searchTemplates(searchQuery) : library.getAllTemplates();
    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }
    return result;
  }, [library, searchQuery, selectedCategory]);

  return (
    <div className="template-browser">
      <div className="template-header">
        <h3>Workflow Templates</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="template-toolbar">
        <input
          type="text"
          className="template-search"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <div className="template-categories">
          <button
            className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="template-list">
        {templates.map(template => (
          <div
            key={template.id}
            className="template-item"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="template-info">
              <h4 className="template-name">{template.name}</h4>
              <p className="template-desc">{template.description}</p>
              <div className="template-tags">
                {template.tags.map(tag => (
                  <span key={tag} className="template-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="template-meta">
              <span className="template-usage">{template.usageCount} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Node Editor Panel ────────────────────────────────────────────────

export const NodeEditorPanel: React.FC<NodeEditorPanelProps> = ({
  initialGraph,
  onGraphChange,
  onClose,
}) => {
  const [engine] = useState(() => createNodeEditorEngine(initialGraph));
  const [executor] = useState(() => createWorkflowExecutor(engine));
  const [graph, setGraph] = useState<WorkflowGraph>(engine.getGraph());
  const [state, setState] = useState(engine.getState());
  const [progress, setProgress] = useState<WorkflowExecutionProgress | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [nodeDefinitions] = useState<NodeDefinition[]>(() => engine.getNodeDefinitions());

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const unsubGraph = engine.onGraphChange(setGraph);
    const unsubState = engine.onStateChange(setState);
    const unsubProgress = executor.onProgress(setProgress);

    return () => {
      unsubGraph();
      unsubState();
      unsubProgress();
    };
  }, [engine, executor]);

  useEffect(() => {
    if (onGraphChange) {
      onGraphChange(graph);
    }
  }, [graph, onGraphChange]);

  // ─── Node Operations ─────────────────────────────────────────────────────

  const handleAddNode = useCallback(
    (type: string) => {
      const position = {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      };
      engine.addNode(type, position);
    },
    [engine],
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      engine.selectNode(nodeId);
    },
    [engine],
  );

  const handleDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      const node = engine.getNode(nodeId);
      if (!node) return;

      dragRef.current = {
        nodeId,
        offsetX: e.clientX - node.position.x,
        offsetY: e.clientY - node.position.y,
      };
    },
    [engine],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;

      const { nodeId, offsetX, offsetY } = dragRef.current;
      engine.updateNodePosition(nodeId, {
        x: e.clientX - offsetX,
        y: e.clientY - offsetY,
      });
    },
    [engine],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        engine.deleteSelected();
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        engine.selectAll();
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        engine.copy();
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        engine.paste();
      } else if (e.key === 'Escape') {
        engine.clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  // ─── Execution ───────────────────────────────────────────────────────────

  const handleExecute = useCallback(async () => {
    await executor.execute(graph);
  }, [executor, graph]);

  const handleAbort = useCallback(() => {
    executor.abort();
  }, [executor]);

  // ─── Templates ───────────────────────────────────────────────────────────

  const handleSelectTemplate = useCallback(
    (template: WorkflowTemplate) => {
      engine.importGraph(JSON.stringify(template.graph));
      setShowTemplates(false);
    },
    [engine],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const validation = useMemo(() => engine.validateGraph(), [engine, graph]);

  return (
    <div className="node-editor-panel">
      <div className="editor-header">
        <h2 className="editor-title">Workflow Editor</h2>
        <div className="editor-header-actions">
          <button
            className="editor-btn secondary"
            onClick={() => setShowTemplates(true)}
          >
            Templates
          </button>
          <button
            className="editor-btn secondary"
            onClick={() => engine.fitToView(800, 600)}
          >
            Fit View
          </button>
          {onClose && (
            <button className="editor-btn secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        <NodePalette
          definitions={nodeDefinitions}
          onAddNode={handleAddNode}
        />

        <div
          className="editor-canvas"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg className="connections-layer">
            {graph.connections.map(conn => {
              const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
              const targetNode = graph.nodes.find(n => n.id === conn.targetNodeId);
              const sourceDef = sourceNode ? engine.getNodeDefinition(sourceNode.type) : undefined;
              const targetDef = targetNode ? engine.getNodeDefinition(targetNode.type) : undefined;

              if (!sourceNode || !targetNode || !sourceDef || !targetDef) return null;

              return (
                <ConnectionLine
                  key={conn.id}
                  connection={conn}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  sourceDef={sourceDef}
                  targetDef={targetDef}
                />
              );
            })}
          </svg>

          <div className="nodes-layer">
            {graph.nodes.map(node => {
              const definition = engine.getNodeDefinition(node.type);
              if (!definition) return null;

              return (
                <NodeComponent
                  key={node.id}
                  node={node}
                  definition={definition}
                  isSelected={state.selectedNodeIds.includes(node.id)}
                  onSelect={handleSelectNode}
                  onDragStart={handleDragStart}
                />
              );
            })}
          </div>

          {graph.nodes.length === 0 && (
            <div className="empty-canvas">
              <p>Drag nodes from the palette or use a template to get started</p>
            </div>
          )}
        </div>

        <div className="editor-sidebar">
          <ExecutionPanel
            progress={progress}
            onExecute={handleExecute}
            onAbort={handleAbort}
          />

          {!validation.valid && (
            <div className="validation-errors">
              <h4>Validation Errors</h4>
              {validation.errors.map((error, i) => (
                <div key={i} className="validation-error">
                  {error.message}
                </div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="validation-warnings">
              <h4>Warnings</h4>
              {validation.warnings.map((warning, i) => (
                <div key={i} className="validation-warning">
                  {warning.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTemplates && (
        <TemplateBrowser
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

export const nodeEditorStyles = `
  .node-editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1a1a1a;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .editor-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .editor-header-actions {
    display: flex;
    gap: 8px;
  }

  .editor-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .editor-btn.primary {
    background: #0066ff;
    color: white;
  }

  .editor-btn.primary:hover {
    background: #0052cc;
  }

  .editor-btn.secondary {
    background: #333;
    color: #e0e0e0;
  }

  .editor-btn.secondary:hover {
    background: #444;
  }

  .editor-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .node-palette {
    width: 250px;
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
  }

  .palette-header {
    padding: 12px;
    border-bottom: 1px solid #333;
  }

  .palette-header h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .palette-search {
    width: 100%;
    padding: 6px 10px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
  }

  .palette-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #333;
  }

  .category-btn {
    padding: 4px 8px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 12px;
    color: #999;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-btn:hover {
    background: #333;
    color: #e0e0e0;
  }

  .category-btn.active {
    background: #0066ff;
    border-color: #0066ff;
    color: white;
  }

  .palette-nodes {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .palette-node-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .palette-node-item:hover {
    background: #2a2a2a;
  }

  .palette-node-icon {
    font-size: 20px;
  }

  .palette-node-info {
    display: flex;
    flex-direction: column;
  }

  .palette-node-name {
    font-size: 12px;
    font-weight: 500;
  }

  .palette-node-desc {
    font-size: 10px;
    color: #666;
  }

  .editor-canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #222;
    background-image: radial-gradient(circle, #333 1px, transparent 1px);
    background-size: 20px 20px;
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .nodes-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .node-component {
    position: absolute;
    width: 200px;
    background: #2a2a2a;
    border: 2px solid #666;
    border-radius: 8px;
    cursor: move;
    user-select: none;
    transition: border-color 0.2s;
  }

  .node-component.selected {
    border-color: #0066ff;
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.3);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px 6px 0 0;
    color: white;
  }

  .node-icon {
    font-size: 16px;
  }

  .node-title {
    font-size: 12px;
    font-weight: 600;
  }

  .node-body {
    padding: 8px;
  }

  .node-ports {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .node-port {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .input-port {
    justify-content: flex-start;
  }

  .output-port {
    justify-content: flex-end;
  }

  .port-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
  }

  .port-dot.input-dot {
    background: #4CAF50;
  }

  .port-dot.output-dot {
    background: #2196F3;
  }

  .port-label {
    color: #999;
  }

  .node-disabled-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #999;
    border-radius: 6px;
  }

  .connection-line {
    pointer-events: stroke;
  }

  .empty-canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #666;
  }

  .empty-canvas p {
    margin: 0;
    font-size: 14px;
  }

  .editor-sidebar {
    width: 250px;
    border-left: 1px solid #333;
    padding: 12px;
    overflow-y: auto;
  }

  .execution-panel {
    margin-bottom: 16px;
  }

  .execute-btn {
    width: 100%;
    padding: 10px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .execute-btn:hover {
    background: #45a049;
  }

  .abort-btn {
    padding: 6px 12px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .execution-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .execution-status {
    font-size: 12px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .execution-progress {
    margin-bottom: 8px;
  }

  .progress-bar-container {
    height: 6px;
    background: #333;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .progress-bar {
    height: 100%;
    background: #4CAF50;
    transition: width 0.3s ease;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #999;
  }

  .current-node {
    font-size: 11px;
    color: #666;
  }

  .validation-errors,
  .validation-warnings {
    margin-top: 16px;
  }

  .validation-errors h4,
  .validation-warnings h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .validation-errors h4 {
    color: #dc3545;
  }

  .validation-warnings h4 {
    color: #ffc107;
  }

  .validation-error,
  .validation-warning {
    padding: 6px 8px;
    margin-bottom: 4px;
    font-size: 11px;
    border-radius: 4px;
  }

  .validation-error {
    background: rgba(220, 53, 69, 0.1);
    color: #dc3545;
  }

  .validation-warning {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
  }

  .template-browser {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #1a1a1a;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #333;
  }

  .template-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #999;
    font-size: 24px;
    cursor: pointer;
  }

  .template-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid #333;
  }

  .template-search {
    width: 100%;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    margin-bottom: 12px;
  }

  .template-categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .template-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .template-item {
    display: flex;
    justify-content: space-between;
    padding: 16px;
    background: #2a2a2a;
    border: 1px solid #333;
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .template-item:hover {
    border-color: #555;
  }

  .template-info {
    flex: 1;
  }

  .template-name {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 500;
  }

  .template-desc {
    margin: 0 0 8px;
    font-size: 12px;
    color: #999;
  }

  .template-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .template-tag {
    padding: 2px 6px;
    background: #333;
    border-radius: 10px;
    font-size: 10px;
    color: #666;
  }

  .template-meta {
    display: flex;
    align-items: center;
  }

  .template-usage {
    font-size: 11px;
    color: #666;
  }
`;

export default NodeEditorPanel;

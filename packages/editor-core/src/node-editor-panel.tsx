/**
 * Node Editor Panel - Visual node-based workflow editor UI
 *
 * Provides a React component for creating and editing workflow graphs
 * with drag-and-drop node creation and connection management.
 */

import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import type {WorkflowGraph, NodeDefinition, WorkflowExecutionProgress, WorkflowTemplate} from './node-editor-types';
import {createNodeEditorEngine} from './node-editor-engine';
import {createWorkflowExecutor} from './workflow-executor';
import type {NodeEditorPanelProps} from './node-editor-panel-types';
import {NodeComponent} from './node-component';
import {NodePalette} from './node-palette';
import {ConnectionLine} from './connection-line';
import {ExecutionPanel} from './execution-panel';
import {TemplateBrowser} from './template-browser';

export {nodeEditorStyles} from './node-editor-panel-styles';
export type {NodeEditorPanelProps} from './node-editor-panel-types';

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

export default NodeEditorPanel;

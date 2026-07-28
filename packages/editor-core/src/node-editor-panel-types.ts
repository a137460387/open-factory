import type {WorkflowGraph, WorkflowNode, NodeConnection, NodeDefinition, NodeCategory, WorkflowTemplate, WorkflowExecutionProgress} from './node-editor-types';

export interface NodeEditorPanelProps {
  initialGraph?: WorkflowGraph;
  onGraphChange?: (graph: WorkflowGraph) => void;
  onClose?: () => void;
}

export interface NodeComponentProps {
  node: WorkflowNode;
  definition: NodeDefinition;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
}

export interface NodePaletteProps {
  definitions: NodeDefinition[];
  onAddNode: (type: string) => void;
}

export interface ExecutionPanelProps {
  progress: WorkflowExecutionProgress | null;
  onExecute: () => void;
  onAbort: () => void;
}

export interface ConnectionLineProps {
  connection: NodeConnection;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  sourceDef: NodeDefinition;
  targetDef: NodeDefinition;
}

export interface TemplateBrowserProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onClose: () => void;
}

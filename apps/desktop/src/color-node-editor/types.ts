import type {Clip, ColorNode, ColorNodeGraph, ColorNodeType} from '@open-factory/editor-core';

export const BOARD_WIDTH = 1280;
export const BOARD_HEIGHT = 720;
export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 186;
export const NODE_SPACING_X = 252;
export const NODE_SPACING_Y = 88;

export interface ColorNodeEditorDialogProps {
  clip: Clip;
  onApply(graph: ColorNodeGraph): void;
  onClose(): void;
}

export interface NodeDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

export interface ConnectionDragState {
  fromNodeId: string;
  pointerX: number;
  pointerY: number;
}

export interface NodeCardProps {
  node: ColorNode;
  selected: boolean;
  onSelect(): void;
  onPatch(patch: Partial<ColorNode>): void;
  onBeginDrag(event: React.PointerEvent<HTMLButtonElement>): void;
  onBeginConnection(event: React.PointerEvent<HTMLButtonElement>): void;
  onEndConnection(): void;
}

export interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit(value: number): void;
  testId?: string;
  compact?: boolean;
}

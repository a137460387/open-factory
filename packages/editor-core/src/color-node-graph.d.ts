import { type ColorCurves, type ThreeWayColor } from './color-grading';
import { type InputColorSpace } from './color-log-luts';
import type { LUTLayer } from './model-types-primitives';
export type ColorNodeType = 'input' | 'sequential' | 'parallel' | 'layer' | 'output' | 'lut';
export type ColorNodeBlendMode = 'average' | 'normal' | 'multiply' | 'screen' | 'overlay' | 'addition';
export interface ColorNodeCorrection {
    inputColorSpace?: InputColorSpace;
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    lutPath?: string | null;
    luts?: LUTLayer[];
    colorCurves?: ColorCurves;
    threeWayColor?: ThreeWayColor;
}
export interface ColorNodePosition {
    x: number;
    y: number;
}
export interface ColorNode {
    id: string;
    type: ColorNodeType;
    name: string;
    position: ColorNodePosition;
    correction: ColorNodeCorrection;
    lutPath?: string | null;
    blendMode?: ColorNodeBlendMode;
    mix?: number;
    enabled?: boolean;
}
export interface ColorNodeConnection {
    id: string;
    from: string;
    to: string;
}
export interface ColorNodeGraph {
    version: 1;
    nodes: ColorNode[];
    connections: ColorNodeConnection[];
    outputNodeId: string;
}
export interface ColorNodeGraphTemplate {
    id: ColorNodeTemplateId;
    name: string;
    description: string;
    graph: ColorNodeGraph;
}
export type ColorNodeTemplateId = 'cinematic' | 'portrait' | 'landscape' | 'black-white' | 'negative';
export interface ColorNodeGraphArtifact {
    clipId: string;
    nodeId: string;
    kind: 'curve-lut' | 'log-lut';
    text: string;
    fileName: string;
    placeholder: string;
}
export interface BuildColorNodeGraphFilterPlanOptions {
    inputLabel: string;
    outputLabel: string;
    clipId?: string;
    mediaKind?: 'video' | 'audio';
    escapeFilePath?: (path: string) => string;
    registerArtifact?: (artifact: ColorNodeGraphArtifact) => string;
}
export interface ColorNodeGraphFilterPlan {
    filters: string[];
    outputLabel: string;
    order: ColorNode[];
}
export declare const DEFAULT_COLOR_NODE_CORRECTION: ColorNodeCorrection;
export declare class ColorNodeGraphCycleError extends Error {
    readonly nodeIds: string[];
    constructor(nodeIds: string[]);
}
export declare function createDefaultColorNodeGraph(correction?: Partial<ColorNodeCorrection>): ColorNodeGraph;
export declare function normalizeColorNodeCorrection(correction: Partial<ColorNodeCorrection> | undefined): ColorNodeCorrection;
export declare function isDefaultColorNodeCorrection(correction: Partial<ColorNodeCorrection> | undefined): boolean;
export declare function normalizeColorNodeGraph(graph: Partial<ColorNodeGraph> | undefined, fallbackCorrection?: Partial<ColorNodeCorrection>): ColorNodeGraph;
export declare function detectColorNodeGraphCycle(graph: Partial<ColorNodeGraph> | undefined): string[] | null;
export declare function topologicallySortColorNodeGraph(graph: Partial<ColorNodeGraph> | undefined): ColorNode[];
export declare function buildColorNodeGraphFilterPlan(graph: Partial<ColorNodeGraph> | undefined, options: BuildColorNodeGraphFilterPlanOptions): ColorNodeGraphFilterPlan;
export declare function serializeColorNodeGraphFile(graph: Partial<ColorNodeGraph>, name?: string): string;
export declare function parseColorNodeGraphFile(source: string): ColorNodeGraph;
export declare const BUILT_IN_COLOR_NODE_GRAPH_TEMPLATES: readonly ColorNodeGraphTemplate[];
//# sourceMappingURL=color-node-graph.d.ts.map
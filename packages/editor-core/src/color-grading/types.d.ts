import type { CurvePoint } from './color-curves';
import type { HSLQualifierParams } from './hsl-qualifier';
import type { WindowMaskParams } from './window-mask';
/** 调色节点类型 */
export type ColorGradingNodeType = 'primary-wheel' | 'primary-slider' | 'curves' | 'hsl-qualifier' | 'window-mask' | 'tracking-mask' | 'lut-apply' | 'color-space' | 'mixer-node' | 'output';
/** 一级色轮参数 */
export interface PrimaryWheelParams {
    lift: {
        r: number;
        g: number;
        b: number;
        y: number;
    };
    liftMaster: number;
    gamma: {
        r: number;
        g: number;
        b: number;
        y: number;
    };
    gammaMaster: number;
    gain: {
        r: number;
        g: number;
        b: number;
        y: number;
    };
    gainMaster: number;
    offset: {
        r: number;
        g: number;
        b: number;
        y: number;
    };
    offsetMaster: number;
}
/** 一级滑块参数 */
export interface PrimarySliderParams {
    temperature: number;
    tint: number;
    contrast: number;
    pivot: number;
    saturation: number;
    hue: number;
}
/** 曲线节点参数 */
export interface CurvesNodeParams {
    master: CurvePoint[];
    red: CurvePoint[];
    green: CurvePoint[];
    blue: CurvePoint[];
}
/** LUT 应用节点参数 */
export interface LUTApplyNodeParams {
    lutId: string;
    intensity: number;
}
/** 跟踪遮罩节点参数 */
export interface TrackingMaskNodeParams {
    trackingData: Array<{
        time: number;
        position: {
            x: number;
            y: number;
        };
        scale: number;
        rotation: number;
        confidence: number;
    }>;
    feather: number;
    expand: number;
    invert: boolean;
}
/** 节点参数联合类型 */
export type ColorGradingNodeParams = PrimaryWheelParams | PrimarySliderParams | HSLQualifierParams | WindowMaskParams | CurvesNodeParams | LUTApplyNodeParams | TrackingMaskNodeParams | Record<string, unknown>;
/** 调色节点 */
export interface ColorGradingNode {
    id: string;
    type: ColorGradingNodeType;
    enabled: boolean;
    params: ColorGradingNodeParams;
    inputs: string[];
    output: string | null;
    position: {
        x: number;
        y: number;
    };
}
/** 节点连接 */
export interface ColorGradingConnection {
    id: string;
    fromNodeId: string;
    fromOutput: string;
    toNodeId: string;
    toInput: string;
}
/** 节点图 */
export interface ColorGradingGraph {
    nodes: ColorGradingNode[];
    connections: ColorGradingConnection[];
    activeNodeId: string | null;
}
/** 创建默认一级色轮参数 */
export declare function createDefaultPrimaryWheelParams(): PrimaryWheelParams;
/** 创建默认一级滑块参数 */
export declare function createDefaultPrimarySliderParams(): PrimarySliderParams;
/** 创建空节点图 */
export declare function createEmptyColorGradingGraph(): ColorGradingGraph;
/** 创建调色节点 */
export declare function createColorGradingNode(type: ColorGradingNodeType, position?: {
    x: number;
    y: number;
}): ColorGradingNode;
/** 验证色轮参数范围 */
export declare function validatePrimaryWheelParams(params: PrimaryWheelParams): PrimaryWheelParams;
/** 验证滑块参数范围 */
export declare function validatePrimarySliderParams(params: PrimarySliderParams): PrimarySliderParams;
/** 归一化节点图（去除无效数据） */
export declare function normalizeColorGradingGraph(graph: unknown): ColorGradingGraph;
//# sourceMappingURL=types.d.ts.map
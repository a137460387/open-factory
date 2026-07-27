import { createDefaultHSLQualifierParams, validateHSLQualifierParams } from './hsl-qualifier';
import { createDefaultCircleMask, validateWindowMaskParams } from './window-mask';
import { clamp } from '../math-utils';
/** 创建默认一级色轮参数 */
export function createDefaultPrimaryWheelParams() {
    return {
        lift: { r: 0, g: 0, b: 0, y: 0 },
        liftMaster: 0,
        gamma: { r: 0, g: 0, b: 0, y: 0 },
        gammaMaster: 0,
        gain: { r: 0, g: 0, b: 0, y: 0 },
        gainMaster: 0,
        offset: { r: 0, g: 0, b: 0, y: 0 },
        offsetMaster: 0,
    };
}
/** 创建默认一级滑块参数 */
export function createDefaultPrimarySliderParams() {
    return {
        temperature: 0,
        tint: 0,
        contrast: 0,
        pivot: 0.5,
        saturation: 100,
        hue: 0,
    };
}
/** 创建空节点图 */
export function createEmptyColorGradingGraph() {
    return {
        nodes: [],
        connections: [],
        activeNodeId: null,
    };
}
/** 创建调色节点 */
export function createColorGradingNode(type, position = { x: 0, y: 0 }) {
    const id = `color-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let params;
    switch (type) {
        case 'primary-wheel':
            params = createDefaultPrimaryWheelParams();
            break;
        case 'primary-slider':
            params = createDefaultPrimarySliderParams();
            break;
        case 'hsl-qualifier':
            params = createDefaultHSLQualifierParams();
            break;
        case 'window-mask':
            params = createDefaultCircleMask();
            break;
        case 'curves':
            params = {
                master: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                red: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                green: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                blue: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            };
            break;
        case 'lut-apply':
            params = { lutId: '', intensity: 1.0 };
            break;
        case 'tracking-mask':
            params = {
                trackingData: [],
                feather: 10,
                expand: 0,
                invert: false,
            };
            break;
        case 'output':
        case 'color-space':
        case 'mixer-node':
            params = {};
            break;
        default:
            params = {};
    }
    return {
        id,
        type,
        enabled: true,
        params,
        inputs: [],
        output: null,
        position,
    };
}
/** 验证色轮参数范围 */
export function validatePrimaryWheelParams(params) {
    const clampChannel = (ch) => ({
        r: clamp(ch.r, -1, 1),
        g: clamp(ch.g, -1, 1),
        b: clamp(ch.b, -1, 1),
        y: clamp(ch.y, -1, 1),
    });
    return {
        lift: clampChannel(params.lift),
        liftMaster: clamp(params.liftMaster, -1, 1),
        gamma: clampChannel(params.gamma),
        gammaMaster: clamp(params.gammaMaster, -1, 1),
        gain: clampChannel(params.gain),
        gainMaster: clamp(params.gainMaster, -1, 1),
        offset: clampChannel(params.offset),
        offsetMaster: clamp(params.offsetMaster, -1, 1),
    };
}
/** 验证滑块参数范围 */
export function validatePrimarySliderParams(params) {
    return {
        temperature: clamp(params.temperature, -100, 100),
        tint: clamp(params.tint, -100, 100),
        contrast: clamp(params.contrast, -100, 100),
        pivot: clamp(params.pivot, 0, 1),
        saturation: clamp(params.saturation, 0, 200),
        hue: clamp(params.hue, -180, 180),
    };
}
/** 归一化节点图（去除无效数据） */
export function normalizeColorGradingGraph(graph) {
    if (!graph || typeof graph !== 'object') {
        return createEmptyColorGradingGraph();
    }
    const g = graph;
    const nodes = Array.isArray(g.nodes) ? g.nodes.filter(isValidColorNode).map(normalizeColorNode) : [];
    const connections = Array.isArray(g.connections) ? g.connections.filter(isValidConnection) : [];
    const nodeIds = new Set(nodes.map((n) => n.id));
    const activeNodeId = typeof g.activeNodeId === 'string' && nodeIds.has(g.activeNodeId) ? g.activeNodeId : null;
    return {
        nodes,
        connections: connections,
        activeNodeId,
    };
}
function isValidColorNode(node) {
    if (!node || typeof node !== 'object')
        return false;
    const n = node;
    return typeof n.id === 'string' && typeof n.type === 'string';
}
function normalizeColorNode(node) {
    const n = node;
    const type = n.type;
    let params;
    if (type === 'primary-wheel') {
        params = validatePrimaryWheelParams(n.params ?? createDefaultPrimaryWheelParams());
    }
    else if (type === 'primary-slider') {
        params = validatePrimarySliderParams(n.params ?? createDefaultPrimarySliderParams());
    }
    else if (type === 'hsl-qualifier') {
        params = validateHSLQualifierParams(n.params ?? createDefaultHSLQualifierParams());
    }
    else if (type === 'window-mask') {
        params = validateWindowMaskParams(n.params ?? createDefaultCircleMask());
    }
    else if (type === 'curves') {
        const p = n.params;
        params = {
            master: Array.isArray(p?.master)
                ? p.master
                : [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            red: Array.isArray(p?.red)
                ? p.red
                : [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            green: Array.isArray(p?.green)
                ? p.green
                : [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            blue: Array.isArray(p?.blue)
                ? p.blue
                : [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
        };
    }
    else if (type === 'lut-apply') {
        const p = n.params;
        params = {
            lutId: typeof p?.lutId === 'string' ? p.lutId : '',
            intensity: clamp(typeof p?.intensity === 'number' ? p.intensity : 1, 0, 1),
        };
    }
    else if (type === 'tracking-mask') {
        const p = n.params;
        params = {
            trackingData: Array.isArray(p?.trackingData) ? p.trackingData : [],
            feather: clamp(typeof p?.feather === 'number' ? p.feather : 10, 0, 100),
            expand: clamp(typeof p?.expand === 'number' ? p.expand : 0, -100, 100),
            invert: !!p?.invert,
        };
    }
    else {
        params = n.params ?? {};
    }
    return {
        id: n.id,
        type,
        enabled: n.enabled !== false,
        params,
        inputs: Array.isArray(n.inputs) ? n.inputs : [],
        output: typeof n.output === 'string' ? n.output : null,
        position: isValidPosition(n.position) ? n.position : { x: 0, y: 0 },
    };
}
function isValidPosition(pos) {
    if (!pos || typeof pos !== 'object')
        return false;
    const p = pos;
    return typeof p.x === 'number' && typeof p.y === 'number';
}
function isValidConnection(conn) {
    if (!conn || typeof conn !== 'object')
        return false;
    const c = conn;
    return typeof c.id === 'string' && typeof c.fromNodeId === 'string' && typeof c.toNodeId === 'string';
}
//# sourceMappingURL=types.js.map
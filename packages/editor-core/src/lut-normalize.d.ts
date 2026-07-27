/**
 * LUT 层标准化工具
 *
 * 从 model/clip-normalize.ts 中提取，消除 color-node-graph.ts 对
 * model/clip-normalize.ts 的依赖，打断循环依赖链。
 */
import type { LUTLayer } from './model-types-primitives';
export declare function normalizeLutLayers(luts: LUTLayer[] | undefined, lutPath?: string | null): LUTLayer[];
//# sourceMappingURL=lut-normalize.d.ts.map
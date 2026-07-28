/**
 * WebGPU 脏区域管理器
 * 批量合并脏区域以减少重绘次数
 */
import type { DirtyRegion } from './webgpu-types.js';
export declare class WebGPUDirtyRegionManager {
    private dirtyRegions;
    private batchTimeout;
    private readonly batchMs;
    constructor(batchMs?: number);
    addRegion(region: DirtyRegion): void;
    addClipChange(x: number, y: number, width: number, height: number): void;
    addEffectUpdate(x: number, y: number, width: number, height: number): void;
    addTransform(x: number, y: number, width: number, height: number): void;
    addScroll(x: number, y: number, width: number, height: number): void;
    addResize(x: number, y: number, width: number, height: number): void;
    flush(): DirtyRegion[];
    hasDirtyRegions(): boolean;
    clear(): void;
    private mergeRegions;
}
//# sourceMappingURL=webgpu-dirty-region.d.ts.map
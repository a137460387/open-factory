/**
 * WebGPU 脏区域管理器
 * 批量合并脏区域以减少重绘次数
 */
export class WebGPUDirtyRegionManager {
    dirtyRegions = [];
    batchTimeout = null;
    batchMs;
    constructor(batchMs = 8) {
        this.batchMs = batchMs;
    }
    addRegion(region) {
        this.dirtyRegions.push(region);
        if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => {
                this.flush();
            }, this.batchMs);
        }
    }
    addClipChange(x, y, width, height) {
        this.addRegion({ x, y, width, height, reason: 'clip-change' });
    }
    addEffectUpdate(x, y, width, height) {
        this.addRegion({ x, y, width, height, reason: 'effect-update' });
    }
    addTransform(x, y, width, height) {
        this.addRegion({ x, y, width, height, reason: 'transform' });
    }
    addScroll(x, y, width, height) {
        this.addRegion({ x, y, width, height, reason: 'scroll' });
    }
    addResize(x, y, width, height) {
        this.addRegion({ x, y, width, height, reason: 'resize' });
    }
    flush() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        const regions = this.mergeRegions(this.dirtyRegions);
        this.dirtyRegions = [];
        return regions;
    }
    hasDirtyRegions() {
        return this.dirtyRegions.length > 0;
    }
    clear() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        this.dirtyRegions = [];
    }
    mergeRegions(regions) {
        if (regions.length <= 1) {
            return regions;
        }
        // Simple merge: combine all regions into a single bounding box
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const region of regions) {
            minX = Math.min(minX, region.x);
            minY = Math.min(minY, region.y);
            maxX = Math.max(maxX, region.x + region.width);
            maxY = Math.max(maxY, region.y + region.height);
        }
        return [{
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                reason: regions[0].reason,
            }];
    }
}
//# sourceMappingURL=webgpu-dirty-region.js.map
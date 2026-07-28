/**
 * 导出队列共享类型 — 仅依赖 export-types 和 progressive/render-farm，
 * 不依赖 export-queue.ts 运行时。
 * scheduling.ts 和 versioned-batch.ts 导入 ExportTask 类型时从此文件读取，
 * 避免与 export-queue.ts 形成循环引用。
 */
export {};
//# sourceMappingURL=queue-types.js.map
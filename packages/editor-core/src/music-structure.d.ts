export type MusicStructureType = 'energy_rise' | 'energy_drop' | 'timbre_shift';
export interface MusicStructurePoint {
    time: number;
    type: MusicStructureType;
    confidence: number;
}
/** 阈值常量 */
export declare const RMS_CHANGE_THRESHOLD = 0.4;
export declare const CENTROID_SHIFT_THRESHOLD = 0.3;
export declare const MIN_INTERVAL_SECONDS = 8;
export declare const STRUCTURE_SNAP_TOLERANCE = 0.3;
export declare const STRUCTURE_WINDOW_DURATION = 4;
/**
 * 计算RMS（均方根能量）
 */
export declare function calculateRMS(samples: Float32Array | number[]): number;
/**
 * 计算频谱质心
 * magnitudes: 频率bin的幅值数组
 * sampleRate: 采样率
 */
export declare function calculateSpectralCentroid(magnitudes: Float32Array | number[], sampleRate: number): number;
/**
 * 计算频谱通量（相邻帧间频谱差异）
 */
export declare function calculateSpectralFlux(prevMagnitudes: Float32Array | number[], currMagnitudes: Float32Array | number[]): number;
/**
 * 对窗口数据计算RMS变化和质心偏移
 */
export declare function detectStructureBoundary(prevRMS: number, currRMS: number, prevCentroid: number, currCentroid: number): {
    isBoundary: boolean;
    type: MusicStructureType;
    confidence: number;
};
/**
 * 过滤候选点，保持最小间隔
 */
export declare function filterByMinInterval(points: MusicStructurePoint[], minInterval?: number): MusicStructurePoint[];
/**
 * 从时间窗口数据检测音乐结构变化点
 * 输入：每个窗口的 { startTime, rms, centroid }
 */
export declare function detectMusicStructure(windows: Array<{
    startTime: number;
    rms: number;
    centroid: number;
}>): MusicStructurePoint[];
/**
 * 将clip边界吸附到最近的音乐结构标记
 * 返回吸附后的时间，若超出容差则返回null
 */
export declare function snapToNearestStructure(clipTime: number, structurePoints: MusicStructurePoint[], tolerance?: number): {
    snappedTime: number;
    point: MusicStructurePoint;
} | null;
//# sourceMappingURL=music-structure.d.ts.map
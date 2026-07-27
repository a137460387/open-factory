/** 帧采样数据（luma + 可选RGB） */
export interface FlashFrameSample {
    time: number;
    luma: number;
    r?: number;
    g?: number;
    b?: number;
}
/** 闪烁警告区间 */
export interface FlashWarning {
    startTime: number;
    endTime: number;
    flashRate: number;
    severity: 'low' | 'medium' | 'high';
    isRedFlash: boolean;
}
/** 阈值常量 */
export declare const FLASH_FLIP_RATE_THRESHOLD = 3;
export declare const FLASH_AMPLITUDE_THRESHOLD = 25.5;
export declare const RED_FLASH_R_THRESHOLD = 200;
export declare const RED_FLASH_RG_DIFF_THRESHOLD = 50;
export declare const RED_FLASH_RB_DIFF_THRESHOLD = 50;
export declare const SEVERITY_MEDIUM_RATE = 5;
export declare const SEVERITY_HIGH_RATE = 7;
export declare const WINDOW_DURATION = 1;
export declare const MIN_SAMPLES_PER_SECOND = 8;
/** 计算采样率（帧率/3，最低8fps） */
export declare function calculateSampleRate(frameRate: number): number;
/**
 * 从RGB计算luma（BT.709近似）
 */
export declare function calculateLuma(r: number, g: number, b: number): number;
/**
 * 检测单帧是否为大面积纯红色闪烁
 */
export declare function isRedFlashFrame(r: number, g: number, b: number): boolean;
/**
 * 计算luma翻转点。
 * 返回翻转事件数组：{ time, amplitude, isRedFlash }
 */
export declare function detectLumaFlips(samples: FlashFrameSample[]): Array<{
    time: number;
    amplitude: number;
    isRedFlash: boolean;
}>;
/**
 * 根据翻转率确定severity
 */
export declare function classifySeverity(flashRate: number, isRedFlash: boolean): 'low' | 'medium' | 'high';
/**
 * 生成降低闪烁的FFmpeg filter参数
 */
export declare function buildFlashReductionFilter(startTime: number, endTime: number): string[];
/**
 * 合并相邻或重叠的闪烁区间
 */
export declare function mergeFlashIntervals(intervals: FlashWarning[], mergeGap?: number): FlashWarning[];
/**
 * 主检测函数：对帧采样数据进行闪烁检测
 */
export declare function detectFlashWarnings(samples: FlashFrameSample[]): FlashWarning[];
//# sourceMappingURL=flash-warning.d.ts.map
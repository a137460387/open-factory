export type QualityMetric = 'ssim' | 'psnr' | 'vmaf';
export type QualityLevel = 'excellent' | 'average' | 'poor';
export declare function assessQualityMetric(metric: QualityMetric, value: number | undefined): QualityLevel | undefined;
//# sourceMappingURL=quality.d.ts.map
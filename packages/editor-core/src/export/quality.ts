export type QualityMetric = 'ssim' | 'psnr' | 'vmaf';
export type QualityLevel = 'excellent' | 'average' | 'poor';

export function assessQualityMetric(metric: QualityMetric, value: number | undefined): QualityLevel | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const score = value as number;
  switch (metric) {
    case 'ssim':
      if (score > 0.98) {
        return 'excellent';
      }
      return score >= 0.95 ? 'average' : 'poor';
    case 'psnr':
      if (score >= 40) {
        return 'excellent';
      }
      return score >= 30 ? 'average' : 'poor';
    case 'vmaf':
      if (score >= 90) {
        return 'excellent';
      }
      return score >= 70 ? 'average' : 'poor';
  }
}

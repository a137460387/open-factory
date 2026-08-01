import type { AIColorGradingSuggestion, AIColorGradingSuggestionItem } from './types';

export const COLOR_GRADING_PARAMETER_LIMITS: Record<string, { min: number; max: number }> = {
  brightness: { min: -1, max: 1 },
  contrast: { min: 0, max: 2 },
  saturation: { min: 0, max: 2 },
  hue: { min: -180, max: 180 },
  lift_r: { min: -1, max: 1 },
  lift_g: { min: -1, max: 1 },
  lift_b: { min: -1, max: 1 },
  gain_r: { min: -1, max: 1 },
  gain_g: { min: -1, max: 1 },
  gain_b: { min: -1, max: 1 },
};

export function parseColorGradingSuggestionResponse(json: unknown): AIColorGradingSuggestion | null {
  if (!json || typeof json !== 'object') return null;
  const input = json as Record<string, unknown>;
  const style = typeof input.style === 'string' ? input.style.trim() : '';
  const issues = Array.isArray(input.issues)
    ? (input.issues as unknown[])
        .filter((i): i is string => typeof i === 'string')
        .map((i) => i.trim())
        .filter(Boolean)
    : [];
  if (!Array.isArray(input.suggestions)) return null;
  const suggestions: AIColorGradingSuggestionItem[] = [];
  for (const item of input.suggestions as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const parameter = typeof entry.parameter === 'string' ? entry.parameter.trim().toLowerCase() : '';
    if (!parameter || !(parameter in COLOR_GRADING_PARAMETER_LIMITS)) continue;
    const limits = COLOR_GRADING_PARAMETER_LIMITS[parameter];
    const recommendedRaw =
      typeof entry.recommendedValue === 'number' ? entry.recommendedValue : Number(entry.recommendedValue);
    if (!Number.isFinite(recommendedRaw)) continue;
    const recommendedValue = Math.min(limits.max, Math.max(limits.min, Math.round(recommendedRaw * 100) / 100));
    const currentRaw = typeof entry.currentValue === 'number' ? entry.currentValue : undefined;
    const currentValue =
      currentRaw !== undefined
        ? Math.min(limits.max, Math.max(limits.min, Math.round(currentRaw * 100) / 100))
        : undefined;
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    suggestions.push({ parameter, currentValue, recommendedValue, reason });
  }
  if (suggestions.length === 0) return null;
  return { style, issues, suggestions };
}

export function buildColorGradingSystemPrompt(): string {
  return '你是一个专业的视频调色助手。用户会给你一帧视频画面的截图和当前的色彩校正参数。请分析画面的色调、曝光、饱和度等，给出调色建议。返回JSON格式：{"style": "风格描述", "issues": ["问题1","问题2"], "suggestions": [{"parameter": "brightness|contrast|saturation|hue|lift_r|lift_g|lift_b|gain_r|gain_g|gain_b", "currentValue": 当前值, "recommendedValue": 建议值, "reason": "原因"}]}。parameter取值范围：brightness(-1~1)、contrast(0~2)、saturation(0~2)、hue(-180~180)、lift_r/g/b(-1~1)、gain_r/g/b(-1~1)。只返回JSON，不要其他内容。';
}

export function mapColorParameterToColorCorrection(
  parameter: string,
  value: number,
): {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  threeWayColor?: { lift?: { r?: number; g?: number; b?: number }; gain?: { r?: number; g?: number; b?: number } };
} | null {
  switch (parameter) {
    case 'brightness':
      return { brightness: value };
    case 'contrast':
      return { contrast: value };
    case 'saturation':
      return { saturation: value };
    case 'hue':
      return { hue: value };
    case 'lift_r':
      return { threeWayColor: { lift: { r: value } } };
    case 'lift_g':
      return { threeWayColor: { lift: { g: value } } };
    case 'lift_b':
      return { threeWayColor: { lift: { b: value } } };
    case 'gain_r':
      return { threeWayColor: { gain: { r: value } } };
    case 'gain_g':
      return { threeWayColor: { gain: { g: value } } };
    case 'gain_b':
      return { threeWayColor: { gain: { b: value } } };
    default:
      return null;
  }
}

export function buildColorGradingColorCorrectionPatch(
  selectedItems: Array<{ parameter: string; recommendedValue: number }>,
): Record<string, unknown> | null {
  if (selectedItems.length === 0) return null;
  const patch: Record<string, unknown> = {};
  let threeWay: Record<string, unknown> | undefined;
  for (const item of selectedItems) {
    const mapped = mapColorParameterToColorCorrection(item.parameter, item.recommendedValue);
    if (!mapped) continue;
    if (mapped.threeWayColor) {
      if (!threeWay) threeWay = {};
      const tw = mapped.threeWayColor;
      if (tw.lift) {
        if (!threeWay.lift) threeWay.lift = {};
        Object.assign(threeWay.lift as Record<string, unknown>, tw.lift);
      }
      if (tw.gain) {
        if (!threeWay.gain) threeWay.gain = {};
        Object.assign(threeWay.gain as Record<string, unknown>, tw.gain);
      }
    } else {
      Object.assign(patch, mapped);
    }
  }
  if (threeWay) {
    patch.threeWayColor = threeWay;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

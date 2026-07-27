import { type EffectType } from './effects';
import type { Clip } from './model-types';
export type StyleTransferScope = {
    color: boolean;
    effects: boolean;
    lut: boolean;
};
export interface NumericStyleStat {
    mean: number;
    stddev: number;
    count: number;
}
export type ColorStyleKey = 'brightness' | 'contrast' | 'saturation' | 'hue';
export type EffectParamStyleSummary = ({
    kind: 'number';
} & NumericStyleStat) | {
    kind: 'string';
    value: string;
    count: number;
} | {
    kind: 'boolean';
    value: boolean;
    count: number;
};
export interface EffectStyleSummary {
    type: EffectType;
    count: number;
    enabledRatio: number;
    params: Record<string, EffectParamStyleSummary>;
}
export interface StyleSummary {
    clipCount: number;
    color: Record<ColorStyleKey, NumericStyleStat>;
    lutPath?: string | null;
    effects: EffectStyleSummary[];
}
export interface ApplyStyleTransferOptions {
    strength: number;
    scope?: Partial<StyleTransferScope>;
}
export declare function calculateStyleSummary(clips: readonly Clip[]): StyleSummary;
export declare function applyStyleToClip<TClip extends Clip>(clip: TClip, summary: StyleSummary, options: ApplyStyleTransferOptions): TClip;
export declare function blendNumericStyleValue(current: number, target: number, strengthFactor: number): number;
export declare function normalizeStyleTransferScope(scope: Partial<StyleTransferScope> | undefined): StyleTransferScope;
//# sourceMappingURL=style-transfer.d.ts.map
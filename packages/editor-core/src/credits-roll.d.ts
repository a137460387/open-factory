import type { CreditsRow, CreditsStyle } from './model-types';
export type { CreditsRow, CreditsStyle } from './model-types';
export declare const DEFAULT_CREDITS_ROLL_SPEED = 80;
export declare const DEFAULT_CREDITS_STYLE: CreditsStyle;
export declare function parseCreditsText(input: string): CreditsRow[];
export declare function formatCreditsRowsForTextfile(rows: CreditsRow[]): string;
export declare function calculateCreditsContentHeight(rows: CreditsRow[], style: Pick<CreditsStyle, 'fontSize' | 'lineSpacing'>): number;
export declare function buildCreditsRollYExpression(speed: number): string;
export declare function calculateCreditsRollYRange(input: {
    speed: number;
    duration: number;
    canvasHeight: number;
}): {
    startY: number;
    endY: number;
};
export declare function normalizeCreditsRows(rows: readonly Partial<CreditsRow>[] | undefined, fallbackText?: string): CreditsRow[];
export declare function normalizeCreditsStyle(style: Partial<CreditsStyle> | undefined): CreditsStyle;
export declare function normalizeCreditsRollSpeed(speed: unknown): number;
//# sourceMappingURL=credits-roll.d.ts.map
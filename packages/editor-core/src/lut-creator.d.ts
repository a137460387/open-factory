import { type ColorCurves, type RgbColor, type ThreeWayColor } from './color-grading';
import { type ColorMatchFrameSample, type ColorMatchTransform } from './color-match';
export type LutCreatorPrecision = 17 | 33 | 65;
export interface LutCreatorState {
    title: string;
    precision: LutCreatorPrecision;
    threeWayColor: ThreeWayColor;
    colorCurves: ColorCurves;
    referenceTransform: ColorMatchTransform | null;
    referenceName: string | null;
}
export interface LutCreatorMatrix {
    size: LutCreatorPrecision;
    values: RgbColor[];
}
export declare function createDefaultLutCreatorState(): LutCreatorState;
export declare function normalizeLutCreatorPrecision(value: unknown): LutCreatorPrecision;
export declare function normalizeLutCreatorState(state: Partial<LutCreatorState> | undefined): LutCreatorState;
export declare function buildLutCreatorReferenceTransform(reference: ColorMatchFrameSample | undefined): ColorMatchTransform | null;
export declare function applyLutCreatorGrade(input: RgbColor, state: Partial<LutCreatorState> | undefined): RgbColor;
export declare function buildLutCreatorMatrix(state: Partial<LutCreatorState> | undefined): LutCreatorMatrix;
export declare function serializeLutCreatorCube(state: Partial<LutCreatorState> | undefined, title?: string): string;
//# sourceMappingURL=lut-creator.d.ts.map
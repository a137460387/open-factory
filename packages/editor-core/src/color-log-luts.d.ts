export declare const REC709_INPUT_COLOR_SPACE: "rec709";
export declare const LOG_INPUT_COLOR_SPACES: readonly ["slog2", "slog3", "clog", "clog3", "llog", "vlog"];
export declare const INPUT_COLOR_SPACES: readonly ["rec709", "slog2", "slog3", "clog", "clog3", "llog", "vlog"];
export declare const LOG_TO_REC709_LUT_SIZE = 17;
export type LogInputColorSpace = (typeof LOG_INPUT_COLOR_SPACES)[number];
export type InputColorSpace = (typeof INPUT_COLOR_SPACES)[number];
export type Lut3dPoint = readonly [number, number, number];
export interface LogToRec709Lut {
    colorSpace: LogInputColorSpace;
    title: string;
    size: number;
    points: readonly Lut3dPoint[];
}
export declare const LOG_TO_REC709_LUTS: Record<LogInputColorSpace, LogToRec709Lut>;
export declare function normalizeInputColorSpace(value: unknown): InputColorSpace;
export declare function isLogInputColorSpace(value: InputColorSpace): value is LogInputColorSpace;
export declare function getLogToRec709Lut(colorSpace: InputColorSpace): LogToRec709Lut | undefined;
export declare function serializeLogToRec709Cube(colorSpace: LogInputColorSpace): string;
//# sourceMappingURL=color-log-luts.d.ts.map
/** 窗口遮罩形状 */
export type WindowMaskShape = 'circle' | 'linear-gradient' | 'polygon';
/** 窗口遮罩参数 */
export interface WindowMaskParams {
    shape: WindowMaskShape;
    circle?: {
        center: {
            x: number;
            y: number;
        };
        radius: number;
        softness: number;
        rotation: number;
    };
    linearGradient?: {
        startPoint: {
            x: number;
            y: number;
        };
        endPoint: {
            x: number;
            y: number;
        };
        softness: number;
    };
    polygon?: {
        points: {
            x: number;
            y: number;
        }[];
        softness: number;
    };
    invert: boolean;
    feather: number;
}
/** 创建默认圆形遮罩 */
export declare function createDefaultCircleMask(): WindowMaskParams;
/** 创建默认渐变遮罩 */
export declare function createDefaultGradientMask(): WindowMaskParams;
/** 验证窗口遮罩参数 */
export declare function validateWindowMaskParams(params: WindowMaskParams): WindowMaskParams;
/** 生成圆形遮罩 GLSL */
export declare function generateCircleMaskGLSL(prefix: string): string;
/** 生成渐变遮罩 GLSL */
export declare function generateGradientMaskGLSL(prefix: string): string;
//# sourceMappingURL=window-mask.d.ts.map
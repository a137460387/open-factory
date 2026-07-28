/** HSL 限定器参数 */
export interface HSLQualifierParams {
    /** 选中范围 - 色相 */
    hueRange: {
        center: number;
        width: number;
        softness: number;
    };
    /** 选中范围 - 饱和度 */
    saturationRange: {
        min: number;
        max: number;
        softness: number;
    };
    /** 选中范围 - 亮度 */
    luminanceRange: {
        min: number;
        max: number;
        softness: number;
    };
    /** 选中区域的调色调整 */
    adjustments: {
        hueShift: number;
        saturation: number;
        brightness: number;
        contrast: number;
        temperature: number;
        tint: number;
    };
    /** 显示模式 */
    viewMode: 'final' | 'matte' | 'overlay';
    /** 遮罩清理（去噪） */
    matteClean: number;
}
/** 创建默认 HSL 限定器参数 */
export declare function createDefaultHSLQualifierParams(): HSLQualifierParams;
/** 验证 HSL 限定器参数 */
export declare function validateHSLQualifierParams(params: HSLQualifierParams): HSLQualifierParams;
/** 生成 HSL 限定器 GLSL 代码 */
export declare function generateHSLQualifierGLSL(prefix: string): string;
/** 生成 HSL 限定器 FFmpeg 滤镜 */
export declare function toFfmpegSelectiveColor(params: HSLQualifierParams): string;
//# sourceMappingURL=hsl-qualifier.d.ts.map
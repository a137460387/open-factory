import type { PrimarySliderParams } from './types';
export declare class PrimarySliders {
    /**
     * 将滑块参数转换为 WebGL uniform 值
     */
    static toUniforms(params: PrimarySliderParams, prefix: string): Record<string, number>;
    /**
     * 生成 GLSL 着色器代码片段
     */
    static toGlslSnippet(prefix: string): string;
    /**
     * 生成 GLSL 函数定义
     */
    static generateGlslFunction(): string;
    /**
     * 转换为 FFmpeg 滤镜字符串
     */
    static toFfmpegFilter(params: PrimarySliderParams): string;
}
//# sourceMappingURL=primary-sliders.d.ts.map
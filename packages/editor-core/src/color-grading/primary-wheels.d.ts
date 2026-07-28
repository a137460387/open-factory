import type { PrimaryWheelParams } from './types';
export declare class PrimaryWheels {
    /**
     * 将色轮参数转换为 WebGL uniform 值
     */
    static toUniforms(params: PrimaryWheelParams, prefix: string): Record<string, number[]>;
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
    static toFfmpegFilter(params: PrimaryWheelParams): string;
}
//# sourceMappingURL=primary-wheels.d.ts.map
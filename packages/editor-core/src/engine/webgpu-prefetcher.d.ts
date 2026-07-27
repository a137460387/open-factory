/**
 * WebGPU 预测预加载器
 * 基于播放历史预测下一帧方向和速度
 */
export declare class WebGPUPredictivePrefetcher {
    private playbackHistory;
    private predictedDirection;
    private predictedSpeed;
    private readonly historyWindow;
    recordPlaybackPosition(time: number): void;
    getPredictedFrames(currentFrame: number, fps: number, prefetchCount: number): number[];
    getPrediction(): {
        direction: 'forward' | 'backward' | 'static';
        speed: number;
    };
    private updatePrediction;
}
//# sourceMappingURL=webgpu-prefetcher.d.ts.map
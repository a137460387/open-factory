/**
 * WebGPU 预测预加载器
 * 基于播放历史预测下一帧方向和速度
 */
export class WebGPUPredictivePrefetcher {
    playbackHistory = [];
    predictedDirection = 'forward';
    predictedSpeed = 1.0;
    historyWindow = 60;
    recordPlaybackPosition(time) {
        const now = performance.now();
        this.playbackHistory.push({ time, timestamp: now });
        if (this.playbackHistory.length > this.historyWindow) {
            this.playbackHistory.shift();
        }
        this.updatePrediction();
    }
    getPredictedFrames(currentFrame, fps, prefetchCount) {
        if (this.predictedDirection === 'static') {
            return [];
        }
        const frames = [];
        const direction = this.predictedDirection === 'forward' ? 1 : -1;
        for (let i = 1; i <= prefetchCount; i++) {
            const predictedFrame = currentFrame + (i * direction * this.predictedSpeed);
            frames.push(Math.round(predictedFrame));
        }
        return frames;
    }
    getPrediction() {
        return {
            direction: this.predictedDirection,
            speed: this.predictedSpeed,
        };
    }
    updatePrediction() {
        if (this.playbackHistory.length < 2) {
            return;
        }
        const recent = this.playbackHistory.slice(-10);
        const timeDiffs = [];
        const positionDiffs = [];
        for (let i = 1; i < recent.length; i++) {
            timeDiffs.push(recent[i].timestamp - recent[i - 1].timestamp);
            positionDiffs.push(recent[i].time - recent[i - 1].time);
        }
        const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        const avgPositionDiff = positionDiffs.reduce((a, b) => a + b, 0) / positionDiffs.length;
        if (Math.abs(avgPositionDiff) < 0.01) {
            this.predictedDirection = 'static';
        }
        else if (avgPositionDiff > 0) {
            this.predictedDirection = 'forward';
        }
        else {
            this.predictedDirection = 'backward';
        }
        this.predictedSpeed = Math.abs(avgPositionDiff / avgTimeDiff) * 1000;
    }
}
//# sourceMappingURL=webgpu-prefetcher.js.map
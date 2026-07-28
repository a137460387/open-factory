import { round } from './time';
/**
 * 获取序列的有效设置，未设置的字段继承项目级设置
 */
export function getEffectiveSequenceSettings(sequence, projectSettings) {
    const seqSettings = sequence.settings;
    if (!seqSettings) {
        return projectSettings;
    }
    return {
        fps: seqSettings.frameRate ?? projectSettings.fps,
        width: seqSettings.width ?? projectSettings.width,
        height: seqSettings.height ?? projectSettings.height,
        timecodeFormat: projectSettings.timecodeFormat,
        vfrHandling: projectSettings.vfrHandling,
        colorPipeline: projectSettings.colorPipeline,
        workingColorSpace: projectSettings.workingColorSpace,
    };
}
/**
 * 帧率变更时将 clip 位置从旧帧率重新对齐到新帧率
 * 不修改 clip.duration（那是源时间），只修改 clip.start
 */
export function recalculateClipStartsForFrameRate(timeline, oldFps, newFps) {
    if (oldFps <= 0 || newFps <= 0 || oldFps === newFps)
        return;
    const ratio = oldFps / newFps;
    for (const track of timeline.tracks) {
        for (const clip of track.clips) {
            clip.start = round(clip.start * ratio);
        }
    }
}
//# sourceMappingURL=sequence-settings.js.map
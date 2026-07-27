/**
 * Visual Highlight Detection Engine
 *
 * Detects highlight-worthy moments in video frames using:
 * - Motion intensity analysis (frame differencing)
 * - Scene transition detection (histogram comparison)
 * - Visual energy scoring (combined metric)
 *
 * All computations are local-only, no external AI calls.
 */
import { round } from './time';
export const DEFAULT_VISUAL_HIGHLIGHT_CONFIG = {
    motionThreshold: 0.15,
    sceneChangeThreshold: 0.4,
    windowSize: 5,
    minGapSeconds: 0.5,
    fps: 30,
};
// ==================== Frame Analysis ====================
/**
 * Calculate motion intensity between two frames using pixel difference.
 * frames are flat grayscale arrays (width * height).
 */
export function calculateMotionIntensity(prevFrame, currFrame, pixelCount) {
    if (pixelCount <= 0)
        return 0;
    let totalDiff = 0;
    const len = Math.min(pixelCount, prevFrame.length, currFrame.length);
    for (let i = 0; i < len; i += 1) {
        totalDiff += Math.abs(prevFrame[i] - currFrame[i]);
    }
    // Normalize: max diff per pixel is 255
    return Math.min(1, totalDiff / (len * 255));
}
/**
 * Calculate scene change score using histogram-based comparison.
 * Divides each frame into blocks and compares average brightness.
 */
export function calculateSceneChangeScore(prevFrame, currFrame, width, height, gridSize = 8) {
    if (width < gridSize || height < gridSize)
        return 0;
    const blockW = Math.floor(width / gridSize);
    const blockH = Math.floor(height / gridSize);
    if (blockW < 1 || blockH < 1)
        return 0;
    let totalDiff = 0;
    let blockCount = 0;
    for (let gy = 0; gy < gridSize; gy += 1) {
        for (let gx = 0; gx < gridSize; gx += 1) {
            const bx = gx * blockW;
            const by = gy * blockH;
            let sumPrev = 0;
            let sumCurr = 0;
            let count = 0;
            for (let y = by; y < by + blockH && y < height; y += 1) {
                for (let x = bx; x < bx + blockW && x < width; x += 1) {
                    const idx = y * width + x;
                    if (idx < prevFrame.length)
                        sumPrev += prevFrame[idx];
                    if (idx < currFrame.length)
                        sumCurr += currFrame[idx];
                    count += 1;
                }
            }
            if (count > 0) {
                const avgPrev = sumPrev / count;
                const avgCurr = sumCurr / count;
                totalDiff += Math.abs(avgPrev - avgCurr) / 255;
                blockCount += 1;
            }
        }
    }
    return blockCount > 0 ? Math.min(1, totalDiff / blockCount) : 0;
}
/**
 * Calculate combined visual energy from motion and scene change scores.
 */
export function calculateVisualEnergy(motionIntensity, sceneChangeScore, motionWeight = 0.6, sceneWeight = 0.4) {
    return Math.min(1, motionIntensity * motionWeight + sceneChangeScore * sceneWeight);
}
// ==================== Highlight Detection ====================
/**
 * Smooth a metric array using a sliding window average.
 */
export function smoothMetrics(values, windowSize) {
    if (values.length === 0 || windowSize <= 1)
        return [...values];
    const half = Math.floor(windowSize / 2);
    return values.map((_, i) => {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j += 1) {
            sum += values[j];
            count += 1;
        }
        return round(sum / count);
    });
}
/**
 * Find local maxima in an array that exceed a threshold.
 */
export function findPeaks(values, threshold, minGap) {
    const peaks = [];
    for (let i = 1; i < values.length - 1; i += 1) {
        if (values[i] >= threshold && values[i] > values[i - 1] && values[i] >= values[i + 1]) {
            // Check minimum gap from last peak
            if (peaks.length === 0 || i - peaks[peaks.length - 1].index >= minGap) {
                peaks.push({ index: i, value: values[i] });
            }
        }
    }
    return peaks;
}
/**
 * Run full visual highlight detection on a sequence of frames.
 *
 * @param frames - Array of grayscale frame data (flat arrays)
 * @param width - Frame width in pixels
 * @param height - Frame height in pixels
 * @param config - Detection configuration
 */
export function detectVisualHighlights(frames, width, height, config = {}) {
    const cfg = { ...DEFAULT_VISUAL_HIGHLIGHT_CONFIG, ...config };
    const pixelCount = width * height;
    if (frames.length < 2) {
        return {
            frameMetrics: [],
            highlights: [],
            energyCurve: [],
            stats: { totalFrames: frames.length, highlightCount: 0, avgMotionIntensity: 0, avgSceneChange: 0 },
        };
    }
    // Calculate per-frame metrics
    const rawMetrics = [];
    for (let i = 0; i < frames.length; i += 1) {
        const time = round(i / cfg.fps);
        if (i === 0) {
            rawMetrics.push({ frameIndex: 0, time, motionIntensity: 0, sceneChangeScore: 0, visualEnergy: 0 });
        }
        else {
            const motionIntensity = round(calculateMotionIntensity(frames[i - 1], frames[i], pixelCount));
            const sceneChangeScore = round(calculateSceneChangeScore(frames[i - 1], frames[i], width, height));
            const visualEnergy = round(calculateVisualEnergy(motionIntensity, sceneChangeScore));
            rawMetrics.push({ frameIndex: i, time, motionIntensity, sceneChangeScore, visualEnergy });
        }
    }
    // Smooth the energy curve
    const rawEnergies = rawMetrics.map((m) => m.visualEnergy);
    const smoothedEnergies = smoothMetrics(rawEnergies, cfg.windowSize);
    // Update metrics with smoothed values
    const frameMetrics = rawMetrics.map((m, i) => ({
        ...m,
        visualEnergy: smoothedEnergies[i],
    }));
    // Find highlight peaks
    const minGapFrames = Math.max(1, Math.round(cfg.minGapSeconds * cfg.fps));
    const motionPeaks = findPeaks(frameMetrics.map((m) => m.motionIntensity), cfg.motionThreshold, minGapFrames);
    const scenePeaks = findPeaks(frameMetrics.map((m) => m.sceneChangeScore), cfg.sceneChangeThreshold, minGapFrames);
    const energyPeaks = findPeaks(smoothedEnergies, cfg.motionThreshold, minGapFrames);
    // Merge peaks into highlight markers
    const highlightMap = new Map();
    for (const peak of motionPeaks) {
        const m = frameMetrics[peak.index];
        highlightMap.set(peak.index, {
            time: m.time,
            frameIndex: m.frameIndex,
            score: peak.value,
            type: 'motion-peak',
            duration: round(1 / cfg.fps),
        });
    }
    for (const peak of scenePeaks) {
        const m = frameMetrics[peak.index];
        const existing = highlightMap.get(peak.index);
        if (!existing || peak.value > existing.score) {
            highlightMap.set(peak.index, {
                time: m.time,
                frameIndex: m.frameIndex,
                score: peak.value,
                type: 'scene-change',
                duration: round(1 / cfg.fps),
            });
        }
    }
    for (const peak of energyPeaks) {
        const m = frameMetrics[peak.index];
        const existing = highlightMap.get(peak.index);
        if (!existing || peak.value > existing.score) {
            highlightMap.set(peak.index, {
                time: m.time,
                frameIndex: m.frameIndex,
                score: peak.value,
                type: 'combined',
                duration: round(1 / cfg.fps),
            });
        }
    }
    const highlights = [...highlightMap.values()].sort((a, b) => b.score - a.score);
    // Build energy curve for timeline display
    const energyCurve = frameMetrics.map((m) => ({ time: m.time, value: m.visualEnergy }));
    // Calculate stats
    const totalMotion = frameMetrics.reduce((s, m) => s + m.motionIntensity, 0);
    const totalSceneChange = frameMetrics.reduce((s, m) => s + m.sceneChangeScore, 0);
    return {
        frameMetrics,
        highlights,
        energyCurve,
        stats: {
            totalFrames: frames.length,
            highlightCount: highlights.length,
            avgMotionIntensity: round(totalMotion / frameMetrics.length),
            avgSceneChange: round(totalSceneChange / frameMetrics.length),
        },
    };
}
/**
 * Merge visual highlights with audio beat markers for combined scoring.
 * Highlights near audio beats get a boost.
 */
export function mergeWithAudioBeats(visualHighlights, audioBeatTimes, toleranceSeconds = 0.3) {
    if (audioBeatTimes.length === 0)
        return visualHighlights;
    return visualHighlights.map((h) => {
        const nearBeat = audioBeatTimes.some((beat) => Math.abs(beat - h.time) <= toleranceSeconds);
        if (nearBeat) {
            return {
                ...h,
                score: Math.min(1, h.score * 1.3),
                type: 'combined',
            };
        }
        return h;
    });
}
/**
 * Extract highlight time ranges for MediaBin display.
 * Groups nearby highlights into ranges.
 */
export function extractHighlightRanges(highlights, mergeGap = 0.5) {
    if (highlights.length === 0)
        return [];
    const sorted = [...highlights].sort((a, b) => a.time - b.time);
    const ranges = [];
    let rangeStart = sorted[0].time;
    let rangeEnd = sorted[0].time + sorted[0].duration;
    let peakScore = sorted[0].score;
    let count = 1;
    for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].time - rangeEnd <= mergeGap) {
            rangeEnd = sorted[i].time + sorted[i].duration;
            peakScore = Math.max(peakScore, sorted[i].score);
            count += 1;
        }
        else {
            ranges.push({ start: round(rangeStart), end: round(rangeEnd), peakScore: round(peakScore), count });
            rangeStart = sorted[i].time;
            rangeEnd = sorted[i].time + sorted[i].duration;
            peakScore = sorted[i].score;
            count = 1;
        }
    }
    ranges.push({ start: round(rangeStart), end: round(rangeEnd), peakScore: round(peakScore), count });
    return ranges;
}
//# sourceMappingURL=visual-highlight-engine.js.map
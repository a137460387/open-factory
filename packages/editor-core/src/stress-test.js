import { createId } from './model';
import { round } from './time';
export const STRESS_SCENARIOS = [
    {
        id: 'mega-clips',
        label: '超大项目（500+ clip）',
        description: '在单一视频轨道上生成超过 500 个短片段，验证渲染和交互性能。',
    },
    {
        id: 'long-timeline',
        label: '超长时间线（4h+）',
        description: '生成总时长超过 4 小时的时间线，验证缩放和滚动性能。',
    },
    {
        id: 'mass-keyframes',
        label: '大量关键帧（100+/clip）',
        description: '在单个 clip 上添加超过 100 个关键帧，验证关键帧面板和插值性能。',
    },
    { id: 'deep-nested', label: '深度嵌套（5 层）', description: '生成 5 层嵌套序列，验证嵌套渲染和展开性能。' },
];
const DEGRADATION_THRESHOLD = 1.5;
const STRESS_SETTINGS = { fps: 30, timecodeFormat: 'frames', width: 1920, height: 1080 };
function emptyProjectFields() {
    return {
        version: '0.2',
        releaseVersion: '0.2',
        masterVolume: 1,
        mediaFolders: [],
        annotations: [],
        reviewAnnotations: [],
        collaborationNotes: [],
        timelineNotes: [],
        bookmarks: [],
        beatMarkers: [],
        exportRanges: [],
        protectedRanges: [],
        clipGroups: [],
        speakers: [],
        documentation: {},
    };
}
export function createVideoClipForStress(trackId, start, duration, index) {
    return {
        id: createId('clip'),
        type: 'video',
        name: `stress-clip-${index}`,
        trackId,
        start: round(start),
        duration: round(duration),
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        mediaId: `stress-media-${index % 10}`,
        volume: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    };
}
export function generateMegaClipsProject(clipCount = 520) {
    const trackId = createId('track');
    const clips = [];
    for (let i = 0; i < clipCount; i++) {
        clips.push(createVideoClipForStress(trackId, i * 2, 2, i));
    }
    const track = { id: trackId, type: 'video', name: 'Stress Track', clips };
    const timeline = { tracks: [track] };
    return {
        project: {
            id: createId('project'),
            name: 'stress-mega-clips',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...emptyProjectFields(),
            settings: STRESS_SETTINGS,
            media: [],
            mediaMetadata: {},
            sequences: [],
            activeSequenceId: '',
            timeline,
        },
        trackId,
    };
}
export function generateLongTimelineProject(targetHours = 4.5) {
    const clipDuration = 60;
    const totalClips = Math.ceil((targetHours * 3600) / clipDuration);
    const trackId = createId('track');
    const clips = [];
    for (let i = 0; i < totalClips; i++) {
        clips.push(createVideoClipForStress(trackId, i * clipDuration, clipDuration, i));
    }
    const track = { id: trackId, type: 'video', name: 'Long Track', clips };
    const timeline = { tracks: [track] };
    return {
        project: {
            id: createId('project'),
            name: 'stress-long-timeline',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...emptyProjectFields(),
            settings: STRESS_SETTINGS,
            media: [],
            mediaMetadata: {},
            sequences: [],
            activeSequenceId: '',
            timeline,
        },
        trackId,
    };
}
export function generateMassKeyframesProject(keyframeCount = 120) {
    const trackId = createId('track');
    const clipId = createId('clip');
    const clipDuration = keyframeCount * 0.5;
    const keyframes = Array.from({ length: keyframeCount }, (_, i) => ({
        id: createId('kf'),
        time: round((i / (keyframeCount - 1)) * clipDuration, 3),
        property: 'opacity',
        value: round(Math.abs(Math.sin(i * 0.1)), 3),
        easing: 'linear',
    }));
    const clip = {
        ...createVideoClipForStress(trackId, 0, clipDuration, 0),
        id: clipId,
        keyframes,
    };
    const track = { id: trackId, type: 'video', name: 'KF Track', clips: [clip] };
    const timeline = { tracks: [track] };
    return {
        project: {
            id: createId('project'),
            name: 'stress-mass-keyframes',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...emptyProjectFields(),
            settings: STRESS_SETTINGS,
            media: [],
            mediaMetadata: {},
            sequences: [],
            activeSequenceId: '',
            timeline,
        },
        trackId,
        clipId,
    };
}
export function generateDeepNestedProject(depth = 5) {
    const sequenceIds = [];
    let innerTimeline = {
        tracks: [
            {
                id: createId('track'),
                type: 'video',
                name: 'Inner',
                clips: [createVideoClipForStress('t0', 0, 10, 0)],
            },
        ],
    };
    const sequences = [];
    for (let d = 0; d < depth; d++) {
        const seqId = createId('seq');
        sequenceIds.push(seqId);
        sequences.push({ id: seqId, name: `nest-level-${d}`, timeline: innerTimeline });
        const refClipId = createId('clip');
        innerTimeline = {
            tracks: [
                {
                    id: createId('track'),
                    type: 'video',
                    name: `Level ${d}`,
                    clips: [
                        {
                            ...createVideoClipForStress('t', 0, 10, d),
                            id: refClipId,
                            sequenceRefId: seqId,
                        },
                    ],
                },
            ],
        };
    }
    const timeline = innerTimeline;
    return {
        project: {
            id: createId('project'),
            name: 'stress-deep-nested',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...emptyProjectFields(),
            settings: STRESS_SETTINGS,
            media: [],
            mediaMetadata: {},
            timeline,
            sequences,
            activeSequenceId: sequenceIds[sequenceIds.length - 1],
        },
        sequenceIds,
    };
}
export function generateStressScenario(scenarioId) {
    switch (scenarioId) {
        case 'mega-clips': {
            const { project } = generateMegaClipsProject();
            const clipCount = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
            return {
                project,
                metrics: { clipCount, totalDurationSec: clipCount * 2, maxKeyframesPerClip: 0, nestingDepth: 1 },
            };
        }
        case 'long-timeline': {
            const { project } = generateLongTimelineProject();
            const clipCount = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
            return {
                project,
                metrics: { clipCount, totalDurationSec: clipCount * 60, maxKeyframesPerClip: 0, nestingDepth: 1 },
            };
        }
        case 'mass-keyframes': {
            const { project, clipId } = generateMassKeyframesProject();
            const kfClip = project.timeline.tracks[0]?.clips.find((c) => c.id === clipId);
            return {
                project,
                metrics: {
                    clipCount: 1,
                    totalDurationSec: 60,
                    maxKeyframesPerClip: kfClip?.keyframes?.length ?? 0,
                    nestingDepth: 1,
                },
            };
        }
        case 'deep-nested': {
            const { project, sequenceIds } = generateDeepNestedProject();
            return {
                project,
                metrics: { clipCount: 1, totalDurationSec: 10, maxKeyframesPerClip: 0, nestingDepth: sequenceIds.length },
            };
        }
    }
}
export function measurePerfMetrics(baseMetrics, renderTimeMs, memoryUsageMb, exportEstimateSec) {
    return {
        ...baseMetrics,
        renderTimeMs: round(renderTimeMs),
        memoryUsageMb: round(memoryUsageMb),
        exportEstimateSec: round(exportEstimateSec),
    };
}
export function compareWithBaseline(metrics, baseline) {
    if (!baseline) {
        return [
            { metric: 'renderTimeMs', current: metrics.renderTimeMs, baseline: undefined, degraded: false },
            { metric: 'memoryUsageMb', current: metrics.memoryUsageMb, baseline: undefined, degraded: false },
            { metric: 'exportEstimateSec', current: metrics.exportEstimateSec, baseline: undefined, degraded: false },
        ];
    }
    return [
        {
            metric: 'renderTimeMs',
            current: metrics.renderTimeMs,
            baseline: baseline.renderTimeMs,
            degraded: metrics.renderTimeMs > baseline.renderTimeMs * DEGRADATION_THRESHOLD,
        },
        {
            metric: 'memoryUsageMb',
            current: metrics.memoryUsageMb,
            baseline: baseline.memoryUsageMb,
            degraded: metrics.memoryUsageMb > baseline.memoryUsageMb * DEGRADATION_THRESHOLD,
        },
        {
            metric: 'exportEstimateSec',
            current: metrics.exportEstimateSec,
            baseline: baseline.exportEstimateSec,
            degraded: metrics.exportEstimateSec > baseline.exportEstimateSec * DEGRADATION_THRESHOLD,
        },
    ];
}
export function buildStressReport(scenarioId, startedAt, metrics, baseline, version) {
    return {
        scenarioId,
        startedAt,
        completedAt: Date.now(),
        metrics,
        verdicts: compareWithBaseline(metrics, baseline),
        version,
    };
}
export function serializeStressReport(report) {
    return JSON.stringify(report, null, 2);
}
export function createIsolatedProjectContext(generator) {
    const result = generator();
    return {
        result,
        cleanup: () => {
            /* no-op in pure core; real cleanup handled by app shell */
        },
    };
}
//# sourceMappingURL=stress-test.js.map
import { normalizeColorCurves, normalizeThreeWayColor } from '../color-grading';
import { normalizeInputColorSpace } from '../color-log-luts';
import { normalizePathPoints } from '../masks/path-mask';
import { round } from '../time';
import { finiteOrDefault } from '../math-utils';
export { finiteOrDefault };
import { normalizeSceneCutTimes } from '../scene-cuts';
import { normalizeLutLayers } from '../lut-normalize';
import { CLIP_SLOW_MOTION_MODES, DEFAULT_AI_LOCAL_DENOISE, DEFAULT_AUDIO_DENOISE, DEFAULT_AUDIO_FADE_CURVE, DEFAULT_AUDIO_FADE_DURATION, DEFAULT_AUDIO_PITCH_SEMITONES, DEFAULT_CLIP_BORDER, DEFAULT_CLIP_PANORAMA_VIEW, DEFAULT_CLIP_PROJECTION, DEFAULT_CLIP_SPEED, DEFAULT_COLOR_CORRECTION, DEFAULT_CHROMA_KEY, DEFAULT_FRAME_INTERPOLATION, DEFAULT_MASK, DEFAULT_PRIVACY_BLUR, DEFAULT_SLOW_MOTION_MODE, DEFAULT_STABILIZATION, DEFAULT_TEXT_PATH, DEFAULT_TEXT_PATH_POINTS, DEFAULT_VIDEO_RESTORATION, FRAME_INTERPOLATION_MODES, FRAME_INTERPOLATION_TARGET_FPS, MAX_CHROMA_KEY_COLORS, MAX_CLIP_SPEED, MIN_CLIP_SPEED, VIDEO_TEMPORAL_DENOISE_PRESETS } from './defaults';
// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------
export function createId(prefix = 'id') {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) {
        return randomUuid;
    }
    return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
// ---------------------------------------------------------------------------
// Clip beat / BPM / scene-cut normalization
// ---------------------------------------------------------------------------
export function normalizeClipBeatMarkers(markers, maxTime) {
    if (!Array.isArray(markers)) {
        return undefined;
    }
    const limit = typeof maxTime === 'number' && Number.isFinite(maxTime) ? Math.max(0, maxTime) : Number.POSITIVE_INFINITY;
    const normalized = markers
        .filter((marker) => marker && typeof marker.time === 'number' && Number.isFinite(marker.time))
        .map((marker) => ({
        id: typeof marker.id === 'string' && marker.id ? marker.id : createId('beat'),
        time: round(Math.min(limit, Math.max(0, marker.time))),
    }))
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
    return normalized.length > 0 ? normalized : undefined;
}
export function normalizeDetectedBpm(bpm) {
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
        return undefined;
    }
    return round(Math.min(400, Math.max(1, bpm)));
}
export function normalizeClipSceneCuts(cuts, maxTime) {
    return normalizeSceneCutTimes(cuts, maxTime);
}
// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------
export function clampClipSpeed(speed) {
    if (typeof speed !== 'number' || !Number.isFinite(speed)) {
        return DEFAULT_CLIP_SPEED;
    }
    return round(Math.min(MAX_CLIP_SPEED, Math.max(MIN_CLIP_SPEED, speed ?? DEFAULT_CLIP_SPEED)));
}
// ---------------------------------------------------------------------------
// Color correction
// ---------------------------------------------------------------------------
export function normalizeColorCorrection(colorCorrection) {
    return {
        inputColorSpace: normalizeInputColorSpace(colorCorrection?.inputColorSpace),
        brightness: round(Math.min(1, Math.max(-1, colorCorrection?.brightness ?? DEFAULT_COLOR_CORRECTION.brightness))),
        contrast: round(Math.min(2, Math.max(0, colorCorrection?.contrast ?? DEFAULT_COLOR_CORRECTION.contrast))),
        saturation: round(Math.min(2, Math.max(0, colorCorrection?.saturation ?? DEFAULT_COLOR_CORRECTION.saturation))),
        hue: round(Math.min(180, Math.max(-180, colorCorrection?.hue ?? DEFAULT_COLOR_CORRECTION.hue))),
        lutPath: normalizeLutPath(colorCorrection?.lutPath),
        luts: normalizeLutLayers(colorCorrection?.luts, colorCorrection?.lutPath),
        colorCurves: normalizeColorCurves(colorCorrection?.colorCurves),
        threeWayColor: normalizeThreeWayColor(colorCorrection?.threeWayColor),
    };
}
// ---------------------------------------------------------------------------
// Chroma key
// ---------------------------------------------------------------------------
export function normalizeChromaKey(chromaKey) {
    const colors = normalizeChromaKeyColors(chromaKey);
    const mode = normalizeChromaKeyMode(chromaKey?.mode);
    return {
        enabled: chromaKey?.enabled === true,
        mode,
        color: colors[0] ?? [...DEFAULT_CHROMA_KEY.color],
        colors,
        similarity: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.similarity, DEFAULT_CHROMA_KEY.similarity)))),
        blend: round(Math.min(1, Math.max(0, finiteOrDefault(chromaKey?.blend, DEFAULT_CHROMA_KEY.blend)))),
        spillSuppression: chromaKey?.spillSuppression === true,
        erosion: round(Math.min(5, Math.max(-5, finiteOrDefault(chromaKey?.erosion, DEFAULT_CHROMA_KEY.erosion)))),
        lumaThreshold: normalizeUnit(chromaKey?.lumaThreshold, DEFAULT_CHROMA_KEY.lumaThreshold),
        lumaTolerance: normalizeUnit(chromaKey?.lumaTolerance, DEFAULT_CHROMA_KEY.lumaTolerance),
        lumaSoftness: normalizeUnit(chromaKey?.lumaSoftness, DEFAULT_CHROMA_KEY.lumaSoftness),
        differenceReferenceTime: round(Math.max(0, finiteOrDefault(chromaKey?.differenceReferenceTime, DEFAULT_CHROMA_KEY.differenceReferenceTime))),
        differenceThreshold: normalizeUnit(chromaKey?.differenceThreshold, DEFAULT_CHROMA_KEY.differenceThreshold),
    };
}
export function isChromaKeyEnabled(chromaKey) {
    return normalizeChromaKey(chromaKey).enabled;
}
// ---------------------------------------------------------------------------
// Stabilization
// ---------------------------------------------------------------------------
export function normalizeStabilization(stabilization) {
    const trfPath = typeof stabilization?.trfPath === 'string' && stabilization.trfPath.trim() ? stabilization.trfPath.trim() : null;
    return {
        enabled: stabilization?.enabled === true,
        smoothing: Math.round(Math.min(100, Math.max(1, finiteOrDefault(stabilization?.smoothing, DEFAULT_STABILIZATION.smoothing)))),
        zoom: round(Math.min(5, Math.max(0, finiteOrDefault(stabilization?.zoom, DEFAULT_STABILIZATION.zoom)))),
        analyzed: stabilization?.analyzed === true,
        trfPath,
        ...normalizeShakeAnalysisFields(stabilization),
    };
}
function normalizeShakeAnalysisFields(stabilization) {
    if (!stabilization?.shakeScore && stabilization?.shakeScore !== 0)
        return {};
    const score = round(Math.max(0, Math.min(100, stabilization.shakeScore)));
    const validSeverities = ['low', 'medium', 'high'];
    const severity = validSeverities.includes(stabilization.severity)
        ? stabilization.severity
        : score < 20
            ? 'low'
            : score <= 50
                ? 'medium'
                : 'high';
    return {
        shakeScore: score,
        severity,
        suggestedFilter: stabilization.suggestedFilter === 'vidstab' ? 'vidstab' : 'none',
        sampledAt: typeof stabilization.sampledAt === 'number' && Number.isFinite(stabilization.sampledAt)
            ? stabilization.sampledAt
            : undefined,
    };
}
export function isStabilizationExportable(stabilization) {
    const normalized = normalizeStabilization(stabilization);
    return normalized.enabled && normalized.analyzed && Boolean(normalized.trfPath);
}
// ---------------------------------------------------------------------------
// Frame interpolation
// ---------------------------------------------------------------------------
export function normalizeFrameInterpolation(frameInterpolation) {
    const targetFps = FRAME_INTERPOLATION_TARGET_FPS.includes(frameInterpolation?.targetFps)
        ? frameInterpolation?.targetFps
        : DEFAULT_FRAME_INTERPOLATION.targetFps;
    const normalized = {
        enabled: frameInterpolation?.enabled === true,
        targetFps,
        mode: FRAME_INTERPOLATION_MODES.includes(frameInterpolation?.mode)
            ? frameInterpolation?.mode
            : DEFAULT_FRAME_INTERPOLATION.mode,
        protectionFrames: Math.min(5, Math.max(0, Math.round(Number.isFinite(frameInterpolation?.protectionFrames)
            ? frameInterpolation.protectionFrames
            : DEFAULT_FRAME_INTERPOLATION.protectionFrames))),
    };
    if (frameInterpolation?.quality && Number.isFinite(frameInterpolation.quality.ssim)) {
        normalized.quality = {
            ssim: Math.max(0, Math.min(1, frameInterpolation.quality.ssim)),
            grade: frameInterpolation.quality.grade === 'excellent' ||
                frameInterpolation.quality.grade === 'good' ||
                frameInterpolation.quality.grade === 'poor'
                ? frameInterpolation.quality.grade
                : 'poor',
            sampleCount: Math.max(0, Math.round(Number.isFinite(frameInterpolation.quality.sampleCount) ? frameInterpolation.quality.sampleCount : 0)),
            ...(typeof frameInterpolation.quality.evaluatedAt === 'string'
                ? { evaluatedAt: frameInterpolation.quality.evaluatedAt }
                : {}),
        };
    }
    return normalized;
}
// ---------------------------------------------------------------------------
// Slow motion / projection / panorama
// ---------------------------------------------------------------------------
export function normalizeSlowMotionMode(mode) {
    return CLIP_SLOW_MOTION_MODES.includes(mode)
        ? mode
        : DEFAULT_SLOW_MOTION_MODE;
}
export function normalizeClipProjection(projection) {
    return projection === 'equirectangular' || projection === 'cubemap' || projection === 'flat'
        ? projection
        : DEFAULT_CLIP_PROJECTION;
}
export function normalizeClipPanoramaView(panorama) {
    return {
        yaw: normalizePanoramaDegrees(panorama?.yaw, DEFAULT_CLIP_PANORAMA_VIEW.yaw),
        pitch: round(Math.min(90, Math.max(-90, finiteOrDefault(panorama?.pitch, DEFAULT_CLIP_PANORAMA_VIEW.pitch)))),
        roll: normalizePanoramaDegrees(panorama?.roll, DEFAULT_CLIP_PANORAMA_VIEW.roll),
        fov: round(Math.min(120, Math.max(60, finiteOrDefault(panorama?.fov, DEFAULT_CLIP_PANORAMA_VIEW.fov)))),
        outputProjection: panorama?.outputProjection === 'equirectangular' || panorama?.outputProjection === 'flat'
            ? panorama.outputProjection
            : DEFAULT_CLIP_PANORAMA_VIEW.outputProjection,
    };
}
function normalizePanoramaDegrees(value, fallback) {
    return round(Math.min(180, Math.max(-180, finiteOrDefault(value, fallback))));
}
// ---------------------------------------------------------------------------
// Video restoration / deinterlace
// ---------------------------------------------------------------------------
export function normalizeVideoDenoisePreset(preset) {
    return preset === 'low' || preset === 'medium' || preset === 'high' || preset === 'custom' || preset === 'off'
        ? preset
        : 'off';
}
export function normalizeVideoRestoration(restoration) {
    const preset = normalizeVideoDenoisePreset(restoration?.temporalDenoise?.preset);
    const presetValues = preset === 'low' || preset === 'medium' || preset === 'high'
        ? VIDEO_TEMPORAL_DENOISE_PRESETS[preset]
        : DEFAULT_VIDEO_RESTORATION.temporalDenoise;
    const temporalSource = preset === 'custom' ? restoration?.temporalDenoise : presetValues;
    return {
        deinterlace: {
            enabled: restoration?.deinterlace?.enabled === true,
            mode: restoration?.deinterlace?.mode === 1 ? 1 : 0,
        },
        temporalDenoise: {
            preset,
            lumaSpatial: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.lumaSpatial, DEFAULT_VIDEO_RESTORATION.temporalDenoise.lumaSpatial)))),
            chromaSpatial: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.chromaSpatial, DEFAULT_VIDEO_RESTORATION.temporalDenoise.chromaSpatial)))),
            lumaTmp: round(Math.min(20, Math.max(0, finiteOrDefault(temporalSource?.lumaTmp, DEFAULT_VIDEO_RESTORATION.temporalDenoise.lumaTmp)))),
        },
        spatialDenoise: {
            enabled: restoration?.spatialDenoise?.enabled === true,
            strength: round(Math.min(30, Math.max(0, finiteOrDefault(restoration?.spatialDenoise?.strength, DEFAULT_VIDEO_RESTORATION.spatialDenoise.strength)))),
            patchSize: normalizeOddKernel(restoration?.spatialDenoise?.patchSize, DEFAULT_VIDEO_RESTORATION.spatialDenoise.patchSize, 1, 99),
            researchSize: normalizeOddKernel(restoration?.spatialDenoise?.researchSize, DEFAULT_VIDEO_RESTORATION.spatialDenoise.researchSize, 1, 99),
        },
    };
}
export function suggestDeinterlaceMode(fieldOrder) {
    const normalized = fieldOrder?.trim().toLowerCase();
    if (!normalized || normalized === 'unknown' || normalized === 'progressive') {
        return null;
    }
    return normalized === 'tt' ||
        normalized === 'bb' ||
        normalized === 'tb' ||
        normalized === 'bt' ||
        normalized.includes('field')
        ? 0
        : null;
}
function normalizeOddKernel(value, fallback, min, max) {
    const rounded = Math.round(Math.min(max, Math.max(min, finiteOrDefault(value, fallback))));
    return rounded % 2 === 1 ? rounded : Math.min(max, rounded + 1);
}
// ---------------------------------------------------------------------------
// Quality enhancement
// ---------------------------------------------------------------------------
export function normalizeQualityEnhancement(enhancement) {
    return {
        superResolution: enhancement?.superResolution === true,
        deblock: enhancement?.deblock === true,
        colorBoost: enhancement?.colorBoost === true,
        frameCompensation: enhancement?.frameCompensation === true,
    };
}
// ---------------------------------------------------------------------------
// Motion track
// ---------------------------------------------------------------------------
export function normalizeMotionTrack(points, duration = Number.POSITIVE_INFINITY) {
    if (!Array.isArray(points)) {
        return undefined;
    }
    const maxTime = typeof duration === 'number' && Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
    const normalized = points.flatMap((point) => {
        if (!Number.isFinite(point.time) || !Number.isFinite(point.dx) || !Number.isFinite(point.dy)) {
            return [];
        }
        return [
            {
                time: round(Math.min(maxTime, Math.max(0, point.time))),
                dx: round(Math.min(100_000, Math.max(-100_000, point.dx))),
                dy: round(Math.min(100_000, Math.max(-100_000, point.dy))),
            },
        ];
    });
    normalized.sort((left, right) => left.time - right.time || left.dx - right.dx || left.dy - right.dy);
    return normalized.length > 0 ? normalized : undefined;
}
// ---------------------------------------------------------------------------
// Audio denoise / pitch / fade
// ---------------------------------------------------------------------------
export function normalizeAudioDenoise(audioDenoise) {
    return {
        enabled: audioDenoise?.enabled === true,
        strength: round(Math.min(1, Math.max(0, finiteOrDefault(audioDenoise?.strength, DEFAULT_AUDIO_DENOISE.strength)))),
    };
}
export function normalizeAILocalDenoise(aiLocalDenoise) {
    return {
        enabled: aiLocalDenoise?.enabled === true,
        strength: round(Math.min(1, Math.max(0, finiteOrDefault(aiLocalDenoise?.strength, DEFAULT_AI_LOCAL_DENOISE.strength)))),
        outputPath: aiLocalDenoise?.outputPath,
        originalPath: aiLocalDenoise?.originalPath,
        processedAt: aiLocalDenoise?.processedAt,
    };
}
export function normalizeAudioChannelRouting(mode) {
    return mode === 'mono-left' ||
        mode === 'mono-right' ||
        mode === 'mono-both' ||
        mode === 'swap-stereo' ||
        mode === 'stereo-left-mono' ||
        mode === 'stereo-right-mono' ||
        mode === 'stereo-to-mono'
        ? mode
        : 'normal';
}
export function normalizeAudioPitchSemitones(semitones) {
    return round(Math.min(12, Math.max(-12, finiteOrDefault(semitones, DEFAULT_AUDIO_PITCH_SEMITONES))));
}
export function normalizeAudioFadeCurve(curve) {
    return curve === 'ease-in' || curve === 'ease-out' || curve === 'ease-in-out' || curve === 'linear'
        ? curve
        : DEFAULT_AUDIO_FADE_CURVE;
}
export function normalizeAudioFadeDuration(duration, clipDuration = Number.POSITIVE_INFINITY) {
    const maxDuration = typeof clipDuration === 'number' && Number.isFinite(clipDuration)
        ? Math.max(0, clipDuration)
        : Number.POSITIVE_INFINITY;
    return round(Math.min(maxDuration, Math.max(0, finiteOrDefault(duration, DEFAULT_AUDIO_FADE_DURATION))));
}
// ---------------------------------------------------------------------------
// Masks
// ---------------------------------------------------------------------------
export function createMask(mask = {}) {
    return normalizeMask({ ...mask, id: mask.id ?? createId('mask') });
}
export function normalizeMask(mask) {
    const w = normalizePositiveUnit(mask?.w, DEFAULT_MASK.w);
    const h = normalizePositiveUnit(mask?.h, DEFAULT_MASK.h);
    const type = mask?.type === 'ellipse' || mask?.type === 'path' ? mask.type : 'rect';
    const path = type === 'path' ? normalizePathPoints(mask?.path) : undefined;
    const keyframes = normalizeMaskKeyframes(mask?.keyframes);
    const privacyBlur = normalizePrivacyBlur(mask?.privacyBlur);
    return {
        id: typeof mask?.id === 'string' && mask.id.trim() ? mask.id : createId('mask'),
        type,
        x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(mask?.x, DEFAULT_MASK.x)))),
        y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(mask?.y, DEFAULT_MASK.y)))),
        w,
        h,
        ...(path ? { path } : {}),
        ...(keyframes ? { keyframes } : {}),
        ...(privacyBlur ? { privacyBlur } : {}),
        inverted: mask?.inverted === true,
        feather: normalizeUnit(mask?.feather, DEFAULT_MASK.feather),
        enabled: mask?.enabled !== false,
    };
}
export function normalizeMasks(masks) {
    return Array.isArray(masks) ? masks.map((mask) => normalizeMask(mask)) : [];
}
export function normalizeMaskKeyframes(keyframes) {
    if (!Array.isArray(keyframes)) {
        return undefined;
    }
    const normalized = keyframes.flatMap((keyframe) => {
        if (!Number.isFinite(keyframe.time)) {
            return [];
        }
        const w = normalizePositiveUnit(keyframe.w, DEFAULT_MASK.w);
        const h = normalizePositiveUnit(keyframe.h, DEFAULT_MASK.h);
        return [
            {
                time: round(Math.max(0, keyframe.time)),
                x: round(Math.min(1 - w, Math.max(0, finiteOrDefault(keyframe.x, DEFAULT_MASK.x)))),
                y: round(Math.min(1 - h, Math.max(0, finiteOrDefault(keyframe.y, DEFAULT_MASK.y)))),
                w,
                h,
            },
        ];
    });
    normalized.sort((left, right) => left.time - right.time || left.x - right.x || left.y - right.y);
    return normalized.length > 0 ? normalized : undefined;
}
// ---------------------------------------------------------------------------
// Privacy blur
// ---------------------------------------------------------------------------
export function normalizePrivacyBlur(privacyBlur) {
    if (privacyBlur?.enabled !== true) {
        return undefined;
    }
    return {
        enabled: true,
        effect: normalizePrivacyBlurEffect(privacyBlur.effect),
        color: typeof privacyBlur.color === 'string' && privacyBlur.color.trim()
            ? privacyBlur.color.trim()
            : DEFAULT_PRIVACY_BLUR.color,
    };
}
export function normalizePrivacyBlurEffect(effect) {
    return effect === 'gblur' || effect === 'solid' || effect === 'pixelize' ? effect : DEFAULT_PRIVACY_BLUR.effect;
}
// ---------------------------------------------------------------------------
// Border
// ---------------------------------------------------------------------------
export function normalizeClipBorder(border) {
    return {
        enabled: border?.enabled === true,
        color: normalizeHexColor(border?.color, DEFAULT_CLIP_BORDER.color),
        width: Math.round(Math.min(80, Math.max(1, finiteOrDefault(border?.width, DEFAULT_CLIP_BORDER.width)))),
    };
}
// ---------------------------------------------------------------------------
// Text path
// ---------------------------------------------------------------------------
export function normalizeTextPath(pathText) {
    const path = normalizePathPoints(pathText?.path);
    return {
        enabled: pathText?.enabled === true,
        path: path.length >= 2 ? path : DEFAULT_TEXT_PATH_POINTS.map((point) => clonePathPoint(point)),
        startOffset: normalizeUnit(pathText?.startOffset, DEFAULT_TEXT_PATH.startOffset),
        letterSpacing: round(Math.min(200, Math.max(0, finiteOrDefault(pathText?.letterSpacing, DEFAULT_TEXT_PATH.letterSpacing)))),
        rotateCharacters: pathText?.rotateCharacters !== false,
    };
}
// ---------------------------------------------------------------------------
// Multicam sequence
// ---------------------------------------------------------------------------
export function normalizeMulticamSequence(multicam, duration = Number.POSITIVE_INFINITY) {
    if (!multicam || !Array.isArray(multicam.angles) || multicam.angles.length < 2) {
        return undefined;
    }
    const angles = multicam.angles
        .map((angle, index) => ({
        id: typeof angle.id === 'string' && angle.id.trim() ? angle.id.trim() : `angle-${index + 1}`,
        clipId: typeof angle.clipId === 'string' ? angle.clipId : '',
        trackId: typeof angle.trackId === 'string' ? angle.trackId : '',
        name: typeof angle.name === 'string' && angle.name.trim() ? angle.name.trim() : `Camera ${index + 1}`,
        offset: round(finiteOrDefault(angle.offset, 0)),
    }))
        .filter((angle) => angle.clipId && angle.trackId)
        .slice(0, 8);
    if (angles.length < 2) {
        return undefined;
    }
    const angleIds = new Set(angles.map((angle) => angle.id));
    const maxTime = Number.isFinite(duration) ? Math.max(0, duration) : Number.POSITIVE_INFINITY;
    const switches = (Array.isArray(multicam.switches) ? multicam.switches : [])
        .map((item, index) => ({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createId('multicam-switch'),
        time: round(Math.min(maxTime, Math.max(0, finiteOrDefault(item.time, index === 0 ? 0 : maxTime)))),
        angleId: typeof item.angleId === 'string' && angleIds.has(item.angleId) ? item.angleId : angles[0].id,
    }))
        .filter((item) => item.time <= maxTime)
        .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
    const byTime = new Map();
    for (const item of switches) {
        byTime.set(item.time, item);
    }
    if (!byTime.has(0)) {
        byTime.set(0, { id: createId('multicam-switch'), time: 0, angleId: angles[0].id });
    }
    return {
        angles,
        switches: Array.from(byTime.values()).sort((left, right) => left.time - right.time || left.id.localeCompare(right.id)),
        aiCutSuggestions: normalizeAiCutSuggestions(multicam.aiCutSuggestions, angleIds),
    };
}
function normalizeAiCutSuggestions(suggestions, validAngleIds) {
    if (!Array.isArray(suggestions) || suggestions.length === 0)
        return undefined;
    const normalized = suggestions
        .filter((s) => s != null &&
        typeof s === 'object' &&
        typeof s.time === 'number' &&
        typeof s.angleId === 'string')
        .map((s) => ({
        time: round(Math.max(0, s.time)),
        angleId: (s.angleId || '').trim(),
        confidence: typeof s.confidence === 'number' &&
            Number.isFinite(s.confidence)
            ? round(Math.min(1, Math.max(0, s.confidence)))
            : 0.5,
        reason: typeof s.reason === 'string'
            ? (s.reason || '').trim().slice(0, 200)
            : '',
    }))
        .filter((s) => s.angleId.length > 0 && validAngleIds.has(s.angleId))
        .sort((a, b) => a.time - b.time);
    return normalized.length > 0 ? normalized : undefined;
}
// ---------------------------------------------------------------------------
// Sequence frame rate
// ---------------------------------------------------------------------------
export function normalizeSequenceFrameRate(frameRate) {
    if (typeof frameRate !== 'number' || !Number.isFinite(frameRate)) {
        return undefined;
    }
    return round(Math.min(120, Math.max(1, frameRate)));
}
// ---------------------------------------------------------------------------
// Privacy redactions / AI look match / AI PIP suggestion / flash warnings
// ---------------------------------------------------------------------------
export function normalizePrivacyRedactions(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .filter((r) => r != null && typeof r === 'object')
        .filter((r) => typeof r.id === 'string' && (r.type === 'face' || r.type === 'license_plate' || r.type === 'screen'))
        .map((r) => ({
        id: r.id,
        type: r.type,
        keyframes: Array.isArray(r.keyframes)
            ? r.keyframes
                .filter((k) => k != null && typeof k === 'object' && typeof k.time === 'number')
                .map((k) => ({
                time: round(Math.max(0, k.time)),
                x: round(Math.min(1, Math.max(0, typeof k.x === 'number' ? k.x : 0))),
                y: round(Math.min(1, Math.max(0, typeof k.y === 'number' ? k.y : 0))),
                w: round(Math.min(1, Math.max(0.001, typeof k.w === 'number' ? k.w : 0.1))),
                h: round(Math.min(1, Math.max(0.001, typeof k.h === 'number' ? k.h : 0.1))),
            }))
                .sort((a, b) => a.time - b.time)
            : [],
        blurStrength: typeof r.blurStrength === 'number' && Number.isFinite(r.blurStrength)
            ? Math.min(1, Math.max(0, r.blurStrength))
            : 1,
        enabled: r.enabled !== false,
    }));
}
export function normalizeAILookMatch(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    if (typeof obj.sourceImageHash !== 'string' || !obj.sourceImageHash)
        return undefined;
    if (!obj.wheelAdjustments || typeof obj.wheelAdjustments !== 'object')
        return undefined;
    const wa = obj.wheelAdjustments;
    const parseRgb = (v) => {
        if (!v || typeof v !== 'object')
            return { r: 0, g: 0, b: 0 };
        const o = v;
        return {
            r: typeof o.r === 'number' ? o.r : 0,
            g: typeof o.g === 'number' ? o.g : 0,
            b: typeof o.b === 'number' ? o.b : 0,
        };
    };
    const clampWheel = (v) => ({
        r: round(Math.min(1, Math.max(-1, v.r))),
        g: round(Math.min(1, Math.max(-1, v.g))),
        b: round(Math.min(1, Math.max(-1, v.b))),
    });
    return {
        sourceImageHash: obj.sourceImageHash,
        wheelAdjustments: {
            lift: clampWheel(parseRgb(wa.lift)),
            gamma: clampWheel(parseRgb(wa.gamma)),
            gain: clampWheel(parseRgb(wa.gain)),
        },
        curveControlPoints: typeof obj.curveControlPoints === 'object' && obj.curveControlPoints
            ? obj.curveControlPoints
            : {
                master: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                r: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                g: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                b: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
            },
        confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
            ? Math.min(1, Math.max(0, obj.confidence))
            : 0,
        generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
        blendStrength: typeof obj.blendStrength === 'number' && Number.isFinite(obj.blendStrength)
            ? Math.min(100, Math.max(0, obj.blendStrength))
            : 100,
    };
}
export function normalizeAiPipSuggestion(input) {
    if (!input || typeof input !== 'object')
        return undefined;
    const obj = input;
    const validCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const corner = validCorners.includes(obj.recommendedCorner)
        ? obj.recommendedCorner
        : 'bottom-right';
    return {
        recommendedCorner: corner,
        overlapReduction: typeof obj.overlapReduction === 'number' && Number.isFinite(obj.overlapReduction)
            ? round(Math.min(100, Math.max(0, obj.overlapReduction)))
            : 0,
        confidence: typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
            ? round(Math.min(1, Math.max(0, obj.confidence)))
            : 0.5,
    };
}
export function normalizeFlashWarnings(input) {
    if (!Array.isArray(input))
        return [];
    return input.filter((w) => w != null &&
        typeof w === 'object' &&
        typeof w.startTime === 'number' &&
        typeof w.endTime === 'number' &&
        typeof w.flashRate === 'number' &&
        typeof w.severity === 'string' &&
        typeof w.isRedFlash === 'boolean');
}
// ---------------------------------------------------------------------------
// Keyframes clone
// ---------------------------------------------------------------------------
export function cloneClipKeyframesLocal(keyframes) {
    if (!keyframes) {
        return undefined;
    }
    const output = {};
    for (const property of Object.keys(keyframes)) {
        const frames = keyframes[property];
        if (frames?.length) {
            output[property] = frames.map((frame) => ({
                ...frame,
                ...(frame.inHandle ? { inHandle: { ...frame.inHandle } } : {}),
                ...(frame.outHandle ? { outHandle: { ...frame.outHandle } } : {}),
            }));
        }
    }
    return Object.keys(output).length > 0 ? output : undefined;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function normalizeRgbColor(color) {
    const input = Array.isArray(color) ? color : DEFAULT_CHROMA_KEY.color;
    return [normalizeRgbChannel(input[0]), normalizeRgbChannel(input[1]), normalizeRgbChannel(input[2])];
}
function normalizeChromaKeyColors(chromaKey) {
    const candidates = Array.isArray(chromaKey?.colors) && chromaKey.colors.length > 0
        ? chromaKey.colors
        : [chromaKey?.color ?? DEFAULT_CHROMA_KEY.color];
    const colors = candidates.slice(0, MAX_CHROMA_KEY_COLORS).map((color) => normalizeRgbColor(color));
    return colors.length > 0 ? colors : [[...DEFAULT_CHROMA_KEY.color]];
}
function normalizeChromaKeyMode(mode) {
    return mode === 'luma-key' || mode === 'difference-matte' || mode === 'chroma-key' ? mode : DEFAULT_CHROMA_KEY.mode;
}
function normalizeRgbChannel(value) {
    return Math.round(Math.min(255, Math.max(0, finiteOrDefault(value, 0))));
}
function clonePathPoint(point) {
    return {
        x: point.x,
        y: point.y,
        handleIn: point.handleIn ? { ...point.handleIn } : undefined,
        handleOut: point.handleOut ? { ...point.handleOut } : undefined,
    };
}
function normalizeUnit(value, fallback) {
    return round(Math.min(1, Math.max(0, finiteOrDefault(value, fallback))));
}
function normalizePositiveUnit(value, fallback) {
    return round(Math.min(1, Math.max(0.001, finiteOrDefault(value, fallback))));
}
export function normalizeHexColor(color, fallback) {
    const trimmed = color?.trim();
    if (!trimmed)
        return fallback;
    const six = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (six)
        return `#${six[1].toLowerCase()}`;
    const three = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
    if (three) {
        const [r, g, b] = three[1].toLowerCase();
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
}
function normalizeLutPath(path) {
    const trimmed = path?.trim();
    return trimmed ? trimmed : null;
}
//# sourceMappingURL=clip-normalize.js.map
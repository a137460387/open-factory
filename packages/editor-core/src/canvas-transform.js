import { getTransformScaleX, getTransformScaleY, normalizeTransform } from './model';
import { round } from './time';
const MIN_TRANSFORM_SIZE = 4;
const ROTATION_HANDLE_OFFSET = 42;
export function screenPointToCanvasPoint(point, viewport) {
    return {
        x: round(((point.x - viewport.left) / Math.max(1, viewport.width)) * viewport.canvasWidth),
        y: round(((point.y - viewport.top) / Math.max(1, viewport.height)) * viewport.canvasHeight),
    };
}
export function canvasPointToNormalizedPoint(point, canvas) {
    return {
        x: round((point.x - canvas.width / 2) / Math.max(1, canvas.width / 2)),
        y: round((point.y - canvas.height / 2) / Math.max(1, canvas.height / 2)),
    };
}
export function normalizedPointToCanvasPoint(point, canvas) {
    return {
        x: round(canvas.width / 2 + point.x * (canvas.width / 2)),
        y: round(canvas.height / 2 + point.y * (canvas.height / 2)),
    };
}
export function screenDeltaToCanvasDelta(delta, viewport) {
    return {
        x: round((delta.x / Math.max(1, viewport.width)) * viewport.canvasWidth),
        y: round((delta.y / Math.max(1, viewport.height)) * viewport.canvasHeight),
    };
}
export function moveTransformByCanvasDelta(transform, delta) {
    const normalized = normalizeTransform(transform);
    return normalizeTransform({
        ...normalized,
        x: normalized.x + delta.x,
        y: normalized.y + delta.y,
    });
}
export function buildClipTransformBox(input) {
    const transform = normalizeTransform(input.transform);
    const sourceWidth = Math.max(1, input.sourceWidth);
    const sourceHeight = Math.max(1, input.sourceHeight);
    const width = Math.max(1, sourceWidth * getTransformScaleX(transform));
    const height = Math.max(1, sourceHeight * getTransformScaleY(transform));
    const center = {
        x: round(input.canvasWidth / 2 + transform.x),
        y: round(input.canvasHeight / 2 + transform.y),
    };
    const rotation = transform.rotation;
    const localCorners = {
        nw: { x: -width / 2, y: -height / 2 },
        ne: { x: width / 2, y: -height / 2 },
        se: { x: width / 2, y: height / 2 },
        sw: { x: -width / 2, y: height / 2 },
    };
    const corners = {
        nw: localToCanvas(localCorners.nw, center, rotation),
        ne: localToCanvas(localCorners.ne, center, rotation),
        se: localToCanvas(localCorners.se, center, rotation),
        sw: localToCanvas(localCorners.sw, center, rotation),
    };
    const handles = {
        nw: corners.nw,
        n: localToCanvas({ x: 0, y: -height / 2 }, center, rotation),
        ne: corners.ne,
        e: localToCanvas({ x: width / 2, y: 0 }, center, rotation),
        se: corners.se,
        s: localToCanvas({ x: 0, y: height / 2 }, center, rotation),
        sw: corners.sw,
        w: localToCanvas({ x: -width / 2, y: 0 }, center, rotation),
    };
    return {
        center,
        width: round(width),
        height: round(height),
        rotation,
        corners,
        handles,
        rotationHandle: localToCanvas({ x: 0, y: -height / 2 - ROTATION_HANDLE_OFFSET }, center, rotation),
        anchor: center,
    };
}
export function hitTestClipTransformBox(point, box) {
    const local = canvasToLocal(point, box.center, box.rotation);
    return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2;
}
export function resizeClipTransform(input) {
    const transform = normalizeTransform(input.transform);
    const sourceWidth = Math.max(1, input.sourceWidth);
    const sourceHeight = Math.max(1, input.sourceHeight);
    const startWidth = Math.max(1, sourceWidth * getTransformScaleX(transform));
    const startHeight = Math.max(1, sourceHeight * getTransformScaleY(transform));
    const startCenter = {
        x: input.canvasWidth / 2 + transform.x,
        y: input.canvasHeight / 2 + transform.y,
    };
    const direction = handleDirection(input.handle);
    const currentLocal = canvasToLocal(input.currentPoint, startCenter, transform.rotation);
    let width = startWidth;
    let height = startHeight;
    if (input.fromCenter) {
        if (direction.x !== 0) {
            width = Math.max(MIN_TRANSFORM_SIZE, Math.abs(currentLocal.x) * 2);
        }
        if (direction.y !== 0) {
            height = Math.max(MIN_TRANSFORM_SIZE, Math.abs(currentLocal.y) * 2);
        }
    }
    else {
        if (direction.x !== 0) {
            const fixedX = (-direction.x * startWidth) / 2;
            width = Math.max(MIN_TRANSFORM_SIZE, (currentLocal.x - fixedX) * direction.x);
        }
        if (direction.y !== 0) {
            const fixedY = (-direction.y * startHeight) / 2;
            height = Math.max(MIN_TRANSFORM_SIZE, (currentLocal.y - fixedY) * direction.y);
        }
    }
    if (input.keepAspectRatio) {
        const primaryScale = direction.x !== 0 && direction.y === 0
            ? width / sourceWidth
            : direction.y !== 0 && direction.x === 0
                ? height / sourceHeight
                : Math.max(width / sourceWidth, height / sourceHeight);
        width = Math.max(MIN_TRANSFORM_SIZE, sourceWidth * primaryScale);
        height = Math.max(MIN_TRANSFORM_SIZE, sourceHeight * primaryScale);
    }
    const centerLocal = input.fromCenter
        ? { x: 0, y: 0 }
        : {
            x: direction.x === 0 ? 0 : (-direction.x * startWidth) / 2 + (direction.x * width) / 2,
            y: direction.y === 0 ? 0 : (-direction.y * startHeight) / 2 + (direction.y * height) / 2,
        };
    const nextCenter = localToCanvas(centerLocal, startCenter, transform.rotation);
    return normalizeTransform({
        ...transform,
        x: nextCenter.x - input.canvasWidth / 2,
        y: nextCenter.y - input.canvasHeight / 2,
        scale: (width / sourceWidth + height / sourceHeight) / 2,
        scaleX: width / sourceWidth,
        scaleY: height / sourceHeight,
    });
}
export function rotateClipTransform(input) {
    const transform = normalizeTransform(input.transform);
    const center = {
        x: input.canvasWidth / 2 + transform.x,
        y: input.canvasHeight / 2 + transform.y,
    };
    const angle = (Math.atan2(input.currentPoint.y - center.y, input.currentPoint.x - center.x) * 180) / Math.PI + 90;
    return normalizeTransform({
        ...transform,
        rotation: normalizeCanvasRotation(angle),
    });
}
export function normalizeCanvasRotation(rotation) {
    if (!Number.isFinite(rotation)) {
        return 0;
    }
    let value = rotation;
    while (value > 180) {
        value -= 360;
    }
    while (value < -180) {
        value += 360;
    }
    return round(value);
}
function handleDirection(handle) {
    return {
        x: handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0,
        y: handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0,
    };
}
function localToCanvas(point, center, rotation) {
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: round(center.x + point.x * cos - point.y * sin),
        y: round(center.y + point.x * sin + point.y * cos),
    };
}
function canvasToLocal(point, center, rotation) {
    const radians = (-rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const x = point.x - center.x;
    const y = point.y - center.y;
    return {
        x: round(x * cos - y * sin),
        y: round(x * sin + y * cos),
    };
}
//# sourceMappingURL=canvas-transform.js.map
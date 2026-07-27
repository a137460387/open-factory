const DEFAULT_VIDEO_DISTANCE = 8;
const DEFAULT_AUDIO_DISTANCE = 0.08;
export function calculatePerceptualHash(sample, hashSize = 8) {
    const size = Math.max(2, Math.min(16, Math.round(hashSize)));
    if (sample.width <= 0 || sample.height <= 0 || sample.data.length === 0) {
        return ''.padStart((size * size) / 4, '0');
    }
    const cells = [];
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            cells.push(sampleBlockAverage(sample, x / size, y / size, (x + 1) / size, (y + 1) / size));
        }
    }
    const average = cells.reduce((sum, value) => sum + value, 0) / cells.length;
    return bitsToHex(cells.map((value) => value >= average));
}
export function calculateFingerprintDistance(left, right) {
    if (!left || !right || left.kind !== right.kind) {
        return Number.POSITIVE_INFINITY;
    }
    if (left.kind === 'video' || left.kind === 'image') {
        const leftFrames = left.frameHashes?.length ? left.frameHashes : [left.hash];
        const rightFrames = right.frameHashes?.length ? right.frameHashes : [right.hash];
        const pairs = Math.min(leftFrames.length, rightFrames.length);
        if (pairs === 0) {
            return Number.POSITIVE_INFINITY;
        }
        let distance = 0;
        for (let index = 0; index < pairs; index += 1) {
            distance += hammingHexDistance(leftFrames[index], rightFrames[index]);
        }
        return distance / pairs;
    }
    if (left.rmsVector?.length && right.rmsVector?.length) {
        return rmsVectorDistance(left.rmsVector, right.rmsVector);
    }
    return left.hash === right.hash ? 0 : Number.POSITIVE_INFINITY;
}
export function areMediaFingerprintsEquivalent(left, right) {
    const distance = calculateFingerprintDistance(left, right);
    if (!Number.isFinite(distance)) {
        return false;
    }
    return left?.kind === 'audio' ? distance <= DEFAULT_AUDIO_DISTANCE : distance <= DEFAULT_VIDEO_DISTANCE;
}
export function createVideoFingerprint(frameHashes) {
    const normalized = frameHashes.map(normalizeHash).filter(Boolean);
    const hash = normalized.join(':');
    return { version: 1, kind: 'video', hash, frameHashes: normalized, algorithm: 'phash' };
}
export function createAudioRmsFingerprint(rmsVector) {
    const vector = normalizeRmsVector(rmsVector);
    return {
        version: 1,
        kind: 'audio',
        hash: vector
            .map((value) => Math.round(value * 255)
            .toString(16)
            .padStart(2, '0'))
            .join(''),
        rmsVector: vector,
        algorithm: 'rms',
    };
}
export function collectFingerprintReferences(media, mediaMetadata, source = 'project') {
    return media
        .map((asset) => ({
        assetId: asset.id,
        name: asset.name,
        path: asset.path,
        fingerprint: mediaMetadata[asset.id]?.fingerprint,
        source,
    }))
        .filter((reference) => Boolean(reference.fingerprint));
}
export function detectCrossProjectFingerprintMatches(current, shared) {
    return current
        .map((asset) => ({
        assetId: asset.assetId,
        path: asset.path,
        matches: shared.filter((candidate) => candidate.path !== asset.path && areMediaFingerprintsEquivalent(asset.fingerprint, candidate.fingerprint)),
    }))
        .filter((match) => match.matches.length > 0);
}
export function listFingerprintSourcePaths(target, references) {
    if (!target) {
        return [];
    }
    return Array.from(new Set(references
        .filter((reference) => areMediaFingerprintsEquivalent(target, reference.fingerprint))
        .map((reference) => reference.path))).sort((left, right) => left.localeCompare(right));
}
export function findProjectFingerprintSourcePaths(project, assetId, sharedReferences = []) {
    const fingerprint = project.mediaMetadata[assetId]?.fingerprint;
    return listFingerprintSourcePaths(fingerprint, [
        ...collectFingerprintReferences(project.media, project.mediaMetadata),
        ...sharedReferences,
    ]);
}
function sampleBlockAverage(sample, x0Ratio, y0Ratio, x1Ratio, y1Ratio) {
    const x0 = Math.floor(x0Ratio * sample.width);
    const y0 = Math.floor(y0Ratio * sample.height);
    const x1 = Math.max(x0 + 1, Math.ceil(x1Ratio * sample.width));
    const y1 = Math.max(y0 + 1, Math.ceil(y1Ratio * sample.height));
    let total = 0;
    let count = 0;
    for (let y = y0; y < Math.min(sample.height, y1); y += 1) {
        for (let x = x0; x < Math.min(sample.width, x1); x += 1) {
            const value = Number(sample.data[y * sample.width + x]);
            if (Number.isFinite(value)) {
                total += Math.max(0, Math.min(255, value));
                count += 1;
            }
        }
    }
    return count > 0 ? total / count : 0;
}
function bitsToHex(bits) {
    let output = '';
    for (let index = 0; index < bits.length; index += 4) {
        const nibble = bits
            .slice(index, index + 4)
            .reduce((value, bit, bitIndex) => value + (bit ? 1 << (3 - bitIndex) : 0), 0);
        output += nibble.toString(16);
    }
    return output;
}
function hammingHexDistance(left, right) {
    const length = Math.max(left.length, right.length);
    let distance = 0;
    for (let index = 0; index < length; index += 1) {
        const leftValue = Number.parseInt(left[index] ?? '0', 16);
        const rightValue = Number.parseInt(right[index] ?? '0', 16);
        distance += countBits((Number.isFinite(leftValue) ? leftValue : 0) ^ (Number.isFinite(rightValue) ? rightValue : 0));
    }
    return distance;
}
function countBits(value) {
    let count = 0;
    let remaining = value;
    while (remaining > 0) {
        count += remaining & 1;
        remaining >>= 1;
    }
    return count;
}
function normalizeHash(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^0-9a-f:]/g, '');
}
function normalizeRmsVector(values) {
    const normalized = values.filter((value) => Number.isFinite(value)).map((value) => Math.max(0, value));
    const max = Math.max(1, ...normalized);
    return normalized.map((value) => Math.round((value / max) * 1000) / 1000);
}
function rmsVectorDistance(left, right) {
    const count = Math.min(left.length, right.length);
    if (count === 0) {
        return Number.POSITIVE_INFINITY;
    }
    let total = 0;
    for (let index = 0; index < count; index += 1) {
        total += Math.abs(left[index] - right[index]);
    }
    return total / count;
}
//# sourceMappingURL=media-fingerprint.js.map
import { normalizePath } from './relative-paths';
export function scoreRelinkCandidate(asset, candidate) {
    const reasons = [];
    let score = 0;
    const assetName = asset.name.toLowerCase();
    const candidateName = (candidate.name ?? fileName(candidate.path)).toLowerCase();
    if (assetName === candidateName) {
        score += 0.45;
        reasons.push('name');
    }
    else if (stripExtension(assetName) === stripExtension(candidateName)) {
        score += 0.25;
        reasons.push('basename');
    }
    if (extension(assetName) === extension(candidateName)) {
        score += 0.15;
        reasons.push('extension');
    }
    if (asset.size && candidate.size) {
        const distance = Math.abs(asset.size - candidate.size);
        if (distance === 0) {
            score += 0.25;
            reasons.push('size');
        }
        else if (distance / asset.size < 0.02) {
            score += 0.12;
            reasons.push('near-size');
        }
    }
    if (asset.duration > 0 && candidate.duration) {
        const distance = Math.abs(asset.duration - candidate.duration);
        if (distance < 0.05) {
            score += 0.1;
            reasons.push('duration');
        }
        else if (distance / asset.duration < 0.03) {
            score += 0.05;
            reasons.push('near-duration');
        }
    }
    if (asset.width > 0 && asset.height > 0 && candidate.width === asset.width && candidate.height === asset.height) {
        score += 0.05;
        reasons.push('dimensions');
    }
    return { score: Math.min(1, Number(score.toFixed(3))), reasons };
}
export function sortRelinkCandidates(asset, candidates) {
    return candidates
        .map((candidate) => ({ ...candidate, ...scoreRelinkCandidate(asset, candidate) }))
        .sort((left, right) => right.score - left.score);
}
function fileName(path) {
    return normalizePath(path).split('/').pop() ?? path;
}
function extension(path) {
    const index = path.lastIndexOf('.');
    return index === -1 ? '' : path.slice(index + 1).toLowerCase();
}
function stripExtension(path) {
    const index = path.lastIndexOf('.');
    return index === -1 ? path : path.slice(0, index);
}
//# sourceMappingURL=relink-score.js.map
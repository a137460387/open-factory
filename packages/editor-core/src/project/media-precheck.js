export function buildMediaPrecheckResult(input) {
    const issues = [];
    if (input.ffprobeError?.trim()) {
        issues.push({
            type: 'ffprobe-error',
            severity: 'error',
            details: input.ffprobeError.trim(),
            ffprobeError: parseFfprobePrecheckError(input.ffprobeError),
        });
    }
    else if (input.analysis) {
        const codecIssue = detectCodecPrecheckIssue(input.analysis);
        if (codecIssue) {
            issues.push(codecIssue);
        }
        const syncIssue = detectAudioVideoSyncIssue(input.analysis);
        if (syncIssue) {
            issues.push(syncIssue);
        }
        const colorIssue = detectColorSpacePrecheckIssue(input.analysis, input.projectColorSpace ?? 'sdr');
        if (colorIssue) {
            issues.push(colorIssue);
        }
    }
    if (input.integrityErrorOutput?.trim()) {
        issues.push({
            type: 'integrity',
            severity: 'error',
            details: input.integrityErrorOutput.trim(),
        });
    }
    if (input.fileSniff?.status === 'mismatch') {
        issues.push({
            type: 'file-header-mismatch',
            severity: 'warning',
            details: `${input.fileSniff.extension} -> ${input.fileSniff.detectedLabel ?? 'unknown'}`,
        });
    }
    if (input.forcedImport) {
        return {
            assetId: input.asset.id,
            name: input.asset.name,
            path: input.asset.path,
            type: input.asset.type,
            status: 'warning',
            issues: [...issues, { type: 'file-header-mismatch', severity: 'warning', details: 'force-imported' }],
        };
    }
    return {
        assetId: input.asset.id,
        name: input.asset.name,
        path: input.asset.path,
        type: input.asset.type,
        status: summarizeMediaPrecheckStatus(issues),
        issues,
    };
}
export function detectAudioVideoSyncIssue(analysis, thresholdSeconds = 0.5) {
    const videoDuration = firstFiniteDuration(analysis.videoStreams[0]?.duration, analysis.format?.duration);
    const audioDuration = firstFiniteDuration(analysis.audioStreams[0]?.duration, analysis.format?.duration);
    if (videoDuration === undefined ||
        audioDuration === undefined ||
        analysis.videoStreams.length === 0 ||
        analysis.audioStreams.length === 0) {
        return undefined;
    }
    const deltaSeconds = Math.abs(videoDuration - audioDuration);
    if (deltaSeconds <= thresholdSeconds) {
        return undefined;
    }
    return {
        type: 'av-sync',
        severity: 'warning',
        videoDuration,
        audioDuration,
        deltaSeconds,
    };
}
export function detectColorSpacePrecheckIssue(analysis, projectColorSpace = 'sdr') {
    if (projectColorSpace === 'hdr') {
        return undefined;
    }
    const hdrStream = analysis.videoStreams.find(isHdrVideoStream);
    return hdrStream
        ? {
            type: 'hdr-sdr',
            severity: 'warning',
            details: [hdrStream.colorPrimaries, hdrStream.colorTransfer, hdrStream.colorSpace].filter(Boolean).join(' / '),
        }
        : undefined;
}
export function parseFfprobePrecheckError(error) {
    const details = error.trim();
    const normalized = details.toLowerCase();
    if (normalized.includes('unknown decoder') ||
        normalized.includes('unsupported codec') ||
        normalized.includes('decoder not found')) {
        return { category: 'unsupported-codec', details };
    }
    if (normalized.includes('invalid data') ||
        normalized.includes('moov atom not found') ||
        normalized.includes('could not find codec parameters')) {
        return { category: 'invalid-data', details };
    }
    if (normalized.includes('no such file') ||
        normalized.includes('cannot find the file') ||
        normalized.includes('not found')) {
        return { category: 'missing-file', details };
    }
    if (normalized.includes('permission denied') || normalized.includes('access is denied')) {
        return { category: 'permission', details };
    }
    return { category: 'unknown', details };
}
function detectCodecPrecheckIssue(analysis) {
    const missingVideoCodec = analysis.videoStreams.some((stream) => !stream.codecName?.trim());
    const missingAudioCodec = analysis.audioStreams.some((stream) => !stream.codecName?.trim());
    if (!missingVideoCodec && !missingAudioCodec) {
        return undefined;
    }
    return {
        type: 'codec',
        severity: 'warning',
        details: missingVideoCodec && missingAudioCodec ? 'video,audio' : missingVideoCodec ? 'video' : 'audio',
    };
}
function summarizeMediaPrecheckStatus(issues) {
    if (issues.some((issue) => issue.severity === 'error')) {
        return 'error';
    }
    if (issues.length > 0) {
        return 'warning';
    }
    return 'pass';
}
function firstFiniteDuration(...values) {
    return values.find((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}
function isHdrVideoStream(stream) {
    const values = [
        stream.colorTransfer,
        stream.colorPrimaries,
        stream.colorSpace,
        stream.pixelFormat,
        ...(stream.hdrMetadata ?? []),
    ].map((value) => value?.toLowerCase() ?? '');
    return values.some((value) => value.includes('smpte2084') ||
        value.includes('arib-std-b67') ||
        value.includes('bt2020') ||
        value.includes('hdr'));
}
//# sourceMappingURL=media-precheck.js.map
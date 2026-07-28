import { normalizeSubtitleStyleTemplateStyle } from './style-templates';
// ---------------------------------------------------------------------------
// Search & Replace
// ---------------------------------------------------------------------------
/**
 * 在Timeline中搜索字幕文本
 */
export function searchSubtitles(timeline, options) {
    const results = [];
    const { searchText, caseSensitive = false, wholeWord = false, useRegex = false, trackId } = options;
    if (!searchText.trim()) {
        return results;
    }
    const pattern = buildSearchPattern(searchText, { caseSensitive, wholeWord, useRegex });
    for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex++) {
        const track = timeline.tracks[trackIndex];
        // 如果指定了轨道ID，跳过不匹配的轨道
        if (trackId && track.id !== trackId) {
            continue;
        }
        // 只搜索字幕轨道
        if (!isSubtitleTrack(track)) {
            continue;
        }
        for (const clip of track.clips) {
            if (clip.type !== 'subtitle') {
                continue;
            }
            const text = clip.text || '';
            const searchTextForMatch = caseSensitive ? text : text.toLowerCase();
            const patternForMatch = caseSensitive ? pattern : pattern.toLowerCase();
            let match;
            const regex = new RegExp(patternForMatch, caseSensitive ? 'g' : 'gi');
            while ((match = regex.exec(searchTextForMatch)) !== null) {
                results.push({
                    clipId: clip.id,
                    trackIndex,
                    matchedText: text.substring(match.index, match.index + match[0].length),
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length,
                    fullText: text,
                });
                // 防止无限循环
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        }
    }
    return results;
}
/**
 * 批量替换字幕文本
 */
export function replaceSubtitles(timeline, options, clipIds) {
    const { searchText, replaceText, caseSensitive = false, wholeWord = false, useRegex = false, trackId } = options;
    if (!searchText.trim()) {
        return { timeline, replacedCount: 0 };
    }
    const pattern = buildSearchPattern(searchText, { caseSensitive, wholeWord, useRegex });
    let replacedCount = 0;
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            // 如果指定了轨道ID，跳过不匹配的轨道
            if (trackId && track.id !== trackId) {
                return track;
            }
            // 只处理字幕轨道
            if (!isSubtitleTrack(track)) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.type !== 'subtitle') {
                        return clip;
                    }
                    // 如果指定了clipIds，只处理指定的片段
                    if (clipIds && !clipIds.includes(clip.id)) {
                        return clip;
                    }
                    const text = clip.text || '';
                    const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
                    const newText = text.replace(regex, (match) => {
                        replacedCount++;
                        return replaceText;
                    });
                    if (newText === text) {
                        return clip;
                    }
                    return { ...clip, text: newText };
                }),
            };
        }),
    };
    return { timeline: newTimeline, replacedCount };
}
/**
 * 替换单个搜索结果
 */
export function replaceSingleResult(timeline, result, replaceText) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track, trackIndex) => {
            if (trackIndex !== result.trackIndex) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.id !== result.clipId || clip.type !== 'subtitle') {
                        return clip;
                    }
                    const text = clip.text || '';
                    const newText = text.substring(0, result.matchStart) + replaceText + text.substring(result.matchEnd);
                    return { ...clip, text: newText };
                }),
            };
        }),
    };
}
// ---------------------------------------------------------------------------
// Multi-Select Operations
// ---------------------------------------------------------------------------
/**
 * 获取选中的字幕片段
 */
export function getSelectedSubtitleClips(timeline, selectedIds) {
    const selectedClips = [];
    for (const track of timeline.tracks) {
        if (!isSubtitleTrack(track)) {
            continue;
        }
        for (const clip of track.clips) {
            if (clip.type === 'subtitle' && selectedIds.includes(clip.id)) {
                selectedClips.push(clip);
            }
        }
    }
    return {
        selectedIds,
        selectedClips,
        count: selectedClips.length,
    };
}
/**
 * 全选指定轨道的字幕片段
 */
export function selectAllSubtitlesInTrack(timeline, trackId) {
    const track = timeline.tracks.find((t) => t.id === trackId);
    if (!track || !isSubtitleTrack(track)) {
        return [];
    }
    return track.clips.filter((clip) => clip.type === 'subtitle').map((clip) => clip.id);
}
/**
 * 反选字幕片段
 */
export function invertSubtitleSelection(timeline, selectedIds, trackId) {
    const allIds = [];
    for (const track of timeline.tracks) {
        if (trackId && track.id !== trackId) {
            continue;
        }
        if (!isSubtitleTrack(track)) {
            continue;
        }
        for (const clip of track.clips) {
            if (clip.type === 'subtitle') {
                allIds.push(clip.id);
            }
        }
    }
    return allIds.filter((id) => !selectedIds.includes(id));
}
// ---------------------------------------------------------------------------
// Batch Style Operations
// ---------------------------------------------------------------------------
/**
 * 批量更新字幕样式
 */
export function batchUpdateSubtitleStyle(timeline, update) {
    const { clipIds, style } = update;
    const idSet = new Set(clipIds);
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.type !== 'subtitle' || !idSet.has(clip.id)) {
                        return clip;
                    }
                    return {
                        ...clip,
                        style: {
                            ...clip.style,
                            ...style,
                        },
                    };
                }),
            };
        }),
    };
}
/**
 * 批量应用样式模板到选中的字幕
 */
export function batchApplyStyleTemplate(timeline, clipIds, template) {
    const normalizedStyle = normalizeSubtitleStyleTemplateStyle(template.style);
    return batchUpdateSubtitleStyle(timeline, {
        clipIds,
        style: normalizedStyle,
    });
}
/**
 * 从选中的字幕中提取共同样式
 */
export function extractCommonStyle(clips) {
    if (clips.length === 0) {
        return null;
    }
    const firstStyle = clips[0].style;
    if (!firstStyle) {
        return null;
    }
    const commonStyle = {};
    const styleKeys = Object.keys(firstStyle);
    for (const key of styleKeys) {
        const values = clips.map((clip) => clip.style?.[key]).filter((v) => v !== undefined);
        if (values.length === clips.length && values.every((v) => v === values[0])) {
            commonStyle[key] = values[0];
        }
    }
    return Object.keys(commonStyle).length > 0 ? commonStyle : null;
}
// ---------------------------------------------------------------------------
// Edit Operations
// ---------------------------------------------------------------------------
/**
 * 删除选中的字幕片段
 */
export function deleteSelectedSubtitles(timeline, selectedIds) {
    const idSet = new Set(selectedIds);
    let affectedCount = 0;
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.filter((clip) => {
                    if (clip.type === 'subtitle' && idSet.has(clip.id)) {
                        affectedCount++;
                        return false;
                    }
                    return true;
                }),
            };
        }),
    };
    return {
        operation: 'delete',
        affectedCount,
        timeline: newTimeline,
    };
}
/**
 * 复制选中的字幕片段
 */
export function duplicateSelectedSubtitles(timeline, selectedIds, timeOffset = 0) {
    const idSet = new Set(selectedIds);
    let affectedCount = 0;
    const newClips = [];
    // 找到要复制的片段
    for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex++) {
        const track = timeline.tracks[trackIndex];
        if (!isSubtitleTrack(track)) {
            continue;
        }
        for (const clip of track.clips) {
            if (clip.type === 'subtitle' && idSet.has(clip.id)) {
                const newClip = {
                    ...clip,
                    id: `${clip.id}_copy_${Date.now()}_${affectedCount}`,
                    start: clip.start + timeOffset,
                };
                newClips.push({ trackIndex, clip: newClip });
                affectedCount++;
            }
        }
    }
    // 添加新片段到对应的轨道
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track, trackIndex) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            const clipsToAdd = newClips.filter((item) => item.trackIndex === trackIndex).map((item) => item.clip);
            if (clipsToAdd.length === 0) {
                return track;
            }
            return {
                ...track,
                clips: [...track.clips, ...clipsToAdd],
            };
        }),
    };
    return {
        operation: 'duplicate',
        affectedCount,
        timeline: newTimeline,
    };
}
/**
 * 合并选中的字幕片段
 */
export function mergeSelectedSubtitles(timeline, selectedIds, separator = ' ') {
    const idSet = new Set(selectedIds);
    let affectedCount = 0;
    // 按轨道分组收集要合并的片段
    const clipsByTrack = new Map();
    for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex++) {
        const track = timeline.tracks[trackIndex];
        if (!isSubtitleTrack(track)) {
            continue;
        }
        const trackClips = track.clips
            .filter((clip) => clip.type === 'subtitle' && idSet.has(clip.id))
            .sort((a, b) => a.start - b.start);
        if (trackClips.length > 0) {
            clipsByTrack.set(trackIndex, trackClips);
        }
    }
    // 执行合并
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track, trackIndex) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            const clipsToMerge = clipsByTrack.get(trackIndex);
            if (!clipsToMerge || clipsToMerge.length < 2) {
                return track;
            }
            // 创建合并后的片段
            const firstClip = clipsToMerge[0];
            const lastClip = clipsToMerge[clipsToMerge.length - 1];
            const mergedText = clipsToMerge.map((clip) => clip.text).join(separator);
            const mergedDuration = lastClip.start + lastClip.duration - firstClip.start;
            const mergedClip = {
                ...firstClip,
                id: `merged_${Date.now()}`,
                text: mergedText,
                duration: mergedDuration,
            };
            affectedCount = clipsToMerge.length;
            // 移除原片段，添加合并后的片段
            return {
                ...track,
                clips: [...track.clips.filter((clip) => !idSet.has(clip.id)), mergedClip],
            };
        }),
    };
    return {
        operation: 'merge',
        affectedCount,
        timeline: newTimeline,
    };
}
/**
 * 批量调整字幕时间
 */
export function batchShiftSubtitleTime(timeline, selectedIds, timeShift) {
    const idSet = new Set(selectedIds);
    let affectedCount = 0;
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.type !== 'subtitle' || !idSet.has(clip.id)) {
                        return clip;
                    }
                    affectedCount++;
                    const newStart = Math.max(0, clip.start + timeShift);
                    return {
                        ...clip,
                        start: newStart,
                    };
                }),
            };
        }),
    };
    return {
        operation: 'time-shift',
        affectedCount,
        timeline: newTimeline,
    };
}
/**
 * 批量缩放字幕时间
 */
export function batchScaleSubtitleTime(timeline, selectedIds, scaleFactor, pivotTime) {
    const idSet = new Set(selectedIds);
    let affectedCount = 0;
    // 如果没有指定枢轴时间，使用选中片段的平均起始时间
    if (pivotTime === undefined) {
        const selectedClips = getSelectedSubtitleClips(timeline, selectedIds);
        if (selectedClips.count > 0) {
            const totalStart = selectedClips.selectedClips.reduce((sum, clip) => sum + clip.start, 0);
            pivotTime = totalStart / selectedClips.count;
        }
        else {
            pivotTime = 0;
        }
    }
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) => {
            if (!isSubtitleTrack(track)) {
                return track;
            }
            return {
                ...track,
                clips: track.clips.map((clip) => {
                    if (clip.type !== 'subtitle' || !idSet.has(clip.id)) {
                        return clip;
                    }
                    affectedCount++;
                    const relativeStart = clip.start - pivotTime;
                    const newStart = pivotTime + relativeStart * scaleFactor;
                    const newDuration = clip.duration * scaleFactor;
                    return {
                        ...clip,
                        start: Math.max(0, newStart),
                        duration: Math.max(0.1, newDuration),
                    };
                }),
            };
        }),
    };
    return {
        operation: 'time-scale',
        affectedCount,
        timeline: newTimeline,
    };
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildSearchPattern(searchText, options) {
    let pattern = options.useRegex ? searchText : escapeRegExp(searchText);
    if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
    }
    return pattern;
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function isSubtitleTrack(track) {
    return track.type === 'subtitle';
}
//# sourceMappingURL=editor.js.map
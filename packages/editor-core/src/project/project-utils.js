export function projectUsesMediaOnTimeline(project, assetId) {
    return project.timeline.tracks.some((track) => track.clips.some((clip) => 'mediaId' in clip && clip.mediaId === assetId));
}
//# sourceMappingURL=project-utils.js.map
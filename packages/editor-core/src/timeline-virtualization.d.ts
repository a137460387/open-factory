export interface TimelineVirtualRenderWindowInput {
    scrollLeft: number;
    viewportWidth: number;
    zoom: number;
    labelWidth?: number;
    overscanScreens?: number;
}
export interface TimelineVirtualRenderWindow {
    start: number;
    end: number;
}
export interface TimelineVirtualTrackWindowInput {
    scrollTop: number;
    viewportHeight: number;
    rowHeight: number;
    trackCount: number;
    overscanRows?: number;
}
export interface TimelineVirtualTrackWindow {
    startIndex: number;
    endIndex: number;
    beforeHeight: number;
    afterHeight: number;
    totalHeight: number;
    renderedCount: number;
}
export interface TimelineLazyAssetInput {
    clipStart: number;
    clipDuration: number;
    zoom: number;
    scrollLeft: number;
    viewportWidth: number;
    labelWidth?: number;
    preloadPx?: number;
}
export interface TimelineLargeProjectModeInput {
    clipCount: number;
    threshold?: number;
    extremeThreshold?: number;
}
export interface TimelineLargeProjectMode {
    enabled: boolean;
    disableAnimations: boolean;
    virtualOverscanScreens: number;
    waveformResolutionScale: number;
    previewFrameStep: number;
    minimapClipLimit: number | undefined;
    /** 是否为极端大项目（1000+ 片段） */
    extremeMode: boolean;
    /** 缩略图加载延迟（ms） */
    thumbnailLoadDelayMs: number;
    /** 波形采样密度（0-1，越小越稀疏） */
    waveformSampleDensity: number;
}
export interface TimelineIncrementalRenderPlan {
    changedClipIds: string[];
}
export declare function getTimelineVirtualRenderWindow(input: TimelineVirtualRenderWindowInput): TimelineVirtualRenderWindow;
export declare function filterTimelineVirtualClips<TClip extends {
    start: number;
    duration: number;
}>(clips: TClip[], window: TimelineVirtualRenderWindow): TClip[];
/**
 * 高性能滚动视口更新节流器
 * 使用 requestAnimationFrame 批处理滚动事件，避免每帧多次计算
 */
export declare class ScrollViewportThrottler {
    private pending;
    private latestScrollLeft;
    private latestScrollTop;
    private callback?;
    constructor(callback: (scrollLeft: number, scrollTop: number) => void);
    update(scrollLeft: number, scrollTop: number): void;
    private flush;
    dispose(): void;
}
export declare function getTimelineVirtualTrackWindow(input: TimelineVirtualTrackWindowInput): TimelineVirtualTrackWindow;
export declare function filterTimelineVirtualTracks<TTrack>(tracks: TTrack[], window: TimelineVirtualTrackWindow): TTrack[];
export declare function shouldLoadTimelineClipAssets(input: TimelineLazyAssetInput): boolean;
export declare function getTimelineLargeProjectMode(input: TimelineLargeProjectModeInput): TimelineLargeProjectMode;
export declare function getTimelineIncrementalRenderPlan<TClip extends {
    id: string;
}>(previousClips: TClip[], nextClips: TClip[]): TimelineIncrementalRenderPlan;
//# sourceMappingURL=timeline-virtualization.d.ts.map
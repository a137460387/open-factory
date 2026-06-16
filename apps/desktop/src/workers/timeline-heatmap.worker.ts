import { calculateTimelineHeatmap, type Timeline, type TimelineHeatmapSegment, type TimelineHeatmapType } from '@open-factory/editor-core';

interface HeatmapWorkerRequest {
  id: number;
  type: TimelineHeatmapType;
  timeline: Timeline;
  duration: number;
  bucketSeconds: number;
}

interface HeatmapWorkerResponse {
  id: number;
  segments: TimelineHeatmapSegment[];
}

self.onmessage = (event: MessageEvent<HeatmapWorkerRequest>) => {
  const request = event.data;
  const response: HeatmapWorkerResponse = {
    id: request.id,
    segments: calculateTimelineHeatmap(request.type, request.timeline, {
      duration: request.duration,
      bucketSeconds: request.bucketSeconds
    })
  };
  self.postMessage(response);
};

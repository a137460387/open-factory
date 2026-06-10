import { useEffect } from 'react';
import type { MediaAsset } from '@open-factory/editor-core';
import { enqueueBackgroundMediaJobs } from './media-job-runner';

export function useBackgroundMediaJobs(media: MediaAsset[]): void {
  useEffect(() => {
    enqueueBackgroundMediaJobs(media);
  }, [media]);
}

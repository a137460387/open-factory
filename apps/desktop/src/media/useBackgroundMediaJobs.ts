import { useEffect } from 'react';
import type { MediaAsset } from '@open-factory/editor-core';
import { useProxySettingsStore } from '../store/proxySettingsStore';
import { enqueueBackgroundMediaJobs } from './media-job-runner';

export function useBackgroundMediaJobs(media: MediaAsset[]): void {
  const proxySettings = useProxySettingsStore((state) => state.settings);
  useEffect(() => {
    enqueueBackgroundMediaJobs(media, proxySettings);
  }, [media, proxySettings]);
}

import type { MediaAsset } from '../model';

export interface ProxySettings {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: string;
  triggerShortEdge: number;
}

export interface ProxyPlan {
  assetId: string;
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  videoBitrate: string;
  reason: 'large-resolution' | 'editing-codec';
}

export type ProxyCapableAsset = MediaAsset & { type: 'video' };

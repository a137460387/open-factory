import type { MediaAsset } from '../model';

export interface ProxySettings {
  maxWidth: number;
  maxHeight: number;
  videoBitrate: string;
  minSourceBytes: number;
}

export interface ProxyPlan {
  assetId: string;
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  videoBitrate: string;
  reason: string;
}

export type ProxyCapableAsset = MediaAsset & { type: 'video' };

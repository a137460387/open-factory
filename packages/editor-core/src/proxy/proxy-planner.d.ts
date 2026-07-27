import type { MediaAsset } from '../model';
import type { ProxyPlan, ProxySettings } from './proxy-types';
export declare const DEFAULT_PROXY_SETTINGS: ProxySettings;
export declare function shouldGenerateProxy(asset: MediaAsset, settings?: ProxySettings): boolean;
export declare function buildProxyPlan(asset: MediaAsset, appDataDir: string, settings?: ProxySettings, options?: {
    force?: boolean;
    cfrFrameRate?: number;
    sourceStart?: number;
    sourceDuration?: number;
}): ProxyPlan | null;
export declare function getProxyTriggerReason(asset: MediaAsset, settings?: ProxySettings): ProxyPlan['reason'] | null;
export declare function isEditingCodec(codec: unknown): boolean;
export declare function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): {
    width: number;
    height: number;
};
//# sourceMappingURL=proxy-planner.d.ts.map
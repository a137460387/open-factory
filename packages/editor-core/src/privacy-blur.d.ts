import { type ClipMask, type PrivacyBlurEffect } from './model';
export interface DetectedPrivacyBox {
    time: number;
    x: number;
    y: number;
    w: number;
    h: number;
    label?: string;
    confidence?: number;
}
export interface BuildPrivacyMasksOptions {
    effect?: PrivacyBlurEffect;
    color?: string;
    idPrefix?: string;
}
export declare function buildPrivacyMasksFromDetections(detections: readonly DetectedPrivacyBox[], options?: BuildPrivacyMasksOptions): ClipMask[];
//# sourceMappingURL=privacy-blur.d.ts.map
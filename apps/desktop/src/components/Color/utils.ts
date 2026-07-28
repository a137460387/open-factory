/**
 * Color Grading Panel - Utility Functions
 */

import type {RGBColor} from '@open-factory/editor-core/color/aces';

/**
 * RGB to CSS color string
 */
export function rgbToCSS(rgb: RGBColor): string {
  return `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`;
}

/**
 * HSL to CSS color string
 */
export function hslToCSS(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
}

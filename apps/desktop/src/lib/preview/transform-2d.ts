import { DEFAULT_COLOR_CORRECTION, getTransformScaleX, getTransformScaleY, normalizeColorCorrection, type ColorCorrection, type Transform } from '@open-factory/editor-core';

export function drawTransformedSource2d(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  dimensions: { width: number; height: number },
  transform: Transform,
  colorCorrection?: Partial<ColorCorrection>
): void {
  const previousFilter = context.filter;
  const correction = normalizeColorCorrection(colorCorrection ?? DEFAULT_COLOR_CORRECTION);
  context.save();
  context.globalAlpha = transform.opacity;
  context.filter = buildCanvasFilter(correction);
  context.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(getTransformScaleX(transform), getTransformScaleY(transform));
  context.drawImage(source, -dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
  context.filter = previousFilter;
  context.restore();
}

function buildCanvasFilter(colorCorrection: ColorCorrection): string {
  const brightness = Math.max(0, 1 + colorCorrection.brightness);
  return [
    `brightness(${brightness})`,
    `contrast(${colorCorrection.contrast})`,
    `saturate(${colorCorrection.saturation})`,
    `hue-rotate(${colorCorrection.hue}deg)`
  ].join(' ');
}

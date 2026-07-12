# LUT & Secondary Color Grading Integration Report

## Date: 2026-07-12

## Summary

Integrated LUT and secondary color grading functionality into both the WebGL rendering pipeline and the FFmpeg export pipeline. All 222 tests pass (including 5 new tests).

## Files Modified

### 1. `packages/editor-core/src/export/ffmpeg-builder.ts`

**Import additions:**
- Added `toFfmpegSelectiveColor` from `../color-grading` (for HSL qualifier FFmpeg filter generation)
- Added type imports: `HSLQualifierParams`, `WindowMaskParams`

**`buildColorGradingFilters` function extension:**
- Added `hsl-qualifier` node support: generates FFmpeg `selectivecolor` filter via `toFfmpegSelectiveColor()`
- Added `window-mask` node support: generates FFmpeg `geq` filter for circle and linear-gradient mask shapes via `buildWindowMaskFfmpegFilter()`
- Added `lut-apply` node support: generates FFmpeg `lut3d` filter with placeholder `.cube` file path per node ID

**New helper function:**
- `buildWindowMaskFfmpegFilter(params: WindowMaskParams): string` - converts window mask parameters to FFmpeg geq filter expressions for circle and linear-gradient shapes

### 2. `apps/desktop/src/lib/color-grading/node-shader-compiler.ts`

**Import additions:**
- Added `generateHSLQualifierGLSL`, `generateCircleMaskGLSL`, `generateGradientMaskGLSL` from `@open-factory/editor-core`
- Added type import: `WindowMaskParams`

**`compileColorGradingShader` function extension:**
- `hsl-qualifier` nodes: generates uniform declarations for hue/sat/lum ranges and adjustments, emits `applyHSLQualifier()` GLSL call; includes `rgb2hsl()` helper function generation
- `lut-apply` nodes: generates `sampler3D` and `intensity` uniform declarations, emits `texture()` + `mix()` GLSL call for LUT sampling
- `window-mask` nodes: generates appropriate GLSL function definitions (circle mask or gradient mask) and uniform declarations based on mask shape

### 3. `packages/editor-core/__tests__/ffmpeg-builder.test.ts`

**Import additions:**
- Added `createDefaultHSLQualifierParams`, `createDefaultCircleMask`, `createDefaultGradientMask` from `../src`

**New test cases (5 tests):**
1. `should build selectivecolor filter for HSL qualifier` - verifies `selectivecolor` filter is generated when HSL qualifier has non-default adjustments
2. `should build lut3d filter for LUT apply` - verifies `lut3d` filter with correct node ID path
3. `should build geq filter for circle window mask` - verifies `geq` filter for circle mask shape
4. `should build geq filter for gradient window mask` - verifies `geq` filter for gradient mask shape
5. `should combine multiple node types in correct order` - verifies slider -> HSL -> LUT ordering in filter chain

## Test Results

```
Test Files  1 passed (1)
     Tests  222 passed (222)
  Duration  3.67s
```

All existing tests continue to pass. No regressions.

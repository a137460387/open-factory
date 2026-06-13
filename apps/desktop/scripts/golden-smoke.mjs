import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { captureCombined, defaultDrawtextFontPath, normalizePath, runChecked, runCollectStdout } from './smoke-platform.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const repoDir = resolve(desktopDir, '..', '..');
const coreBuilderModule = join(repoDir, 'packages', 'editor-core', 'dist', 'export', 'ffmpeg-builder.js');
const coreColorMatchModule = join(repoDir, 'packages', 'editor-core', 'dist', 'color-match.js');
const smokeDir = join(desktopDir, 'src-tauri', 'target', 'golden-smoke');
const reportPath = join(smokeDir, 'golden-smoke-report.json');
const readmePreviewPath = join(repoDir, 'docs', 'open-factory-golden-preview.png');

const COLORS = {
  green: { ffmpeg: '0x2fd17e', rgb: [47, 209, 126] },
  keyGreen: { ffmpeg: '0x00ff00', rgb: [0, 255, 0] },
  darkBlue: { ffmpeg: '0x243247', rgb: [36, 50, 71] },
  coral: { ffmpeg: '0xd9553f', rgb: [217, 85, 63] },
  blue: { ffmpeg: '0x2d6cdf', rgb: [45, 108, 223] },
  yellow: { ffmpeg: '0xf7d84a', rgb: [247, 216, 74] },
  violet: { ffmpeg: '0x8557d6', rgb: [133, 87, 214] },
  pink: { ffmpeg: '0xff4fd8', rgb: [255, 79, 216] },
  cyan: { ffmpeg: '0x00e5ff', rgb: [0, 229, 255] },
  gray: { ffmpeg: '0x808080', rgb: [128, 128, 128] },
  lightGray: { ffmpeg: '0xb0b0b0', rgb: [176, 176, 176] },
  black: { ffmpeg: '0x000000', rgb: [0, 0, 0] },
  white: { ffmpeg: '0xffffff', rgb: [255, 255, 255] }
};

const FFMPEG_CAPABILITIES = {
  available: true,
  version: 'golden-smoke',
  hasLibx264: true,
  hasAac: true,
  hasDrawtext: true,
  hasLibfreetype: true,
  drawtextWarning: null
};

if (!existsSync(coreBuilderModule)) {
  console.error(`editor-core build output was not found: ${coreBuilderModule}`);
  console.error('Run npm run build before npm run smoke:golden.');
  process.exit(1);
}

mkdirSync(smokeDir, { recursive: true });

const { buildExportProjectFromProject, buildFfmpegExportPlan } = await import(pathToFileURL(coreBuilderModule).href);
const { buildColorMatchCurves } = await import(pathToFileURL(coreColorMatchModule).href);

const fixtures = [
  {
    name: 'text-drawtext',
    description: 'solid background video with a centered drawtext=textfile title',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createTextDrawtextFixture,
    validate: validateTextDrawtextFixture
  },
  {
    name: 'text-animation',
    description: 'centered text clip faded in through opacity keyframes',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createTextAnimationFixture,
    validate: validateTextAnimationFixture
  },
  {
    name: 'path-text',
    description: 'text clip baked to a transparent path-text PNG sequence overlay',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createPathTextFixture,
    validate: validatePathTextFixture
  },
  {
    name: 'multi-clip-overlay',
    description: 'two sequential video clips with an image overlay over the second segment',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 2,
    create: createMultiClipOverlayFixture,
    validate: validateMultiClipOverlayFixture
  },
  {
    name: 'rotation-transform',
    description: 'centered image clip rotated through the FFmpeg rotate filter',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createRotationTransformFixture,
    validate: validateRotationTransformFixture
  },
  {
    name: 'audio-volume-fade',
    description: 'video with embedded audio using fade-in and 0.5x volume',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createAudioVolumeFadeFixture,
    validate: validateAudioVolumeFadeFixture
  },
  {
    name: 'audio-spectrum',
    description: 'video with embedded audio and a bottom audio spectrum overlay',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createAudioSpectrumFixture,
    validate: validateAudioSpectrumFixture
  },
  {
    name: 'audio-viz',
    description: 'audio-only source exported as a waveform visualization video with the original audio stream',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    exportSettings: {
      outputMode: 'audio-visualization',
      format: 'mp4',
      width: 1280,
      height: 720,
      fps: 30,
      audioVisualization: {
        style: 'waveform-line',
        color: '#22d3ee',
        background: { type: 'solid', color: '#050816' }
      }
    },
    create: createAudioVisualizationFixture,
    validate: validateAudioVisualizationFixture
  },
  {
    name: 'subtitle-burn-in',
    description: 'solid background video with two SRT subtitle clips burned in',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createSubtitleBurnInFixture,
    validate: validateSubtitleBurnInFixture
  },
  {
    name: 'color-correction',
    description: 'cyan video clip shifted with per-clip hue correction',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createColorCorrectionFixture,
    validate: validateColorCorrectionFixture
  },
  {
    name: 'panorama-360',
    description: 'equirectangular 360 video clip extracted to a flat viewport through v360',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createPanorama360Fixture,
    validate: validatePanorama360Fixture
  },
  {
    name: 'adjustment-layer',
    description: 'light gray video darkened by a non-media adjustment layer above it',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createAdjustmentLayerFixture,
    validate: validateAdjustmentLayerFixture
  },
  {
    name: 'chroma-key',
    description: 'green video clip keyed transparent over the black export base',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createChromaKeyFixture,
    validate: validateChromaKeyFixture
  },
  {
    name: 'color-curves',
    description: 'gray video clip darkened by a master RGB curve midpoint',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createColorCurvesFixture,
    validate: validateColorCurvesFixture
  },
  {
    name: 'color-match',
    description: 'blue target clip matched to a coral reference clip through generated RGB curves',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 3,
    create: createColorMatchFixture,
    validate: validateColorMatchFixture
  },
  {
    name: 'color-wheel',
    description: 'light gray video clip shifted red with three-way gain',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createColorWheelFixture,
    validate: validateColorWheelFixture
  },
  {
    name: 'speed-change',
    description: '1.5s video exported at 2x per-clip speed',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 0.75,
    create: createSpeedChangeFixture,
    validate: validateSpeedChangeFixture
  },
  {
    name: 'speed-ramp',
    description: '2s video exported through a 1x to 2x speed keyframe ramp',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.25,
    create: createSpeedRampFixture,
    validate: validateSpeedRampFixture
  },
  {
    name: 'custom-shader',
    description: 'test pattern video exported through a custom pixelate shader sequence',
    outputWidth: 320,
    outputHeight: 180,
    expectedDuration: 1.5,
    create: createCustomShaderFixture,
    validate: validateCustomShaderFixture
  },
  {
    name: 'mute-track',
    description: 'muted audio track is excluded from export and replaced by silent audio',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createMuteTrackFixture,
    validate: validateMuteTrackFixture
  },
  {
    name: 'ken-burns',
    description: 'patterned image clip with Ken Burns scale keyframes from 1x to 1.5x',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createKenBurnsFixture,
    validate: validateKenBurnsFixture
  },
  {
    name: 'proxy-preview-original-export',
    description: 'original-resolution export paired with the proxy preview smoke fixture color',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 1.5,
    create: createProxyOriginalExportFixture,
    validate: validateProxyOriginalExportFixture,
    updateReadmePreview: true
  },
  {
    name: 'scene-detect',
    description: 'hard-cut source detected with FFmpeg showinfo and split into two clips',
    outputWidth: 1280,
    outputHeight: 720,
    expectedDuration: 2,
    create: createSceneDetectFixture,
    validate: validateSceneDetectFixture
  },
  {
    name: 'gif-animation',
    description: 'two-pass GIF animation export with palettegen and paletteuse',
    outputWidth: 320,
    outputHeight: 180,
    expectedDuration: 1,
    outputExtension: 'gif',
    exportSettings: { format: 'gif', width: 320, height: 180, fps: 12 },
    create: createGifAnimationFixture,
    validate: validateGifAnimationFixture
  }
];

const fixtureResults = [];
for (const fixture of fixtures) {
  const result = await runGoldenFixture(fixture);
  fixtureResults.push(result);
  console.log(JSON.stringify({ fixture: result.name, success: result.success, checks: result.checks }, null, 2));
}

const success = fixtureResults.every((fixture) => fixture.success);
const report = {
  success,
  reportPath: normalizePath(reportPath),
  readmePreviewPath: normalizePath(readmePreviewPath),
  summary: {
    total: fixtureResults.length,
    passed: fixtureResults.filter((fixture) => fixture.success).length
  },
  fixtures: fixtureResults
};
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!success) {
  process.exit(1);
}

async function runGoldenFixture(fixture) {
  const fixtureDir = join(smokeDir, fixture.name);
  mkdirSync(fixtureDir, { recursive: true });
  rmSync(join(fixtureDir, 'text-artifacts'), { recursive: true, force: true });

  const outputPath = join(fixtureDir, `${fixture.name}.${fixture.outputExtension ?? 'mp4'}`);
  const context = {
    fixture,
    fixtureDir,
    outputPath,
    outputWidth: fixture.outputWidth,
    outputHeight: fixture.outputHeight
  };
  const project = await fixture.create(context);
  const exportProject = buildExportProjectFromProject(project, {
    outputPath: normalizePath(outputPath),
    defaultFontPath: defaultDrawtextFontPath(),
    settings: fixture.exportSettings
  });
  const plan = buildFfmpegExportPlan(exportProject, FFMPEG_CAPABILITIES);
  const materializedPlan = await materializeTextArtifacts(plan, join(fixtureDir, 'text-artifacts'));

  await runMaterializedPlan(materializedPlan);
  if (fixture.updateReadmePreview) {
    await extractPreviewPng(outputPath, readmePreviewPath, fixture.outputWidth, fixture.outputHeight);
  }

  const outputDuration = await readDuration(outputPath);
  const outputSize = statSync(outputPath).size;
  const centerPixel = await readPixel(outputPath, {
    at: Math.min(0.35, fixture.expectedDuration / 2),
    x: Math.floor(fixture.outputWidth / 2),
    y: Math.floor(fixture.outputHeight / 2)
  });
  const validation = await fixture.validate({
    ...context,
    project,
    plan,
    outputDuration,
    outputSize,
    centerPixel
  });
  const checks = [
    {
      name: 'duration',
      passed: Math.abs(outputDuration - fixture.expectedDuration) <= 0.2,
      actual: round(outputDuration),
      expected: fixture.expectedDuration
    },
    {
      name: 'output-size',
      passed: outputSize > 0,
      actual: outputSize,
      expected: '> 0'
    },
    ...validation.checks
  ];
  return {
    name: fixture.name,
    description: fixture.description,
    success: checks.every((check) => check.passed),
    outputPath: normalizePath(outputPath),
    outputSize,
    outputDuration: round(outputDuration),
    centerPixel,
    plan: {
      inputCount: plan.inputs.length,
      textArtifactCount: plan.textArtifacts.length,
      hasFilterComplex: plan.fullArgs.includes('-filter_complex'),
      outputArg: plan.fullArgs.at(-1),
      warnings: plan.warnings
    },
    checks
  };
}

async function createTextDrawtextFixture(context) {
  const backgroundPath = join(context.fixtureDir, 'text-background.mp4');
  await createColorVideoFixture(backgroundPath, {
    color: COLORS.darkBlue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  const backgroundStat = statSync(backgroundPath);
  return buildProject({
    id: 'golden-text-drawtext',
    name: 'Golden Text Drawtext',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-text-background',
        name: 'text-background.mp4',
        path: backgroundPath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: backgroundStat
      })
    ],
    tracks: [
      {
        id: 'track-background',
        type: 'video',
        name: 'Background',
        clips: [
          videoClip({
            id: 'clip-text-background',
            name: 'Text background',
            mediaId: 'asset-text-background',
            trackId: 'track-background',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      {
        id: 'track-text',
        type: 'text',
        name: 'Text',
        clips: [
          textClip({
            id: 'clip-text-title',
            trackId: 'track-text',
            text: 'OPEN FACTORY',
            start: 0,
            duration: context.fixture.expectedDuration,
            transform: { x: 0, y: -12, scale: 1, rotation: 0, opacity: 1 },
            style: {
              fontSize: 118,
              color: '#ff4fd8',
              backgroundColor: '#00e5ff',
              backgroundOpacity: 1,
              fontFamily: 'Arial',
              bold: true,
              italic: false
            }
          })
        ]
      }
    ]
  });
}

async function validateTextDrawtextFixture(context) {
  const frame = await readFrame(context.outputPath, {
    at: 0.6,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const nonBackgroundPixelCount = countDifferentPixels(frame, COLORS.darkBlue.rgb, 80);
  const pinkPixelCount = countNearPixels(frame, COLORS.pink.rgb, 90);
  const cyanPixelCount = countNearPixels(frame, COLORS.cyan.rgb, 60);
  return {
    checks: [
      {
        name: 'drawtext-textfile-artifact',
        passed: context.plan.textArtifacts.length === 1 && context.plan.filterComplex.includes('drawtext=textfile='),
        actual: {
          textArtifacts: context.plan.textArtifacts.length,
          hasDrawtextTextfile: context.plan.filterComplex.includes('drawtext=textfile=')
        },
        expected: 'one drawtext=textfile text artifact'
      },
      {
        name: 'drawtext-colored-style-filter',
        passed: context.plan.filterComplex.includes('fontcolor=0xff4fd8') && context.plan.filterComplex.includes('boxcolor=0x00e5ff@1'),
        actual: {
          hasPinkFont: context.plan.filterComplex.includes('fontcolor=0xff4fd8'),
          hasCyanBox: context.plan.filterComplex.includes('boxcolor=0x00e5ff@1')
        },
        expected: 'fontcolor=0xff4fd8 and boxcolor=0x00e5ff@1'
      },
      {
        name: 'text-non-background-pixels',
        passed: nonBackgroundPixelCount > 1_000,
        actual: nonBackgroundPixelCount,
        expected: '> 1000'
      },
      {
        name: 'colored-text-pixels',
        passed: pinkPixelCount > 500,
        actual: pinkPixelCount,
        expected: '> 500'
      },
      {
        name: 'colored-text-background-pixels',
        passed: cyanPixelCount > 5_000,
        actual: cyanPixelCount,
        expected: '> 5000'
      }
    ]
  };
}

async function createMultiClipOverlayFixture(context) {
  const firstPath = join(context.fixtureDir, 'segment-coral.mp4');
  const secondPath = join(context.fixtureDir, 'segment-blue.mp4');
  const overlayPath = join(context.fixtureDir, 'overlay-yellow.png');
  await createColorVideoFixture(firstPath, {
    color: COLORS.coral.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: 1,
    audio: false
  });
  await createColorVideoFixture(secondPath, {
    color: COLORS.blue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: 1,
    audio: false
  });
  await createColorImageFixture(overlayPath, {
    color: COLORS.yellow.ffmpeg,
    width: 320,
    height: 220
  });
  return buildProject({
    id: 'golden-multi-clip-overlay',
    name: 'Golden Multi Clip Overlay',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-segment-coral',
        name: 'segment-coral.mp4',
        path: firstPath,
        duration: 1,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(firstPath)
      }),
      videoAsset({
        id: 'asset-segment-blue',
        name: 'segment-blue.mp4',
        path: secondPath,
        duration: 1,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(secondPath)
      }),
      imageAsset({
        id: 'asset-overlay-yellow',
        name: 'overlay-yellow.png',
        path: overlayPath,
        width: 320,
        height: 220,
        stat: statSync(overlayPath)
      })
    ],
    tracks: [
      {
        id: 'track-base-video',
        type: 'video',
        name: 'Base Video',
        clips: [
          videoClip({
            id: 'clip-segment-coral',
            name: 'Coral segment',
            mediaId: 'asset-segment-coral',
            trackId: 'track-base-video',
            start: 0,
            duration: 1
          }),
          videoClip({
            id: 'clip-segment-blue',
            name: 'Blue segment',
            mediaId: 'asset-segment-blue',
            trackId: 'track-base-video',
            start: 1,
            duration: 1
          })
        ]
      },
      {
        id: 'track-overlay-video',
        type: 'video',
        name: 'Overlay',
        clips: [
          imageClip({
            id: 'clip-overlay-yellow',
            name: 'Yellow overlay',
            mediaId: 'asset-overlay-yellow',
            trackId: 'track-overlay-video',
            start: 1,
            duration: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateMultiClipOverlayFixture(context) {
  const firstSegmentCenter = await readPixel(context.outputPath, {
    at: 0.45,
    x: Math.floor(context.outputWidth / 2),
    y: Math.floor(context.outputHeight / 2)
  });
  const secondSegmentCenter = await readPixel(context.outputPath, {
    at: 1.45,
    x: Math.floor(context.outputWidth / 2),
    y: Math.floor(context.outputHeight / 2)
  });
  return {
    checks: [
      {
        name: 'first-segment-center-pixel',
        passed: pixelNear(firstSegmentCenter, COLORS.coral.rgb, 18),
        actual: firstSegmentCenter,
        expected: `${COLORS.coral.rgb.join(',')} +/- 18`
      },
      {
        name: 'second-segment-overlay-center-pixel',
        passed: pixelNear(secondSegmentCenter, COLORS.yellow.rgb, 18),
        actual: secondSegmentCenter,
        expected: `${COLORS.yellow.rgb.join(',')} +/- 18`
      },
      {
        name: 'duration-is-two-segments',
        passed: Math.abs(context.outputDuration - 2) <= 0.2,
        actual: round(context.outputDuration),
        expected: 2
      }
    ]
  };
}

async function createTextAnimationFixture(context) {
  const backgroundPath = join(context.fixtureDir, 'text-animation-background.mp4');
  await createColorVideoFixture(backgroundPath, {
    color: COLORS.darkBlue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  const backgroundStat = statSync(backgroundPath);
  return buildProject({
    id: 'golden-text-animation',
    name: 'Golden Text Animation',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-text-animation-background',
        name: 'text-animation-background.mp4',
        path: backgroundPath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: backgroundStat
      })
    ],
    tracks: [
      {
        id: 'track-text-animation-background',
        type: 'video',
        name: 'Background',
        clips: [
          videoClip({
            id: 'clip-text-animation-background',
            name: 'Text animation background',
            mediaId: 'asset-text-animation-background',
            trackId: 'track-text-animation-background',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      {
        id: 'track-text-animation',
        type: 'text',
        name: 'Text',
        clips: [
          textClip({
            id: 'clip-text-animation',
            trackId: 'track-text-animation',
            text: 'ANIMATED',
            start: 0,
            duration: context.fixture.expectedDuration,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            keyframes: {
              opacity: [
                { id: 'text-animation-opacity-start', time: 0, value: 0, easing: 'ease-out' },
                { id: 'text-animation-opacity-end', time: 0.6, value: 1, easing: 'ease-out' }
              ]
            },
            style: {
              fontSize: 118,
              color: '#ff4fd8',
              backgroundColor: '#000000',
              backgroundOpacity: 0,
              fontFamily: 'Arial',
              bold: true,
              italic: false
            }
          })
        ]
      }
    ]
  });
}

async function validateTextAnimationFixture(context) {
  const earlyFrame = await readFrame(context.outputPath, {
    at: 0.05,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const lateFrame = await readFrame(context.outputPath, {
    at: 0.9,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const earlyPinkPixels = countNearPixels(earlyFrame, COLORS.pink.rgb, 80);
  const latePinkPixels = countNearPixels(lateFrame, COLORS.pink.rgb, 80);
  return {
    checks: [
      {
        name: 'text-animation-fade-filter',
        passed: context.plan.filterComplex.includes('fade=t=in') && context.plan.filterComplex.includes('alpha=1'),
        actual: context.plan.filterComplex,
        expected: 'fade=t=in with alpha=1'
      },
      {
        name: 'text-animation-visible-after-fade',
        passed: latePinkPixels > earlyPinkPixels + 500,
        actual: { earlyPinkPixels, latePinkPixels },
        expected: 'late pink text pixels at least 500 above early frame'
      }
    ]
  };
}

async function createPathTextFixture(context) {
  const backgroundPath = join(context.fixtureDir, 'path-text-background.mp4');
  await createColorVideoFixture(backgroundPath, {
    color: COLORS.darkBlue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  const backgroundStat = statSync(backgroundPath);
  return buildProject({
    id: 'golden-path-text',
    name: 'Golden Path Text',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-path-text-background',
        name: 'path-text-background.mp4',
        path: backgroundPath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: backgroundStat
      })
    ],
    tracks: [
      {
        id: 'track-path-text-background',
        type: 'video',
        name: 'Background',
        clips: [
          videoClip({
            id: 'clip-path-text-background',
            name: 'Path text background',
            mediaId: 'asset-path-text-background',
            trackId: 'track-path-text-background',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      {
        id: 'track-path-text',
        type: 'text',
        name: 'Text',
        clips: [
          textClip({
            id: 'clip-path-text',
            trackId: 'track-path-text',
            text: 'PATH TEXT',
            start: 0,
            duration: context.fixture.expectedDuration,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            keyframes: {
              pathStartOffset: [
                { id: 'path-text-offset-start', time: 0, value: 0, easing: 'linear' },
                { id: 'path-text-offset-end', time: context.fixture.expectedDuration, value: 0.18, easing: 'linear' }
              ]
            },
            pathText: {
              enabled: true,
              path: [
                { x: 0.16, y: 0.62, handleOut: { x: 0.32, y: 0.28 } },
                { x: 0.5, y: 0.38, handleIn: { x: 0.36, y: 0.18 }, handleOut: { x: 0.64, y: 0.18 } },
                { x: 0.84, y: 0.62, handleIn: { x: 0.68, y: 0.28 } }
              ],
              startOffset: 0,
              letterSpacing: 10,
              rotateCharacters: true
            },
            style: {
              fontSize: 88,
              color: '#ff4fd8',
              backgroundColor: '#000000',
              backgroundOpacity: 0,
              fontFamily: 'Arial',
              bold: true,
              italic: false
            }
          })
        ]
      }
    ]
  });
}

async function validatePathTextFixture(context) {
  const frame = await readFrame(context.outputPath, {
    at: 0.7,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const nonBackgroundPixelCount = countDifferentPixels(frame, COLORS.darkBlue.rgb, 80);
  const pinkPixelCount = countNearPixels(frame, COLORS.pink.rgb, 90);
  return {
    checks: [
      {
        name: 'path-text-sequence-artifact',
        passed:
          context.plan.textArtifacts.some((artifact) => artifact.pathMode === 'path-text-sequence') &&
          context.plan.filterComplex.includes('pathtextsrc_') &&
          context.plan.filterComplex.includes('overlay=x=0:y=0'),
        actual: {
          textArtifacts: context.plan.textArtifacts.map((artifact) => artifact.pathMode),
          hasPathTextLayer: context.plan.filterComplex.includes('pathtextsrc_')
        },
        expected: 'path-text-sequence artifact and overlay layer'
      },
      {
        name: 'path-text-non-background-pixels',
        passed: nonBackgroundPixelCount > 500,
        actual: nonBackgroundPixelCount,
        expected: '> 500'
      },
      {
        name: 'path-text-colored-pixels',
        passed: pinkPixelCount > 100,
        actual: pinkPixelCount,
        expected: '> 100'
      }
    ]
  };
}

async function createRotationTransformFixture(context) {
  const imagePath = join(context.fixtureDir, 'rotated-yellow.png');
  await createColorImageFixture(imagePath, {
    color: COLORS.yellow.ffmpeg,
    width: 360,
    height: 180
  });
  return buildProject({
    id: 'golden-rotation-transform',
    name: 'Golden Rotation Transform',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      imageAsset({
        id: 'asset-rotated-yellow',
        name: 'rotated-yellow.png',
        path: imagePath,
        width: 360,
        height: 180,
        stat: statSync(imagePath)
      })
    ],
    tracks: [
      {
        id: 'track-rotation-video',
        type: 'video',
        name: 'Rotation',
        clips: [
          imageClip({
            id: 'clip-rotated-yellow',
            name: 'Rotated yellow',
            mediaId: 'asset-rotated-yellow',
            trackId: 'track-rotation-video',
            start: 0,
            duration: context.fixture.expectedDuration,
            transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 30, opacity: 1 }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateRotationTransformFixture(context) {
  return {
    checks: [
      {
        name: 'rotation-filter',
        passed: context.plan.filterComplex.includes('rotate=30*PI/180:c=none'),
        actual: context.plan.filterComplex,
        expected: 'rotate=30*PI/180:c=none'
      },
      {
        name: 'rotated-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.yellow.rgb, 18),
        actual: context.centerPixel,
        expected: `${COLORS.yellow.rgb.join(',')} +/- 18`
      }
    ]
  };
}

async function createAudioVolumeFadeFixture(context) {
  const sourcePath = join(context.fixtureDir, 'audio-fade-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.violet.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: true,
    frequency: 880
  });
  return buildProject({
    id: 'golden-audio-volume-fade',
    name: 'Golden Audio Volume Fade',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-audio-fade-source',
        name: 'audio-fade-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: true,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-video-audio-fade',
        type: 'video',
        name: 'Video With Audio',
        clips: [
          videoClip({
            id: 'clip-video-audio-fade',
            name: 'Audio fade video',
            mediaId: 'asset-audio-fade-source',
            trackId: 'track-video-audio-fade',
            duration: context.fixture.expectedDuration,
            volume: 0.5,
            fadeInDuration: 0.5
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateAudioVolumeFadeFixture(context) {
  return {
    checks: [
      {
        name: 'audio-filter-fade-in',
        passed: context.plan.filterComplex.includes('afade=t=in:st=0:d=0.5'),
        actual: context.plan.filterComplex.includes('afade=t=in:st=0:d=0.5'),
        expected: true
      },
      {
        name: 'audio-filter-volume-half',
        passed: context.plan.filterComplex.includes('volume=0.5'),
        actual: context.plan.filterComplex.includes('volume=0.5'),
        expected: true
      },
      {
        name: 'non-empty-audio-export',
        passed: context.outputSize > 10_000,
        actual: context.outputSize,
        expected: '> 10000'
      }
    ]
  };
}

async function createAudioSpectrumFixture(context) {
  const sourcePath = join(context.fixtureDir, 'audio-spectrum-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.darkBlue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: true,
    frequency: 660
  });
  return buildProject({
    id: 'golden-audio-spectrum',
    name: 'Golden Audio Spectrum',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-audio-spectrum-source',
        name: 'audio-spectrum-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: true,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-spectrum-video',
        type: 'video',
        name: 'Spectrum Video',
        clips: [
          videoClip({
            id: 'clip-audio-spectrum',
            name: 'Audio spectrum',
            mediaId: 'asset-audio-spectrum-source',
            trackId: 'track-spectrum-video',
            duration: context.fixture.expectedDuration,
            effects: [
              {
                id: 'effect-audio-spectrum',
                type: 'audio-spectrum',
                enabled: true,
                params: { style: 'bars', color: '#22d3ee', height: 25, position: 'bottom', sensitivity: 1.4 }
              }
            ]
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateAudioSpectrumFixture(context) {
  const filter = context.plan.filterComplex;
  return {
    checks: [
      {
        name: 'spectrum-filter',
        passed: filter.includes('showfreqs=s=1280x180:mode=bar:ascale=log:colors=0x22d3ee'),
        actual: filter,
        expected: 'showfreqs=s=1280x180:mode=bar:ascale=log:colors=0x22d3ee'
      },
      {
        name: 'spectrum-audio-split',
        passed: filter.includes('[amixout]asplit=2[aout][spectrum_audio_0]'),
        actual: filter,
        expected: '[amixout]asplit=2[aout][spectrum_audio_0]'
      },
      {
        name: 'spectrum-overlay',
        passed: filter.includes("overlay=x=0:y='main_h-overlay_h'"),
        actual: filter,
        expected: "overlay=x=0:y='main_h-overlay_h'"
      }
    ]
  };
}

async function createAudioVisualizationFixture(context) {
  const sourcePath = join(context.fixtureDir, 'audio-viz-source.wav');
  await createAudioFixture(sourcePath, { duration: context.fixture.expectedDuration, frequency: 520 });
  return buildProject({
    id: 'golden-audio-viz',
    name: 'Golden Audio Visualization',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      audioAsset({
        id: 'asset-audio-viz-source',
        name: 'audio-viz-source.wav',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-audio-viz-video',
        type: 'video',
        name: 'Video',
        clips: []
      },
      {
        id: 'track-audio-viz-audio',
        type: 'audio',
        name: 'Audio',
        clips: [
          audioClip({
            id: 'clip-audio-viz',
            name: 'Audio visualization source',
            mediaId: 'asset-audio-viz-source',
            trackId: 'track-audio-viz-audio',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyTextTrack()
    ]
  });
}

async function validateAudioVisualizationFixture(context) {
  const filter = context.plan.filterComplex;
  const videoFrameCount = await readVideoFrameCount(context.outputPath);
  const audioStreamCount = await readStreamCount(context.outputPath, 'a:0');
  const frame = await readFrame(context.outputPath, { at: 0.35, width: 160, height: 90 });
  const waveformPixelCount = countPixels(frame, (r, g, b, a) => a > 200 && Math.abs(r - 5) + Math.abs(g - 8) + Math.abs(b - 22) > 40);
  return {
    checks: [
      {
        name: 'audio-viz-filter',
        passed: filter.includes('showwaves=s=1280x720:mode=line:colors=0x22d3ee'),
        actual: filter,
        expected: 'showwaves=s=1280x720:mode=line:colors=0x22d3ee'
      },
      {
        name: 'audio-viz-audio-split',
        passed: filter.includes('[amixout]asplit=2[aout][audio_visualization_mix]'),
        actual: filter,
        expected: '[amixout]asplit=2[aout][audio_visualization_mix]'
      },
      {
        name: 'audio-viz-video-frames',
        passed: videoFrameCount > 0,
        actual: videoFrameCount,
        expected: '> 0'
      },
      {
        name: 'audio-viz-audio-stream',
        passed: audioStreamCount > 0,
        actual: audioStreamCount,
        expected: '> 0'
      },
      {
        name: 'audio-viz-visible-waveform',
        passed: waveformPixelCount > 200,
        actual: waveformPixelCount,
        expected: '> 200 non-background pixels'
      }
    ]
  };
}

async function createSubtitleBurnInFixture(context) {
  const backgroundPath = join(context.fixtureDir, 'subtitle-background.mp4');
  await createColorVideoFixture(backgroundPath, {
    color: COLORS.darkBlue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-subtitle-burn-in',
    name: 'Golden Subtitle Burn In',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-subtitle-background',
        name: 'subtitle-background.mp4',
        path: backgroundPath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(backgroundPath)
      })
    ],
    tracks: [
      {
        id: 'track-subtitle-background',
        type: 'video',
        name: 'Background',
        clips: [
          videoClip({
            id: 'clip-subtitle-background',
            name: 'Subtitle background',
            mediaId: 'asset-subtitle-background',
            trackId: 'track-subtitle-background',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack(),
      {
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles',
        clips: [
          subtitleClip({
            id: 'clip-subtitle-one',
            trackId: 'track-subtitle',
            text: 'CAPTION READY',
            start: 0.2,
            duration: 0.8
          }),
          subtitleClip({
            id: 'clip-subtitle-two',
            trackId: 'track-subtitle',
            text: 'SECOND LINE',
            start: 1,
            duration: 0.4
          })
        ]
      }
    ]
  });
}

async function validateSubtitleBurnInFixture(context) {
  const frame = await readFrame(context.outputPath, {
    at: 0.6,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const whitePixelCount = countNearPixels(frame, [255, 255, 255], 70);
  return {
    checks: [
      {
        name: 'subtitle-srt-artifact',
        passed:
          context.plan.textArtifacts.some(
            (artifact) => artifact.fileName === 'subtitles.srt' && artifact.pathMode === 'filter' && artifact.text.includes('CAPTION READY')
          ) && context.plan.filterComplex.includes('subtitles=filename=__SUBTITLEFILE_export_subtitles__'),
        actual: {
          textArtifacts: context.plan.textArtifacts.map((artifact) => ({ fileName: artifact.fileName, pathMode: artifact.pathMode })),
          hasSubtitlesFilter: context.plan.filterComplex.includes('subtitles=filename=__SUBTITLEFILE_export_subtitles__')
        },
        expected: 'subtitles filter with a temporary SRT artifact'
      },
      {
        name: 'subtitle-force-style',
        passed: context.plan.filterComplex.includes('PrimaryColour=&Hffffff&') && context.plan.filterComplex.includes('MarginV=72'),
        actual: {
          hasWhitePrimary: context.plan.filterComplex.includes('PrimaryColour=&Hffffff&'),
          hasBottomMargin: context.plan.filterComplex.includes('MarginV=72')
        },
        expected: 'white subtitle force style with bottom margin'
      },
      {
        name: 'subtitle-white-pixels',
        passed: whitePixelCount > 200,
        actual: whitePixelCount,
        expected: '> 200'
      }
    ]
  };
}

async function createColorCorrectionFixture(context) {
  const sourcePath = join(context.fixtureDir, 'cyan-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.cyan.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-color-correction',
    name: 'Golden Color Correction',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-cyan-source',
        name: 'cyan-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-color-video',
        type: 'video',
        name: 'Color Video',
        clips: [
          videoClip({
            id: 'clip-color-correction',
            name: 'Hue shifted cyan',
            mediaId: 'asset-cyan-source',
            trackId: 'track-color-video',
            duration: context.fixture.expectedDuration,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 60 }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateColorCorrectionFixture(context) {
  const shiftedAwayFromCyan =
    Math.abs(context.centerPixel[0] - COLORS.cyan.rgb[0]) +
      Math.abs(context.centerPixel[1] - COLORS.cyan.rgb[1]) +
      Math.abs(context.centerPixel[2] - COLORS.cyan.rgb[2]) >
    80;
  return {
    checks: [
      {
        name: 'color-correction-filter',
        passed: context.plan.filterComplex.includes('eq=brightness=0:contrast=1:saturation=1') && context.plan.filterComplex.includes('hue=h=60'),
        actual: {
          hasEq: context.plan.filterComplex.includes('eq=brightness=0:contrast=1:saturation=1'),
          hasHue: context.plan.filterComplex.includes('hue=h=60')
        },
        expected: 'eq + hue=h=60'
      },
      {
        name: 'center-pixel-hue-shifted',
        passed: shiftedAwayFromCyan && context.centerPixel[2] > context.centerPixel[1],
        actual: context.centerPixel,
        expected: 'not cyan and blue channel dominant after hue shift'
      }
    ]
  };
}

async function createPanorama360Fixture(context) {
  const sourcePath = join(context.fixtureDir, 'panorama-source.mp4');
  await createPanoramaVideoFixture(sourcePath, {
    width: 2048,
    height: 1024,
    duration: context.fixture.expectedDuration
  });
  return buildProject({
    id: 'golden-panorama-360',
    name: 'Golden 360 Panorama',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-panorama-source',
        name: 'panorama-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: 2048,
        height: 1024,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-panorama-video',
        type: 'video',
        name: 'Panorama',
        clips: [
          videoClip({
            id: 'clip-panorama-360',
            name: '360 source',
            mediaId: 'asset-panorama-source',
            trackId: 'track-panorama-video',
            duration: context.fixture.expectedDuration,
            projection: 'equirectangular',
            panorama: { yaw: 0, pitch: 0, roll: 0, fov: 90, outputProjection: 'flat' }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validatePanorama360Fixture(context) {
  return {
    checks: [
      {
        name: 'v360-filter',
        passed: context.plan.filterComplex.includes('v360=e:flat:yaw=0:pitch=0:roll=0:v_fov=90'),
        actual: context.plan.filterComplex.includes('v360=e:flat'),
        expected: 'v360=e:flat with yaw/pitch/roll/fov'
      },
      {
        name: 'spherical-metadata',
        passed: context.plan.outputArgs?.includes?.('-metadata:s:v:0') && context.plan.outputArgs?.includes?.('spherical=true'),
        actual: context.plan.outputArgs,
        expected: '-metadata:s:v:0 spherical=true'
      },
      {
        name: 'projected-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.green.rgb, 70),
        actual: context.centerPixel,
        expected: COLORS.green.rgb
      }
    ]
  };
}

async function createAdjustmentLayerFixture(context) {
  const sourcePath = join(context.fixtureDir, 'adjustment-light-gray-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.lightGray.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-adjustment-layer',
    name: 'Golden Adjustment Layer',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-adjustment-source',
        name: 'adjustment-light-gray-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-adjustment-base',
        type: 'video',
        name: 'Base',
        clips: [
          videoClip({
            id: 'clip-adjustment-base',
            name: 'Light gray base',
            mediaId: 'asset-adjustment-source',
            trackId: 'track-adjustment-base',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      {
        id: 'track-adjustment-layer',
        type: 'video',
        name: 'Adjustment',
        clips: [
          adjustmentClip({
            id: 'clip-adjustment-layer',
            name: 'Darken adjustment',
            trackId: 'track-adjustment-layer',
            duration: context.fixture.expectedDuration,
            colorCorrection: { brightness: -0.35, contrast: 1, saturation: 1, hue: 0 }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateAdjustmentLayerFixture(context) {
  const sourceBrightness = (COLORS.lightGray.rgb[0] + COLORS.lightGray.rgb[1] + COLORS.lightGray.rgb[2]) / 3;
  const outputBrightness = (context.centerPixel[0] + context.centerPixel[1] + context.centerPixel[2]) / 3;
  return {
    checks: [
      {
        name: 'adjustment-layer-filter-chain',
        passed:
          context.plan.filterComplex.includes('clip_adjustment_layer') &&
          context.plan.filterComplex.includes('eq=brightness=-0.35:contrast=1:saturation=1') &&
          context.plan.filterComplex.includes("enable='between(t,0,1.5)'"),
        actual: {
          hasClipLabel: context.plan.filterComplex.includes('clip_adjustment_layer'),
          hasEq: context.plan.filterComplex.includes('eq=brightness=-0.35:contrast=1:saturation=1')
        },
        expected: 'adjustment layer split + eq + enabled overlay'
      },
      {
        name: 'adjustment-layer-darkened-frame',
        passed: outputBrightness < sourceBrightness - 40,
        actual: {
          centerPixel: context.centerPixel,
          sourceBrightness,
          outputBrightness
        },
        expected: 'center brightness at least 40 below source light gray'
      }
    ]
  };
}

async function createChromaKeyFixture(context) {
  const sourcePath = join(context.fixtureDir, 'chroma-green-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.keyGreen.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-chroma-key',
    name: 'Golden Chroma Key',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-chroma-green-source',
        name: 'chroma-green-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-chroma-video',
        type: 'video',
        name: 'Chroma Video',
        clips: [
          videoClip({
            id: 'clip-chroma-key',
            name: 'Green keyed source',
            mediaId: 'asset-chroma-green-source',
            trackId: 'track-chroma-video',
            duration: context.fixture.expectedDuration,
            chromaKey: {
              enabled: true,
              color: COLORS.keyGreen.rgb,
              similarity: 0.28,
              blend: 0.08
            }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateChromaKeyFixture(context) {
  const sourcePath = context.project.media.find((asset) => asset.id === 'asset-chroma-green-source')?.path;
  const keyedAlpha = sourcePath
    ? await readChromaKeyAlpha(sourcePath, {
        color: '0x00FF00',
        similarity: 0.28,
        blend: 0.08,
        x: Math.floor(context.outputWidth / 2),
        y: Math.floor(context.outputHeight / 2)
      })
    : 255;
  return {
    checks: [
      {
        name: 'chroma-key-filter',
        passed: context.plan.filterComplex.includes('chromakey=color=0x00FF00:similarity=0.28:blend=0.08'),
        actual: context.plan.filterComplex.includes('chromakey=color=0x00FF00:similarity=0.28:blend=0.08'),
        expected: true
      },
      {
        name: 'chroma-key-output-center-reveals-base',
        passed: pixelNear(context.centerPixel, COLORS.black.rgb, 18),
        actual: context.centerPixel,
        expected: `${COLORS.black.rgb.join(',')} +/- 18`
      },
      {
        name: 'chroma-key-center-alpha-reduced',
        passed: keyedAlpha < 32,
        actual: keyedAlpha,
        expected: '< 32 alpha after chromakey'
      }
    ]
  };
}

async function createColorCurvesFixture(context) {
  const sourcePath = join(context.fixtureDir, 'gray-curve-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.gray.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-color-curves',
    name: 'Golden Color Curves',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-gray-curve-source',
        name: 'gray-curve-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-color-curves',
        type: 'video',
        name: 'Color Curves',
        clips: [
          videoClip({
            id: 'clip-color-curves',
            name: 'Darkened curve gray',
            mediaId: 'asset-gray-curve-source',
            trackId: 'track-color-curves',
            duration: context.fixture.expectedDuration,
            colorCorrection: {
              brightness: 0,
              contrast: 1,
              saturation: 1,
              hue: 0,
              colorCurves: {
                master: [
                  { x: 0, y: 0 },
                  { x: 0.5, y: 0.3 },
                  { x: 1, y: 1 }
                ],
                r: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 }
                ],
                g: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 }
                ],
                b: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 }
                ]
              }
            }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateColorCurvesFixture(context) {
  const centerBrightness = (context.centerPixel[0] + context.centerPixel[1] + context.centerPixel[2]) / 3;
  const sourceBrightness = (COLORS.gray.rgb[0] + COLORS.gray.rgb[1] + COLORS.gray.rgb[2]) / 3;
  const curveArtifact = context.plan.textArtifacts.find((artifact) => artifact.fileName === 'curves-clip_color_curves.cube');
  return {
    checks: [
      {
        name: 'curve-lut-artifact',
        passed: Boolean(curveArtifact?.text.includes('LUT_1D_SIZE 17')) && context.plan.filterComplex.includes('lut1d=file=__CURVE_LUT_clip_color_curves__'),
        actual: {
          textArtifacts: context.plan.textArtifacts.map((artifact) => artifact.fileName),
          hasLut1dFilter: context.plan.filterComplex.includes('lut1d=file=__CURVE_LUT_clip_color_curves__')
        },
        expected: '17 point curve .cube artifact and lut1d filter'
      },
      {
        name: 'curve-center-pixel-darkened',
        passed: centerBrightness < sourceBrightness - 30,
        actual: {
          centerPixel: context.centerPixel,
          centerBrightness: round(centerBrightness),
          sourceBrightness
        },
        expected: 'center brightness at least 30 below source gray'
      }
    ]
  };
}

async function createColorMatchFixture(context) {
  const targetPath = join(context.fixtureDir, 'color-match-target.mp4');
  const referencePath = join(context.fixtureDir, 'color-match-reference.mp4');
  const segmentDuration = context.fixture.expectedDuration / 2;
  await createColorVideoFixture(targetPath, {
    color: COLORS.blue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: segmentDuration,
    audio: false
  });
  await createColorVideoFixture(referencePath, {
    color: COLORS.coral.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: segmentDuration,
    audio: false
  });
  const colorCurves = buildColorMatchCurves(solidFrameSample(COLORS.blue.rgb), solidFrameSample(COLORS.coral.rgb));
  return buildProject({
    id: 'golden-color-match',
    name: 'Golden Color Match',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-color-match-target',
        name: 'color-match-target.mp4',
        path: targetPath,
        duration: segmentDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(targetPath)
      }),
      videoAsset({
        id: 'asset-color-match-reference',
        name: 'color-match-reference.mp4',
        path: referencePath,
        duration: segmentDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(referencePath)
      })
    ],
    tracks: [
      {
        id: 'track-color-match',
        type: 'video',
        name: 'Color Match',
        clips: [
          videoClip({
            id: 'clip-color-match-target',
            name: 'Matched blue target',
            mediaId: 'asset-color-match-target',
            trackId: 'track-color-match',
            duration: segmentDuration,
            colorCorrection: {
              brightness: 0,
              contrast: 1,
              saturation: 1,
              hue: 0,
              colorCurves
            }
          }),
          videoClip({
            id: 'clip-color-match-reference',
            name: 'Coral reference',
            mediaId: 'asset-color-match-reference',
            trackId: 'track-color-match',
            start: segmentDuration,
            duration: segmentDuration
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateColorMatchFixture(context) {
  const targetFrame = await readFrame(context.outputPath, { at: 0.75, width: 32, height: 18 });
  const referenceFrame = await readFrame(context.outputPath, { at: 2.25, width: 32, height: 18 });
  const targetMean = meanRgb(targetFrame);
  const referenceMean = meanRgb(referenceFrame);
  const channelDeltas = targetMean.map((channel, index) => Math.abs(channel - referenceMean[index]));
  const maxDelta = Math.max(...channelDeltas);
  const curveArtifact = context.plan.textArtifacts.find((artifact) => artifact.fileName === 'curves-clip_color_match_target.cube');
  return {
    checks: [
      {
        name: 'color-match-curve-lut-artifact',
        passed: Boolean(curveArtifact?.text.includes('LUT_1D_SIZE 17')) && context.plan.filterComplex.includes('lut1d=file=__CURVE_LUT_clip_color_match_target__'),
        actual: {
          textArtifacts: context.plan.textArtifacts.map((artifact) => artifact.fileName),
          hasLut1dFilter: context.plan.filterComplex.includes('lut1d=file=__CURVE_LUT_clip_color_match_target__')
        },
        expected: 'generated color match curve .cube artifact and lut1d filter'
      },
      {
        name: 'color-match-mean-delta',
        passed: maxDelta < 15,
        actual: {
          targetMean,
          referenceMean,
          channelDeltas,
          maxDelta
        },
        expected: 'matched target/reference frame mean channel delta < 15'
      }
    ]
  };
}

async function createColorWheelFixture(context) {
  const sourcePath = join(context.fixtureDir, 'light-gray-wheel-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.lightGray.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  return buildProject({
    id: 'golden-color-wheel',
    name: 'Golden Color Wheel',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-light-gray-wheel-source',
        name: 'light-gray-wheel-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-color-wheel',
        type: 'video',
        name: 'Color Wheel',
        clips: [
          videoClip({
            id: 'clip-color-wheel',
            name: 'Red gain gray',
            mediaId: 'asset-light-gray-wheel-source',
            trackId: 'track-color-wheel',
            duration: context.fixture.expectedDuration,
            colorCorrection: {
              brightness: 0,
              contrast: 1,
              saturation: 1,
              hue: 0,
              threeWayColor: {
                lift: { r: 0, g: 0, b: 0, intensity: 1 },
                gamma: { r: 0, g: 0, b: 0, intensity: 1 },
                gain: { r: 0.3, g: 0, b: 0, intensity: 1 }
              }
            }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateColorWheelFixture(context) {
  return {
    checks: [
      {
        name: 'color-wheel-filter',
        passed: context.plan.filterComplex.includes('colorbalance=rh=0.3'),
        actual: context.plan.filterComplex.includes('colorbalance=rh=0.3'),
        expected: true
      },
      {
        name: 'color-wheel-center-pixel-red-dominant',
        passed: context.centerPixel[0] > context.centerPixel[1] + 20 && context.centerPixel[0] > context.centerPixel[2] + 20,
        actual: context.centerPixel,
        expected: 'R channel > G/B by at least 20'
      }
    ]
  };
}

async function createSpeedChangeFixture(context) {
  const sourcePath = join(context.fixtureDir, 'speed-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.green.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: 1.5,
    audio: true,
    frequency: 550
  });
  return buildProject({
    id: 'golden-speed-change',
    name: 'Golden Speed Change',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-speed-source',
        name: 'speed-source.mp4',
        path: sourcePath,
        duration: 1.5,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: true,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-speed-video',
        type: 'video',
        name: 'Speed Video',
        clips: [
          videoClip({
            id: 'clip-speed-change',
            name: 'Speed 2x',
            mediaId: 'asset-speed-source',
            trackId: 'track-speed-video',
            duration: 0.75,
            speed: 2
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateSpeedChangeFixture(context) {
  return {
    checks: [
      {
        name: 'speed-video-setpts',
        passed: context.plan.filterComplex.includes('setpts=(PTS-STARTPTS)/2+0/TB'),
        actual: context.plan.filterComplex.includes('setpts=(PTS-STARTPTS)/2+0/TB'),
        expected: true
      },
      {
        name: 'speed-audio-atempo',
        passed: context.plan.filterComplex.includes('atempo=2.0'),
        actual: context.plan.filterComplex.includes('atempo=2.0'),
        expected: true
      },
      {
        name: 'speed-duration',
        passed: Math.abs(context.outputDuration - 0.75) <= 1 / 30 + 0.08,
        actual: round(context.outputDuration),
        expected: '0.75s +/- 1 frame'
      },
      {
        name: 'speed-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.green.rgb, 14),
        actual: context.centerPixel,
        expected: `${COLORS.green.rgb.join(',')} +/- 14`
      }
    ]
  };
}

async function createSpeedRampFixture(context) {
  const sourcePath = join(context.fixtureDir, 'speed-ramp-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.blue.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: 2,
    audio: false
  });
  return buildProject({
    id: 'golden-speed-ramp',
    name: 'Golden Speed Ramp',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-speed-ramp-source',
        name: 'speed-ramp-source.mp4',
        path: sourcePath,
        duration: 2,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-speed-ramp-video',
        type: 'video',
        name: 'Speed Ramp Video',
        clips: [
          videoClip({
            id: 'clip-speed-ramp',
            name: 'Speed Ramp 1x to 2x',
            mediaId: 'asset-speed-ramp-source',
            trackId: 'track-speed-ramp-video',
            duration: 1.25,
            speed: 1,
            keyframes: {
              speed: [
                { id: 'speed-ramp-start', time: 0, value: 1, easing: 'linear' },
                { id: 'speed-ramp-fast', time: 1, value: 2, easing: 'linear' }
              ]
            }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateSpeedRampFixture(context) {
  return {
    checks: [
      {
        name: 'speed-ramp-segmented-setpts',
        passed:
          context.plan.filterComplex.includes("setpts='(") &&
          context.plan.filterComplex.includes('if(lte(((PTS-STARTPTS)*TB),1.5)') &&
          context.plan.filterComplex.includes('if(lte(((PTS-STARTPTS)*TB),2)'),
        actual: context.plan.filterComplex,
        expected: 'segmented setpts expression with source cut points at 1.5s and 2s'
      },
      {
        name: 'speed-ramp-duration-under-source',
        passed: context.outputDuration < 2,
        actual: round(context.outputDuration),
        expected: '< 2s source duration'
      },
      {
        name: 'speed-ramp-duration',
        passed: Math.abs(context.outputDuration - 1.25) <= 2 / 30 + 0.08,
        actual: round(context.outputDuration),
        expected: '1.25s +/- 2 frames'
      },
      {
        name: 'speed-ramp-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.blue.rgb, 14),
        actual: context.centerPixel,
        expected: `${COLORS.blue.rgb.join(',')} +/- 14`
      }
    ]
  };
}

async function createCustomShaderFixture(context) {
  const sourcePath = join(context.fixtureDir, 'custom-shader-source.mp4');
  await createTestPatternVideoFixture(sourcePath, {
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration
  });
  return buildProject({
    id: 'golden-custom-shader',
    name: 'Golden Custom Shader',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-custom-shader-source',
        name: 'custom-shader-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-custom-shader-video',
        type: 'video',
        name: 'Custom Shader Video',
        clips: [
          videoClip({
            id: 'clip-custom-shader',
            name: 'Pixelate Shader',
            mediaId: 'asset-custom-shader-source',
            trackId: 'track-custom-shader-video',
            duration: context.fixture.expectedDuration,
            effects: [
              {
                id: 'effect-custom-shader-pixelate',
                type: 'custom-shader',
                enabled: true,
                params: {
                  preset: 'pixelate',
                  source: `vec2 blockSize = vec2(18.0) / u_resolution;
vec2 uv = floor(v_texCoord / blockSize) * blockSize + blockSize * 0.5;
gl_FragColor = texture2D(u_texture, uv);`
                }
              }
            ]
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateCustomShaderFixture(context) {
  const frame = await readFrame(context.outputPath, {
    at: 0.35,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const repeatedBlocks = countPixelatedBlocks(frame, context.outputWidth, context.outputHeight, 18, 18);
  const artifact = context.plan.textArtifacts.find((item) => item.pathMode === 'shader-sequence');
  return {
    checks: [
      {
        name: 'custom-shader-artifact',
        passed: Boolean(artifact) && artifact.fileName === 'custom-shader-clip_custom_shader.json',
        actual: context.plan.textArtifacts.map((item) => ({ fileName: item.fileName, pathMode: item.pathMode })),
        expected: 'shader-sequence artifact'
      },
      {
        name: 'custom-shader-overlay',
        passed: context.plan.filterComplex.includes('overlay='),
        actual: context.plan.filterComplex.includes('overlay='),
        expected: true
      },
      {
        name: 'custom-shader-warning',
        passed: context.plan.warnings.some((warning) => warning.includes('will render frame-by-frame')),
        actual: context.plan.warnings,
        expected: 'frame-by-frame warning'
      },
      {
        name: 'custom-shader-blocky-frame',
        passed: repeatedBlocks >= 70,
        actual: repeatedBlocks,
        expected: '>= 70 repeated pixel blocks'
      }
    ]
  };
}

async function createMuteTrackFixture(context) {
  const videoPath = join(context.fixtureDir, 'mute-video-source.mp4');
  const audioPath = join(context.fixtureDir, 'muted-audio-source.wav');
  await createColorVideoFixture(videoPath, {
    color: COLORS.green.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: false
  });
  await createAudioFixture(audioPath, { duration: context.fixture.expectedDuration, frequency: 440 });
  return buildProject({
    id: 'golden-mute-track',
    name: 'Golden Mute Track',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-mute-video-source',
        name: 'mute-video-source.mp4',
        path: videoPath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: statSync(videoPath)
      }),
      audioAsset({
        id: 'asset-muted-audio-source',
        name: 'muted-audio-source.wav',
        path: audioPath,
        duration: context.fixture.expectedDuration,
        stat: statSync(audioPath)
      })
    ],
    tracks: [
      {
        id: 'track-mute-video',
        type: 'video',
        name: 'Video',
        clips: [
          videoClip({
            id: 'clip-mute-video',
            name: 'Mute video',
            mediaId: 'asset-mute-video-source',
            trackId: 'track-mute-video',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      {
        id: 'track-muted-audio',
        type: 'audio',
        name: 'Muted Audio',
        muted: true,
        clips: [
          audioClip({
            id: 'clip-muted-audio',
            name: 'Muted audio',
            mediaId: 'asset-muted-audio-source',
            trackId: 'track-muted-audio',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyTextTrack()
    ]
  });
}

async function validateMuteTrackFixture(context) {
  return {
    checks: [
      {
        name: 'muted-audio-track-excluded',
        passed: !context.plan.filterComplex.includes('atrim=start=0:duration=1.5') && context.plan.filterComplex.includes('anullsrc=channel_layout=stereo'),
        actual: {
          hasMutedAudioAtrim: context.plan.filterComplex.includes('atrim=start=0:duration=1.5'),
          hasSilentFallback: context.plan.filterComplex.includes('anullsrc=channel_layout=stereo')
        },
        expected: 'muted audio source excluded, silent fallback used'
      },
      {
        name: 'mute-track-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.green.rgb, 14),
        actual: context.centerPixel,
        expected: `${COLORS.green.rgb.join(',')} +/- 14`
      }
    ]
  };
}

async function createKenBurnsFixture(context) {
  const imagePath = join(context.fixtureDir, 'ken-burns-pattern.png');
  await createPatternImageFixture(imagePath, {
    width: context.outputWidth,
    height: context.outputHeight
  });
  return buildProject({
    id: 'golden-ken-burns',
    name: 'Golden Ken Burns',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      imageAsset({
        id: 'asset-ken-burns-pattern',
        name: 'ken-burns-pattern.png',
        path: imagePath,
        width: context.outputWidth,
        height: context.outputHeight,
        stat: statSync(imagePath)
      })
    ],
    tracks: [
      {
        id: 'track-ken-burns-image',
        type: 'video',
        name: 'Ken Burns Image',
        clips: [
          imageClip({
            id: 'clip-ken-burns-image',
            name: 'Ken Burns pattern',
            mediaId: 'asset-ken-burns-pattern',
            trackId: 'track-ken-burns-image',
            duration: context.fixture.expectedDuration,
            kenBurns: true,
            keyframes: {
              scaleX: [
                { id: 'kb-sx-start', time: 0, value: 1, easing: 'ease-in-out' },
                { id: 'kb-sx-end', time: context.fixture.expectedDuration, value: 1.5, easing: 'ease-in-out' }
              ],
              scaleY: [
                { id: 'kb-sy-start', time: 0, value: 1, easing: 'ease-in-out' },
                { id: 'kb-sy-end', time: context.fixture.expectedDuration, value: 1.5, easing: 'ease-in-out' }
              ],
              x: [
                { id: 'kb-x-start', time: 0, value: 0, easing: 'ease-in-out' },
                { id: 'kb-x-end', time: context.fixture.expectedDuration, value: 0, easing: 'ease-in-out' }
              ],
              y: [
                { id: 'kb-y-start', time: 0, value: 0, easing: 'ease-in-out' },
                { id: 'kb-y-end', time: context.fixture.expectedDuration, value: 0, easing: 'ease-in-out' }
              ]
            }
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateKenBurnsFixture(context) {
  const firstFrame = await readFrame(context.outputPath, {
    at: 0.1,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const lastFrame = await readFrame(context.outputPath, {
    at: 1.35,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const firstCenterAverage = averageRegion(firstFrame, context.outputWidth, context.outputHeight, {
    centerX: Math.floor(context.outputWidth / 2),
    centerY: Math.floor(context.outputHeight / 2),
    width: 320,
    height: 180
  });
  const lastCenterAverage = averageRegion(lastFrame, context.outputWidth, context.outputHeight, {
    centerX: Math.floor(context.outputWidth / 2),
    centerY: Math.floor(context.outputHeight / 2),
    width: 320,
    height: 180
  });
  const centerDelta = rgbDelta(firstCenterAverage, lastCenterAverage);
  const hasFrameEvaluatedScale = context.plan.filterComplex.includes("scale=w='trunc(iw*(") && context.plan.filterComplex.includes(':eval=frame');
  const hasZoompanScale = context.plan.filterComplex.includes('zoompan=z=');
  const hasSetsar = context.plan.filterComplex.includes('setsar=1');
  return {
    checks: [
      {
        name: 'ken-burns-scale-expression',
        passed: (hasFrameEvaluatedScale || hasZoompanScale) && hasSetsar,
        actual: {
          hasFrameEvaluatedScale,
          hasZoompanScale,
          hasSetsar
        },
        expected: 'animated scale or zoompan Ken Burns filter with setsar=1'
      },
      {
        name: 'ken-burns-center-region-changed',
        passed: centerDelta > 12,
        actual: {
          firstCenterAverage,
          lastCenterAverage,
          delta: centerDelta
        },
        expected: 'center region average RGB delta > 12'
      }
    ]
  };
}

async function createProxyOriginalExportFixture(context) {
  const sourcePath = join(context.fixtureDir, 'proxy-original-source.mp4');
  await createColorVideoFixture(sourcePath, {
    color: COLORS.green.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight,
    duration: context.fixture.expectedDuration,
    audio: true,
    frequency: 660
  });
  return buildProject({
    id: 'golden-proxy-original-export',
    name: 'Golden Proxy Original Export',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-proxy-original-source',
        name: 'proxy-original-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: true,
        proxyPath: normalizePath(join(context.fixtureDir, 'proxy-preview-640x360.mp4')),
        proxyStatus: 'ready',
        stat: statSync(sourcePath)
      })
    ],
    tracks: [
      {
        id: 'track-proxy-original-video',
        type: 'video',
        name: 'Original Export Video',
        clips: [
          videoClip({
            id: 'clip-proxy-original-video',
            name: 'Original export source',
            mediaId: 'asset-proxy-original-source',
            trackId: 'track-proxy-original-video',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateProxyOriginalExportFixture(context) {
  return {
    checks: [
      {
        name: 'original-export-center-pixel',
        passed: pixelNear(context.centerPixel, COLORS.green.rgb, 10),
        actual: context.centerPixel,
        expected: `${COLORS.green.rgb.join(',')} +/- 10`
      },
      {
        name: 'export-uses-original-path',
        passed: !context.plan.inputs.some((input) => input.path.includes('proxy-preview-640x360')),
        actual: context.plan.inputs.map((input) => input.path),
        expected: 'only original media paths'
      }
    ]
  };
}

async function createSceneDetectFixture(context) {
  const sourcePath = join(context.fixtureDir, 'scene-hard-cut.mp4');
  await createHardCutVideoFixture(sourcePath, {
    firstColor: COLORS.black.ffmpeg,
    secondColor: COLORS.white.ffmpeg,
    width: context.outputWidth,
    height: context.outputHeight
  });
  const sourceStat = statSync(sourcePath);
  const sceneTimes = await detectSceneTimes(sourcePath);
  if (sceneTimes.length === 0) {
    throw new Error('Scene detection did not find the hard cut.');
  }
  const splitTime = sceneTimes[0];
  const project = buildProject({
    id: 'golden-scene-detect',
    name: 'Golden Scene Detect',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-scene-hard-cut',
        name: 'scene-hard-cut.mp4',
        path: sourcePath,
        duration: 2,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: sourceStat
      })
    ],
    tracks: [
      {
        id: 'track-scene-video',
        type: 'video',
        name: 'Scene Video',
        clips: [
          videoClip({
            id: 'clip-scene-first',
            name: 'Scene first',
            mediaId: 'asset-scene-hard-cut',
            trackId: 'track-scene-video',
            start: 0,
            duration: splitTime,
            trimStart: 0,
            trimEnd: round(2 - splitTime)
          }),
          videoClip({
            id: 'clip-scene-second',
            name: 'Scene second',
            mediaId: 'asset-scene-hard-cut',
            trackId: 'track-scene-video',
            start: splitTime,
            duration: round(2 - splitTime),
            trimStart: splitTime,
            trimEnd: 0
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
  project.sceneDetection = { sceneTimes };
  return project;
}

async function validateSceneDetectFixture(context) {
  const sceneTimes = context.project.sceneDetection?.sceneTimes ?? [];
  const clips = context.project.timeline.tracks.find((track) => track.id === 'track-scene-video')?.clips ?? [];
  const firstPixel = await readPixel(context.outputPath, {
    at: 0.45,
    x: Math.floor(context.outputWidth / 2),
    y: Math.floor(context.outputHeight / 2)
  });
  const secondPixel = await readPixel(context.outputPath, {
    at: 1.45,
    x: Math.floor(context.outputWidth / 2),
    y: Math.floor(context.outputHeight / 2)
  });

  return {
    checks: [
      {
        name: 'scene-detect-found-one-cut',
        passed: sceneTimes.length === 1 && Math.abs(sceneTimes[0] - 1) <= 0.08,
        actual: sceneTimes,
        expected: 'one cut near 1.0s'
      },
      {
        name: 'scene-detect-split-clip-count',
        passed: clips.length === 2,
        actual: clips.map((clip) => ({ start: clip.start, duration: clip.duration, trimStart: clip.trimStart })),
        expected: 'two clips split at detected scene time'
      },
      {
        name: 'scene-first-color',
        passed: pixelNear(firstPixel, COLORS.black.rgb, 18),
        actual: firstPixel,
        expected: `${COLORS.black.rgb.join(',')} +/- 18`
      },
      {
        name: 'scene-second-color',
        passed: pixelNear(secondPixel, COLORS.white.rgb, 18),
        actual: secondPixel,
        expected: `${COLORS.white.rgb.join(',')} +/- 18`
      }
    ]
  };
}

async function createGifAnimationFixture(context) {
  const sourcePath = join(context.fixtureDir, 'gif-source.mp4');
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${COLORS.coral.ffmpeg}:s=${context.outputWidth}x${context.outputHeight}:r=12:d=0.5`,
    '-f',
    'lavfi',
    '-i',
    `color=c=${COLORS.blue.ffmpeg}:s=${context.outputWidth}x${context.outputHeight}:r=12:d=0.5`,
    '-filter_complex',
    '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    sourcePath
  ]);
  const sourceStat = statSync(sourcePath);
  return buildProject({
    id: 'golden-gif-animation',
    name: 'Golden GIF Animation',
    width: context.outputWidth,
    height: context.outputHeight,
    media: [
      videoAsset({
        id: 'asset-gif-source',
        name: 'gif-source.mp4',
        path: sourcePath,
        duration: context.fixture.expectedDuration,
        width: context.outputWidth,
        height: context.outputHeight,
        hasAudio: false,
        stat: sourceStat
      })
    ],
    tracks: [
      {
        id: 'track-gif-video',
        type: 'video',
        name: 'GIF Video',
        clips: [
          videoClip({
            id: 'clip-gif-source',
            name: 'GIF source',
            mediaId: 'asset-gif-source',
            trackId: 'track-gif-video',
            duration: context.fixture.expectedDuration
          })
        ]
      },
      emptyAudioTrack(),
      emptyTextTrack()
    ]
  });
}

async function validateGifAnimationFixture(context) {
  const frameCount = await readVideoFrameCount(context.outputPath);
  return {
    checks: [
      {
        name: 'gif-two-pass-plan',
        passed:
          context.plan.passes?.length === 2 &&
          context.plan.passes[0].fullArgs.join(' ').includes('palettegen=stats_mode=diff') &&
          context.plan.passes[1].fullArgs.join(' ').includes('paletteuse=dither=sierra2_4a'),
        actual: context.plan.passes?.map((pass) => pass.name) ?? [],
        expected: 'gif-palettegen then gif-paletteuse'
      },
      {
        name: 'gif-frame-count',
        passed: frameCount > 0,
        actual: frameCount,
        expected: '> 0'
      }
    ]
  };
}

async function readDuration(videoPath) {
  const stdout = await runCollectStdout('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    videoPath
  ]);
  const duration = Number(stdout.toString('utf8').trim());
  if (!Number.isFinite(duration)) {
    throw new Error(`Unable to read golden export duration from ${videoPath}.`);
  }
  return duration;
}

async function readVideoFrameCount(videoPath) {
  const stdout = await runCollectStdout('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-count_frames',
    '-show_entries',
    'stream=nb_read_frames',
    '-of',
    'default=nw=1:nk=1',
    videoPath
  ]);
  const frameCount = Number(stdout.toString('utf8').trim());
  if (!Number.isFinite(frameCount)) {
    throw new Error(`Unable to read frame count from ${videoPath}.`);
  }
  return frameCount;
}

async function readStreamCount(videoPath, selector) {
  const stdout = await runCollectStdout('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    selector,
    '-show_entries',
    'stream=index',
    '-of',
    'csv=p=0',
    videoPath
  ]);
  return stdout
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

async function createColorVideoFixture(targetPath, options) {
  const args = [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${options.color}:s=${options.width}x${options.height}:r=30:d=${formatSeconds(options.duration)}`
  ];
  if (options.audio) {
    args.push(
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${options.frequency ?? 660}:sample_rate=44100:duration=${formatSeconds(options.duration)}`,
      '-shortest'
    );
  } else {
    args.push('-t', formatSeconds(options.duration));
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  if (options.audio) {
    args.push('-c:a', 'aac');
  }
  args.push('-movflags', '+faststart', targetPath);
  await runChecked('ffmpeg', args);
}

async function createPanoramaVideoFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${COLORS.darkBlue.ffmpeg}:s=${options.width}x${options.height}:r=30:d=${formatSeconds(options.duration)}`,
    '-vf',
    [
      `drawbox=x=${Math.round(options.width * 0.44)}:y=${Math.round(options.height * 0.39)}:w=${Math.round(options.width * 0.12)}:h=${Math.round(
        options.height * 0.22
      )}:color=${COLORS.green.ffmpeg}:t=fill`,
      `drawbox=x=${Math.round(options.width * 0.08)}:y=${Math.round(options.height * 0.2)}:w=${Math.round(options.width * 0.08)}:h=${Math.round(
        options.height * 0.18
      )}:color=${COLORS.coral.ffmpeg}:t=fill`,
      `drawbox=x=${Math.round(options.width * 0.78)}:y=${Math.round(options.height * 0.58)}:w=${Math.round(options.width * 0.08)}:h=${Math.round(
        options.height * 0.18
      )}:color=${COLORS.blue.ffmpeg}:t=fill`
    ].join(','),
    '-t',
    formatSeconds(options.duration),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    targetPath
  ]);
}

async function createTestPatternVideoFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=s=${options.width}x${options.height}:r=30:d=${formatSeconds(options.duration)}`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    targetPath
  ]);
}

async function createHardCutVideoFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${options.firstColor}:s=${options.width}x${options.height}:r=30:d=1`,
    '-f',
    'lavfi',
    '-i',
    `color=c=${options.secondColor}:s=${options.width}x${options.height}:r=30:d=1`,
    '-filter_complex',
    '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    targetPath
  ]);
}

async function detectSceneTimes(videoPath) {
  const output = await captureCombined('ffmpeg', [
    '-hide_banner',
    '-i',
    videoPath,
    '-vf',
    "select='gt(scene,0.3)',showinfo",
    '-an',
    '-f',
    'null',
    '-'
  ]);
  return parseShowinfoSceneTimes(output).filter((time) => time > 0.05 && time < 1.95);
}

function parseShowinfoSceneTimes(output) {
  return output
    .split(/\r?\n/)
    .flatMap((line) => {
      const marker = 'pts_time:';
      const start = line.indexOf(marker);
      if (start === -1) {
        return [];
      }
      const value = line.slice(start + marker.length).trim().split(/\s+/)[0];
      const parsed = Number(value);
      return Number.isFinite(parsed) ? [round(parsed)] : [];
    })
    .filter((time, index, times) => times.findIndex((candidate) => Math.abs(candidate - time) <= 0.001) === index);
}

async function createColorImageFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${options.color}:s=${options.width}x${options.height}`,
    '-frames:v',
    '1',
    '-update',
    '1',
    targetPath
  ]);
}

async function createPatternImageFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x243247:s=${options.width}x${options.height}`,
    '-vf',
    [
      'drawbox=x=360:y=270:w=160:h=180:color=0xd9553f:t=fill',
      'drawbox=x=595:y=300:w=90:h=120:color=0x2fd17e:t=fill',
      'drawbox=x=160:y=80:w=120:h=120:color=0xf7d84a:t=fill',
      'drawbox=x=1000:y=520:w=120:h=120:color=0xff4fd8:t=fill'
    ].join(','),
    '-frames:v',
    '1',
    '-update',
    '1',
    targetPath
  ]);
}

async function createAudioFixture(targetPath, options) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${options.frequency ?? 440}:sample_rate=44100:duration=${formatSeconds(options.duration)}`,
    '-c:a',
    'pcm_s16le',
    targetPath
  ]);
}

async function extractPreviewPng(videoPath, targetPath, width, height) {
  await runChecked('ffmpeg', [
    '-hide_banner',
    '-y',
    '-ss',
    '0.3',
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${width}:${height}`,
    '-update',
    '1',
    targetPath
  ]);
}

async function readPixel(videoPath, options) {
  const stdout = await runCollectStdout('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-ss',
    formatSeconds(options.at),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    `crop=1:1:${options.x}:${options.y},format=rgba`,
    '-f',
    'rawvideo',
    '-'
  ]);
  if (stdout.length < 4) {
    throw new Error(`Unable to read a pixel from ${videoPath}.`);
  }
  return Array.from(stdout.subarray(0, 4));
}

async function readChromaKeyAlpha(videoPath, options) {
  const stdout = await runCollectStdout('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    `chromakey=color=${options.color}:similarity=${formatSeconds(options.similarity)}:blend=${formatSeconds(options.blend)},format=rgba,crop=1:1:${options.x}:${options.y}`,
    '-f',
    'rawvideo',
    '-'
  ]);
  if (stdout.length < 4) {
    throw new Error(`Unable to read chroma key alpha from ${videoPath}.`);
  }
  return stdout[3];
}

async function readFrame(videoPath, options) {
  const stdout = await runCollectStdout('ffmpeg', [
    '-hide_banner',
    '-v',
    'error',
    '-ss',
    formatSeconds(options.at),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    `scale=${options.width}:${options.height},format=rgba`,
    '-f',
    'rawvideo',
    '-'
  ]);
  const expectedBytes = options.width * options.height * 4;
  if (stdout.length < expectedBytes) {
    throw new Error(`Unable to read a full frame from ${videoPath}.`);
  }
  return stdout;
}

function buildProject(input) {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    version: '0.2',
    id: input.id,
    name: input.name,
    createdAt: now,
    updatedAt: now,
    settings: { fps: 30, width: input.width, height: input.height },
    media: input.media,
    timeline: { tracks: input.tracks }
  };
}

function videoAsset(input) {
  return {
    id: input.id,
    type: 'video',
    name: input.name,
    path: normalizePath(input.path),
    duration: input.duration,
    width: input.width,
    height: input.height,
    size: input.stat.size,
    mtimeMs: input.stat.mtimeMs,
    hasAudio: input.hasAudio,
    audioChannels: input.hasAudio ? 1 : undefined,
    audioSampleRate: input.hasAudio ? 44100 : undefined,
    audioCodec: input.hasAudio ? 'aac' : undefined,
    proxyPath: input.proxyPath,
    proxyStatus: input.proxyStatus ?? 'none'
  };
}

function imageAsset(input) {
  return {
    id: input.id,
    type: 'image',
    name: input.name,
    path: normalizePath(input.path),
    duration: 0,
    width: input.width,
    height: input.height,
    size: input.stat.size,
    mtimeMs: input.stat.mtimeMs
  };
}

function audioAsset(input) {
  return {
    id: input.id,
    type: 'audio',
    name: input.name,
    path: normalizePath(input.path),
    duration: input.duration,
    width: 0,
    height: 0,
    size: input.stat.size,
    mtimeMs: input.stat.mtimeMs,
    hasAudio: true,
    audioChannels: 1,
    audioSampleRate: 44100,
    audioCodec: 'pcm_s16le'
  };
}

function videoClip(input) {
  return {
    id: input.id,
    type: 'video',
    name: input.name,
    mediaId: input.mediaId,
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: input.trimStart ?? 0,
    trimEnd: input.trimEnd ?? 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    chromaKey: input.chromaKey,
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    projection: input.projection,
    panorama: input.panorama,
    keyframes: input.keyframes,
    effects: input.effects,
    volume: input.volume ?? 1,
    muted: input.muted,
    fadeInDuration: input.fadeInDuration,
    fadeOutDuration: input.fadeOutDuration
  };
}

function imageClip(input) {
  return {
    id: input.id,
    type: 'image',
    name: input.name,
    mediaId: input.mediaId,
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: input.trimStart ?? 0,
    trimEnd: input.trimEnd ?? 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    chromaKey: input.chromaKey,
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: input.keyframes,
    kenBurns: input.kenBurns
  };
}

function audioClip(input) {
  return {
    id: input.id,
    type: 'audio',
    name: input.name,
    mediaId: input.mediaId,
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: input.trimStart ?? 0,
    trimEnd: input.trimEnd ?? 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: input.keyframes,
    volume: input.volume ?? 1,
    muted: input.muted,
    fadeInDuration: input.fadeInDuration,
    fadeOutDuration: input.fadeOutDuration
  };
}

function adjustmentClip(input) {
  return {
    id: input.id,
    type: 'adjustment',
    name: input.name,
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: input.trimStart ?? 0,
    trimEnd: input.trimEnd ?? 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: input.keyframes,
    effects: input.effects
  };
}

function textClip(input) {
  return {
    id: input.id,
    type: 'text',
    name: input.name ?? 'Text',
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: 0,
    trimEnd: 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: input.keyframes,
    text: input.text,
    style: input.style,
    pathText: input.pathText
  };
}

function subtitleClip(input) {
  return {
    id: input.id,
    type: 'subtitle',
    name: input.name ?? 'Subtitle',
    trackId: input.trackId,
    start: input.start ?? 0,
    duration: input.duration,
    trimStart: 0,
    trimEnd: 0,
    speed: input.speed ?? 1,
    colorCorrection: input.colorCorrection ?? { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
    transform: input.transform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    text: input.text,
    style: input.style ?? {
      fontSize: 42,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.55,
      fontFamily: 'Arial',
      bold: true,
      italic: false,
      yOffset: 72
    },
    subtitleMode: input.subtitleMode ?? 'burn-in'
  };
}

function emptyAudioTrack() {
  return { id: 'track-audio', type: 'audio', name: 'Audio', clips: [] };
}

function emptyTextTrack() {
  return { id: 'track-text', type: 'text', name: 'Text', clips: [] };
}

async function materializeTextArtifacts(plan, textDir) {
  if (plan.textArtifacts.length === 0) {
    return {
      fullArgs: plan.fullArgs,
      passes: plan.passes ?? []
    };
  }
  mkdirSync(textDir, { recursive: true });
  let args = [...plan.fullArgs];
  const passes = (plan.passes ?? []).map((pass) => ({ ...pass, fullArgs: [...pass.fullArgs] }));
  for (const artifact of plan.textArtifacts) {
    const safeName = artifact.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const artifactPath = join(textDir, safeName);
    let replacement;
    if (artifact.pathMode === 'shader-sequence') {
      replacement = await materializeCustomShaderSequenceArtifact(artifact, textDir, safeName);
    } else if (artifact.pathMode === 'path-text-sequence') {
      replacement = await materializePathTextSequenceArtifact(artifact, textDir, safeName);
    } else {
      writeFileSync(artifactPath, artifact.text);
      replacement = artifact.pathMode === 'argument' ? normalizePath(artifactPath) : escapeDrawtextPath(normalizePath(artifactPath));
    }
    args = args.map((arg) => arg.split(artifact.placeholder).join(replacement));
    for (const pass of passes) {
      pass.fullArgs = pass.fullArgs.map((arg) => arg.split(artifact.placeholder).join(replacement));
    }
  }
  return {
    fullArgs: args,
    passes
  };
}

async function materializeCustomShaderSequenceArtifact(artifact, textDir, safeName) {
  const manifest = JSON.parse(artifact.text);
  if (manifest.kind !== 'custom-shader-sequence') {
    throw new Error(`Unsupported custom shader artifact kind: ${manifest.kind}`);
  }
  const sequenceDir = join(textDir, safeName.replace(/\.json$/i, ''));
  mkdirSync(sequenceDir, { recursive: true });
  const framePattern = join(sequenceDir, 'frame%04d.png');
  const args = ['-hide_banner', '-y'];
  if (manifest.clipType === 'image') {
    args.push('-loop', '1', '-t', formatSeconds(manifest.duration));
  } else {
    args.push('-ss', formatSeconds(manifest.trimStart), '-t', formatSeconds(manifest.sourceDuration));
  }
  args.push(
    '-i',
    manifest.mediaPath,
    '-vf',
    buildCustomShaderBakeFilter(manifest),
    '-frames:v',
    String(Math.max(1, Math.round(manifest.frameCount ?? 1))),
    '-start_number',
    '1',
    '-f',
    'image2',
    framePattern
  );
  await runChecked('ffmpeg', args);
  return normalizePath(framePattern);
}

async function materializePathTextSequenceArtifact(artifact, textDir, safeName) {
  const manifest = JSON.parse(artifact.text);
  if (manifest.kind !== 'path-text-sequence') {
    throw new Error(`Unsupported path text artifact kind: ${manifest.kind}`);
  }
  const sequenceDir = join(textDir, safeName.replace(/\.json$/i, ''));
  mkdirSync(sequenceDir, { recursive: true });
  const framePattern = join(sequenceDir, 'frame%04d.png');
  const frameCount = Math.max(1, Math.round(manifest.frameCount ?? 1));
  for (let index = 0; index < frameCount; index += 1) {
    const frame = manifest.frames?.[index] ?? { chars: [] };
    const framePath = join(sequenceDir, `frame${String(index + 1).padStart(4, '0')}.png`);
    await runChecked('ffmpeg', [
      '-hide_banner',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=black@0:s=${Math.max(1, Math.round(manifest.width))}x${Math.max(1, Math.round(manifest.height))}:d=${formatSeconds(1 / Math.max(1, manifest.fps ?? 30))}`,
      '-vf',
      buildPathTextFrameFilter(manifest, frame),
      '-frames:v',
      '1',
      '-f',
      'image2',
      framePath
    ]);
  }
  return normalizePath(framePattern);
}

function buildCustomShaderBakeFilter(manifest) {
  const width = Math.max(1, Math.round(manifest.width));
  const height = Math.max(1, Math.round(manifest.height));
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1'
  ];
  if (manifest.clipType !== 'image' && Math.abs((manifest.speed ?? 1) - 1) > 0.001) {
    filters.push(`setpts=(PTS-STARTPTS)/${formatSeconds(manifest.speed)}`);
  }
  filters.push(customShaderEquivalentFilter(manifest));
  filters.push(`fps=${formatSeconds(manifest.fps ?? 30)}`, 'format=rgba');
  return filters.join(',');
}

function buildPathTextFrameFilter(manifest, frame) {
  const fontSize = Math.max(1, Number(manifest.fontSize ?? 48));
  const fontFile = manifest.fontPath ? `:fontfile=${escapeDrawtextPath(manifest.fontPath)}` : '';
  const fontColor = cssColorToFfmpeg(manifest.fontColor ?? '#ffffff');
  const filters = ['format=rgba'];
  for (const item of frame.chars ?? []) {
    if (!item.char) {
      continue;
    }
    filters.push(
      `drawtext=text='${escapeDrawtextText(item.char)}'${fontFile}:fontsize=${formatSeconds(fontSize)}:fontcolor=${fontColor}:x='${formatSeconds(item.x)}-text_w/2':y='${formatSeconds(item.y)}-${formatSeconds(
        fontSize / 2
      )}'`
    );
  }
  return filters.join(',');
}

function cssColorToFfmpeg(value) {
  const text = String(value ?? '').trim();
  const hex = text.startsWith('#') ? text.slice(1) : '';
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `0x${hex.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `0x${hex
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase()}`;
  }
  return 'white';
}

function customShaderEquivalentFilter(manifest) {
  if (manifest.preset === 'pixelate') {
    const width = Math.max(1, Math.round(manifest.width));
    const height = Math.max(1, Math.round(manifest.height));
    const lowWidth = Math.max(1, Math.floor(width / 18));
    const lowHeight = Math.max(1, Math.floor(height / 18));
    return `scale=${lowWidth}:${lowHeight}:flags=neighbor,scale=${width}:${height}:flags=neighbor`;
  }
  if (manifest.preset === 'posterize') {
    return "lutrgb=r='floor(val/52)*52':g='floor(val/52)*52':b='floor(val/52)*52'";
  }
  if (manifest.preset === 'old-film') {
    return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,noise=alls=8:allf=t';
  }
  return 'null';
}

async function runMaterializedPlan(plan) {
  if (plan.passes.length === 0) {
    await runChecked('ffmpeg', plan.fullArgs);
    return;
  }
  for (const pass of plan.passes) {
    await runChecked('ffmpeg', pass.fullArgs);
  }
}

function countDifferentPixels(frame, expectedRgb, threshold) {
  let count = 0;
  for (let offset = 0; offset + 3 < frame.length; offset += 4) {
    const delta =
      Math.abs(frame[offset] - expectedRgb[0]) +
      Math.abs(frame[offset + 1] - expectedRgb[1]) +
      Math.abs(frame[offset + 2] - expectedRgb[2]);
    if (frame[offset + 3] > 200 && delta > threshold) {
      count += 1;
    }
  }
  return count;
}

function countNearPixels(frame, expectedRgb, threshold) {
  let count = 0;
  for (let offset = 0; offset + 3 < frame.length; offset += 4) {
    const delta =
      Math.abs(frame[offset] - expectedRgb[0]) +
      Math.abs(frame[offset + 1] - expectedRgb[1]) +
      Math.abs(frame[offset + 2] - expectedRgb[2]);
    if (frame[offset + 3] > 200 && delta <= threshold) {
      count += 1;
    }
  }
  return count;
}

function countPixelatedBlocks(frame, frameWidth, frameHeight, blockSize, tolerance) {
  let count = 0;
  for (let y = blockSize; y + blockSize < frameHeight; y += blockSize) {
    for (let x = blockSize; x + blockSize < frameWidth; x += blockSize) {
      const first = readFrameRgb(frame, frameWidth, x + 2, y + 2);
      const second = readFrameRgb(frame, frameWidth, x + blockSize - 3, y + blockSize - 3);
      if (rgbDelta(first, second) <= tolerance) {
        count += 1;
      }
    }
  }
  return count;
}

function readFrameRgb(frame, frameWidth, x, y) {
  const offset = (y * frameWidth + x) * 4;
  return [frame[offset], frame[offset + 1], frame[offset + 2]];
}

function averageRegion(frame, frameWidth, frameHeight, region) {
  const halfWidth = Math.floor(region.width / 2);
  const halfHeight = Math.floor(region.height / 2);
  const startX = Math.max(0, region.centerX - halfWidth);
  const endX = Math.min(frameWidth - 1, region.centerX + halfWidth);
  const startY = Math.max(0, region.centerY - halfHeight);
  const endY = Math.min(frameHeight - 1, region.centerY + halfHeight);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const offset = (y * frameWidth + x) * 4;
      if (frame[offset + 3] <= 200) {
        continue;
      }
      red += frame[offset];
      green += frame[offset + 1];
      blue += frame[offset + 2];
      count += 1;
    }
  }
  if (count === 0) {
    return [0, 0, 0];
  }
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)];
}

function rgbDelta(left, right) {
  return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]);
}

function solidFrameSample(rgb) {
  const width = 8;
  const height = 8;
  return {
    width,
    height,
    data: Array.from({ length: width * height }, () => [rgb[0], rgb[1], rgb[2], 255]).flat()
  };
}

function meanRgb(frame) {
  const sums = [0, 0, 0];
  let count = 0;
  for (let offset = 0; offset + 3 < frame.length; offset += 4) {
    if (frame[offset + 3] <= 200) {
      continue;
    }
    sums[0] += frame[offset];
    sums[1] += frame[offset + 1];
    sums[2] += frame[offset + 2];
    count += 1;
  }
  if (count === 0) {
    return [0, 0, 0];
  }
  return sums.map((sum) => round(sum / count));
}

function countPixels(frame, predicate) {
  let count = 0;
  for (let offset = 0; offset + 3 < frame.length; offset += 4) {
    if (predicate(frame[offset], frame[offset + 1], frame[offset + 2], frame[offset + 3])) {
      count += 1;
    }
  }
  return count;
}

function pixelNear(pixel, expectedRgb, tolerance) {
  if (!pixel || pixel.length < 4 || pixel[3] < 200) {
    return false;
  }
  return expectedRgb.every((channel, index) => Math.abs(pixel[index] - channel) <= tolerance);
}

function escapeDrawtextPath(path) {
  return path.replace(/\\/g, '/').replace(/:/g, '\\\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

function escapeDrawtextText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/,/g, '\\,');
}

function formatSeconds(value) {
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/g, '').replace(/\.$/g, '');
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

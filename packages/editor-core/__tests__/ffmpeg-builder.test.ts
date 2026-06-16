import { describe, expect, it } from 'vitest';
import {
  buildAtempoFilters,
  appendExportRangeSequence,
  buildExportProjectFromProject,
  buildFfmpegCurrentFrameExportPlan,
  buildFfmpegExportPlan,
  buildFfmpegPreviewSamplePlans,
  calculateExportPreviewSampleTimes,
  calculateSplitLayoutTransforms,
  calculateWatermarkOverlayPosition,
  BUILT_IN_SPLIT_LAYOUTS,
  createMulticamSequenceProject,
  createNestedSequenceClip,
  createSequence,
  createTrack,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  DEFAULT_CUSTOM_SHADER_SOURCE,
  exportRenderRangeFromPoints,
  type Clip,
  type Project
} from '../src';
import { makeAdjustmentClip, makeAudioClip, makeCreditsClip, makeProject, makeSubtitleClip, makeTextClip, makeVideoClip } from './test-utils';

function makeAudioVisualizationProject(): Project {
  const project = makeProject();
  project.media = [
    {
      id: 'asset-audio',
      type: 'audio',
      name: 'voice.wav',
      path: 'D:\\Media\\voice.wav',
      duration: 2,
      width: 0,
      height: 0,
      audioChannels: 2,
      audioSampleRate: 44100
    }
  ];
  project.timeline.tracks[0].clips = [];
  project.timeline.tracks[1].clips = [makeAudioClip({ id: 'clip-audio-viz', mediaId: 'asset-audio', duration: 2 })];
  project.timeline.tracks[2].clips = [];
  return project;
}

describe('multitrack ffmpeg builder', () => {
  it('injects frame-aligned range seek and duration args for single range export', () => {
    const project = makeProject();
    project.settings.fps = 30;
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4', settings: { fps: 30 } }), undefined, 0, [], {
      exportRange: { start: 1.011, duration: 2.041 }
    });

    const ssIndex = plan.outputArgs.indexOf('-ss');
    const tIndex = plan.outputArgs.indexOf('-t');
    expect(plan.outputArgs.slice(ssIndex, ssIndex + 2)).toEqual(['-ss', '1']);
    expect(plan.outputArgs.slice(tIndex, tIndex + 2)).toEqual(['-t', '2.033']);
    expect(plan.duration).toBeCloseTo(61 / 30, 6);
  });

  it('adds numeric suffixes before extensions for multi-range export filenames', () => {
    expect(appendExportRangeSequence('C:/Exports/movie.mp4', 1, 12)).toBe('C:/Exports/movie-01.mp4');
    expect(appendExportRangeSequence('C:/Exports/movie.mp4', 12, 12)).toBe('C:/Exports/movie-12.mp4');
    expect(appendExportRangeSequence('C:/Exports/movie', 3, 9)).toBe('C:/Exports/movie-03');
  });

  it('normalizes in/out export points to a frame-aligned render range', () => {
    expect(exportRenderRangeFromPoints(undefined, 4, 10, 30)).toBeNull();
    expect(exportRenderRangeFromPoints(4.019, 1.011, 10, 30, { id: 'range-a', label: 'A roll' })).toEqual({
      id: 'range-a',
      label: 'A roll',
      start: 1,
      duration: 3
    });
  });

  it('skips color management filters for default sRGB export settings', () => {
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('colorspace=');
    expect(plan.filterComplex).not.toContain('iccgen=');
    expect(plan.outputArgs).toContain('+faststart');
    expect(plan.outputArgs).not.toContain('+faststart+prefer_icc');
  });

  it('carries normalized post-export script settings in the export plan', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          postExportScript: { command: ' echo "{output}" ' }
        }
      })
    );

    expect(plan.postExportScript).toEqual({ command: 'echo "{output}"' });
  });

  it('carries normalized export settings for post-export quality checks', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          width: 1280,
          height: 720,
          fps: 60
        }
      })
    );

    expect(plan.settings).toMatchObject({ width: 1280, height: 720, fps: 60 });
  });

  it('adds colorspace conversion and ICC generation for non-default output color spaces', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          colorManagement: {
            inputColorSpace: 'srgb',
            outputColorSpace: 'dci-p3',
            embedIccProfile: true
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('colorspace=ispace=bt709:iprimaries=bt709:itrc=iec61966-2-1:space=bt709:primaries=smpte432:trc=bt709');
    expect(plan.filterComplex).toContain('iccgen=force=1:color_primaries=smpte432:color_trc=bt709');
    expect(plan.outputArgs).toContain('+faststart+prefer_icc');
  });

  it('chains ACES ODT zscale filters with colorspace and ICC generation from project settings', () => {
    const project = makeProject();
    project.settings = { ...project.settings, colorPipeline: 'aces' };

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('zscale=matrixin=bt709:transferin=linear:primariesin=bt709');
    expect(plan.filterComplex).toContain('zscale=matrix=bt709:transfer=bt709:primaries=bt709');
    expect(plan.filterComplex).toContain('colorspace=ispace=bt2020nc:iprimaries=bt2020:itrc=bt2020-10:space=bt709:primaries=bt709:trc=bt709');
    expect(plan.filterComplex).toContain('iccgen=force=1:color_primaries=bt709:color_trc=bt709');
  });

  it('keeps empty split-screen cells black by compositing over a black base', () => {
    const project = makeProject();
    const [layoutTransform] = calculateSplitLayoutTransforms({
      layout: BUILT_IN_SPLIT_LAYOUTS['side-by-side'],
      canvasWidth: project.settings.width,
      canvasHeight: project.settings.height,
      clips: [{ clipId: 'clip-video', sourceWidth: project.settings.width, sourceHeight: project.settings.height }]
    });
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-video', duration: 2, transform: layoutTransform.transform })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('color=c=black');
    expect(plan.filterComplex).toContain('overlay=');
    expect(plan.filterComplex).toContain('(main_w-overlay_w)/2-320');
  });

  it('skips blend filters for normal clip compositing', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-normal', duration: 2, blendMode: 'normal' })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('overlay=');
    expect(plan.filterComplex).not.toContain('blend=all_mode');
  });

  it('builds an alpha-aware FFmpeg blend graph for non-normal clip compositing', () => {
    const project = makeProject();
    project.timeline.tracks = [
      createTrack({ id: 'track-base', type: 'video', name: 'Base', clips: [makeVideoClip({ id: 'clip-base', trackId: 'track-base', duration: 2 })] }),
      createTrack({
        id: 'track-top',
        type: 'video',
        name: 'Top',
        clips: [makeVideoClip({ id: 'clip-top', trackId: 'track-top', start: 0, duration: 2, blendMode: 'overlay', transform: { x: 16, y: -8, opacity: 0.6 } })]
      }),
      createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
      createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('color=c=black@0.0');
    expect(plan.filterComplex).toContain("overlay=x='(main_w-overlay_w)/2+16'");
    expect(plan.filterComplex).toContain("eval=frame:enable='between(t,0,2)',format=rgba");
    expect(plan.filterComplex).toContain('split=2');
    expect(plan.filterComplex).toContain('alphaextract');
    expect(plan.filterComplex).toContain('format=rgba[');
    expect(plan.filterComplex).toContain('blend=all_mode=overlay:all_opacity=1,format=rgba');
    expect(plan.filterComplex).toContain('alphamerge,format=rgba');
  });

  it('builds per-clip overlay, drawtext textfile, and amix filters as argument arrays', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-audio',
      type: 'audio',
      name: 'voice.wav',
      path: 'D:\\Media\\voice.wav',
      duration: 4,
      width: 0,
      height: 0,
      audioChannels: 2,
      audioSampleRate: 44100
    });
    const audioClip: Clip = {
      id: 'clip-audio',
      type: 'audio',
      name: 'voice.wav',
      mediaId: 'asset-audio',
      trackId: 'track-audio',
      start: 1,
      duration: 4,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      volume: 0.5,
      fadeInDuration: 0.5,
      fadeOutDuration: 0.75
    };
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-video', duration: 5 })];
    project.timeline.tracks[1].clips = [audioClip];
    project.timeline.tracks[2].clips = [makeTextClip({ id: 'clip-text', start: 1, duration: 3, text: 'Hello: world' })];

    const exportProject = buildExportProjectFromProject(project, { outputPath: 'D:\\Exports\\out.mp4', defaultFontPath: 'C:/Windows/Fonts/msyh.ttc' });
    const plan = buildFfmpegExportPlan(exportProject);

    expect(plan.fullArgs[0]).toBe('-y');
    expect(plan.fullArgs.slice(1, 4)).toEqual(['-progress', 'pipe:2', '-nostats']);
    expect(plan.fullArgs).toContain('-filter_complex');
    expect(plan.fullArgs.join(' ')).not.toContain('cmd /C');
    expect(plan.filterComplex).toContain('color=c=black');
    expect(plan.filterComplex).toContain('overlay=');
    expect(plan.filterComplex).toContain("enable='between(t,1,4)'");
    expect(plan.filterComplex).toContain('drawtext=textfile=__TEXTFILE_clip_text__');
    expect(plan.filterComplex).toContain('fontcolor=0xffffff');
    expect(plan.filterComplex).toContain('box=1:boxcolor=0x000000@0');
    expect(plan.filterComplex).toContain('trim=duration=5');
    expect(plan.filterComplex).toContain('adelay=1000:all=1');
    expect(plan.filterComplex).toContain('[0:a:0]atrim=start=0:duration=5');
    expect(plan.filterComplex).toContain('afade=t=in:st=0:d=0.5');
    expect(plan.filterComplex).toContain('afade=t=out:st=3.25:d=0.75');
    expect(plan.filterComplex).toContain('amix=inputs=2');
    expect(plan.textArtifacts).toEqual([
      expect.objectContaining({ clipId: 'clip-text', text: 'Hello: world', placeholder: '__TEXTFILE_clip_text__' })
    ]);
    expect(plan.fullArgs.at(-1)).toBe('D:/Exports/out.mp4');
    expect(plan.outputArgs).toContain('-t');
    expect(plan.outputArgs).toContain('5');
  });

  it('skips spatial audio filters for default clip position', () => {
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('pan=stereo|c0=');
    expect(plan.filterComplex).not.toContain("volume='if(");
  });

  it('maps spatial audio x position to an FFmpeg pan filter', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-spatial-left',
        duration: 2,
        spatialAudio: { x: -1, y: 0, z: 0, distance: 'medium' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('pan=stereo|c0=1*c0|c1=0*c1');
  });

  it('builds spatial audio keyframe filter expressions for moving sources', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-spatial-motion',
        duration: 2,
        spatialAudio: { x: 0, y: 0, z: 0, distance: 'far' },
        keyframes: {
          spatialX: [
            { id: 'spatial-x-a', time: 0, value: -1, easing: 'linear' },
            { id: 'spatial-x-b', time: 2, value: 1, easing: 'linear' }
          ],
          spatialY: [
            { id: 'spatial-y-a', time: 0, value: 0, easing: 'linear' },
            { id: 'spatial-y-b', time: 2, value: 1, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("pan=stereo|c0='if(");
    expect(plan.filterComplex).toContain("volume='if(");
    expect(plan.filterComplex).toContain(':eval=frame');
  });

  it('builds YouTube loudness normalization as a two-pass loudnorm plan', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loud.mp4',
        settings: { loudnessNormalization: 'youtube' }
      })
    );

    expect(plan.passes).toHaveLength(2);
    expect(plan.passes?.[0]).toMatchObject({ name: 'loudness-analysis', kind: 'loudness-analysis' });
    expect(plan.passes?.[1]).toMatchObject({ name: 'loudness-render', kind: 'render' });
    expect(plan.passes?.[0].fullArgs.join(' ')).toContain('loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json');
    expect(plan.passes?.[0].fullArgs).toEqual(expect.arrayContaining(['-map', '[aout]', '-f', 'null', '-']));
    expect(plan.filterComplex).toContain('loudnorm=I=-14:TP=-1.5:LRA=11');
    expect(plan.filterComplex).toContain('measured_I=__LOUDNORM_MEASURED_I__');
    expect(plan.filterComplex).toContain('linear=true');
    expect(plan.fullArgs.at(-1)).toBe('D:/Exports/loud.mp4');
  });

  it('does not generate master processing filters when all master modules are off', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: { masterProcessing: DEFAULT_EXPORT_MASTER_PROCESSING }
      })
    );

    expect(plan.filterComplex).not.toContain('extrastereo=');
    expect(plan.filterComplex).not.toContain('alimiter=');
    expect(plan.filterComplex).not.toContain('equalizer=f=31');
  });

  it('chains master EQ, stereo enhancer, limiter, and loudness normalization in order', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          loudnessNormalization: 'youtube',
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            eq: {
              enabled: true,
              bands: DEFAULT_EXPORT_MASTER_PROCESSING.eq.bands.map((band, index) => ({ ...band, gain: index === 0 ? 3 : 0 }))
            },
            stereoEnhancer: { enabled: true, amount: 1.4 },
            limiter: { enabled: true, levelOutDb: -0.1 }
          }
        }
      })
    );

    const masterChain = '[amixpremaster]equalizer=f=31:width_type=o:width=0.7:g=3,extrastereo=m=1.4,alimiter=level_out=-0.1dB[apremaster]';
    expect(plan.filterComplex).toContain(masterChain);
    expect(plan.filterComplex.indexOf(masterChain)).toBeLessThan(plan.filterComplex.indexOf('[apremaster]loudnorm=I=-14'));
    expect(plan.passes?.[0].fullArgs.join(' ')).toContain(masterChain);
    expect(plan.passes?.[0].fullArgs.join(' ')).toContain('[apremaster]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[aout]');
  });

  it('adds stereo enhancer args without loudness normalization', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            stereoEnhancer: { enabled: true, amount: 0.75 }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('[amixpremaster]extrastereo=m=0.75[aout]');
    expect(plan.filterComplex).not.toContain('loudnorm=');
  });

  it('adds limiter args without loudness normalization', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            limiter: { enabled: true, levelOutDb: -0.1 }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('[amixpremaster]alimiter=level_out=-0.1dB[aout]');
    expect(plan.filterComplex).not.toContain('loudnorm=');
  });

  it('ignores master EQ band gains while master EQ is disabled', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            eq: {
              enabled: false,
              bands: DEFAULT_EXPORT_MASTER_PROCESSING.eq.bands.map((band, index) => ({ ...band, gain: index === 0 ? 6 : 0 }))
            }
          }
        }
      })
    );

    expect(plan.filterComplex).not.toContain('equalizer=');
    expect(plan.filterComplex).not.toContain('g=6');
  });

  it('builds enabled master EQ bands in band order and skips neutral bands', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            eq: {
              enabled: true,
              bands: DEFAULT_EXPORT_MASTER_PROCESSING.eq.bands.map((band, index) => ({ ...band, gain: index === 0 ? -3 : index === 2 ? 2.5 : 0 }))
            }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('[amixpremaster]equalizer=f=31:width_type=o:width=0.7:g=-3,equalizer=f=125:width_type=o:width=1:g=2.5[aout]');
    expect(plan.filterComplex).not.toContain('equalizer=f=63');
  });

  it('keeps EBU loudness normalization after the master limiter', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          loudnessNormalization: 'ebu-r128',
          masterProcessing: {
            ...DEFAULT_EXPORT_MASTER_PROCESSING,
            limiter: { enabled: true, levelOutDb: -1 }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('[amixpremaster]alimiter=level_out=-1dB[apremaster]');
    expect(plan.filterComplex.indexOf('alimiter=level_out=-1dB')).toBeLessThan(plan.filterComplex.indexOf('[apremaster]loudnorm=I=-23'));
  });

  it('clamps master processing values before building filters', () => {
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(makeProject(), {
        outputPath: 'out.mp4',
        settings: {
          masterProcessing: {
            eq: {
              enabled: true,
              bands: DEFAULT_EXPORT_MASTER_PROCESSING.eq.bands.map((band, index) =>
                index === 0 ? { ...band, frequency: 1, gain: 99, q: 9 } : band
              )
            },
            stereoEnhancer: { enabled: true, amount: 9 },
            limiter: { enabled: true, levelOutDb: -99 }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('equalizer=f=20:width_type=o:width=4:g=24');
    expect(plan.filterComplex).toContain('extrastereo=m=2');
    expect(plan.filterComplex).toContain('alimiter=level_out=-24dB');
  });

  it('exports enabled path text clips through a baked image sequence overlay artifact', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-background', duration: 2 })];
    project.timeline.tracks[2].clips = [
      makeTextClip({
        id: 'clip-path-text',
        text: 'ARC',
        duration: 2,
        style: { fontSize: 64, color: '#ff4fd8' },
        pathText: {
          enabled: true,
          path: [
            { x: 0.2, y: 0.6, handleOut: { x: 0.35, y: 0.3 } },
            { x: 0.8, y: 0.6, handleIn: { x: 0.65, y: 0.3 } }
          ],
          startOffset: 0.1,
          letterSpacing: 8,
          rotateCharacters: true
        },
        keyframes: {
          pathStartOffset: [
            { id: 'path-start', time: 0, value: 0.1, easing: 'linear' },
            { id: 'path-end', time: 2, value: 0.4, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs.some((input) => input.path.includes('__PATH_TEXT_SEQUENCE_clip_path_text__'))).toBe(true);
    expect(plan.fullArgs.join(' ')).toContain('__PATH_TEXT_SEQUENCE_clip_path_text__');
    expect(plan.filterComplex).toContain('pathtextsrc_clip_path_text');
    expect(plan.filterComplex).toContain('overlay=x=0:y=0');
    expect(plan.filterComplex).not.toContain('drawtext=textfile=__TEXTFILE_clip_path_text__');
    expect(plan.textArtifacts).toEqual([
      expect.objectContaining({
        clipId: 'clip-path-text:path-text',
        fileName: 'path-text-clip_path_text.json',
        pathMode: 'path-text-sequence'
      })
    ]);
    const manifest = JSON.parse(plan.textArtifacts[0].text) as { kind: string; frameCount: number; frames: Array<{ chars: unknown[] }> };
    expect(manifest.kind).toBe('path-text-sequence');
    expect(manifest.frameCount).toBe(60);
    expect(manifest.frames[0].chars.length).toBeGreaterThan(0);
  });

  it('builds EBU R128 loudness normalization with the broadcast target', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\ebu.mp4',
        settings: { loudnessNormalization: 'ebu-r128' }
      })
    );

    expect(plan.passes?.[0].fullArgs.join(' ')).toContain('loudnorm=I=-23:print_format=json');
    expect(plan.filterComplex).toContain('loudnorm=I=-23:measured_I=__LOUDNORM_MEASURED_I__');
    expect(plan.filterComplex).not.toContain('TP=-1.5');
  });

  it.each([
    [
      'YouTube 1080p',
      { width: 1920, height: 1080, fps: 30, videoBitrate: '8M', scaleMode: 'fit', platformPreset: 'youtube-1080p' },
      ['-b:v', '8M', '-pix_fmt', 'yuv420p', '-r', '30'],
      ['scale=1920:1080:force_original_aspect_ratio=decrease', 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black']
    ],
    [
      'YouTube Shorts',
      { width: 1080, height: 1920, fps: 60, videoBitrate: '8M', scaleMode: 'fit', platformPreset: 'youtube-shorts' },
      ['-b:v', '8M', '-pix_fmt', 'yuv420p', '-r', '60'],
      ['scale=1080:1920:force_original_aspect_ratio=decrease', 'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black']
    ],
    [
      'Instagram Reels',
      { width: 1080, height: 1920, fps: 30, videoBitrate: '3500k', scaleMode: 'fit', platformPreset: 'instagram-reels' },
      ['-b:v', '3500k', '-pix_fmt', 'yuv420p', '-r', '30'],
      ['scale=1080:1920:force_original_aspect_ratio=decrease', 'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black']
    ],
    [
      'Twitter/X',
      { width: 1280, height: 720, fps: 30, videoBitrate: '5M', scaleMode: 'fit', platformPreset: 'twitter-x' },
      ['-b:v', '5M', '-pix_fmt', 'yuv420p', '-r', '30'],
      ['scale=1280:720:force_original_aspect_ratio=decrease', 'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black']
    ],
    [
      'Bilibili',
      { width: 1920, height: 1080, fps: 60, videoBitrate: '10M', scaleMode: 'fit', platformPreset: 'bilibili', videoProfile: 'high' },
      ['-b:v', '10M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '60'],
      ['scale=1920:1080:force_original_aspect_ratio=decrease', 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black']
    ]
  ] as const)('builds %s platform export args', (_name, settings, expectedOutputArgs, expectedFilters) => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4', settings }));

    expect(plan.outputArgs).toEqual(expect.arrayContaining([...expectedOutputArgs]));
    for (const expectedFilter of expectedFilters) {
      expect(plan.filterComplex).toContain(expectedFilter);
    }
  });

  it('builds TikTok preset args with -14 LUFS loudness normalization', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { width: 1080, height: 1920, fps: 60, videoBitrate: '6M', scaleMode: 'fit', loudnessNormalization: 'youtube', platformPreset: 'tiktok' }
      })
    );

    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-b:v', '6M', '-pix_fmt', 'yuv420p', '-r', '60']));
    expect(plan.filterComplex).toContain('scale=1080:1920:force_original_aspect_ratio=decrease');
    expect(plan.filterComplex).toContain('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black');
    expect(plan.filterComplex).toContain('loudnorm=I=-14:TP=-1.5:LRA=11');
    expect(plan.passes?.map((pass) => pass.kind)).toEqual(['loudness-analysis', 'render']);
  });

  it('skips v360 and spherical metadata for default flat clips', () => {
    const project = makeProject();

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('v360=');
    expect(plan.outputArgs).not.toContain('-metadata:s:v:0');
    expect(plan.outputArgs).not.toContain('spherical=true');
  });

  it('builds v360 extraction args and spherical metadata for equirectangular clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-360',
        projection: 'equirectangular',
        panorama: { yaw: 32.5, pitch: -12, roll: 4, fov: 80, outputProjection: 'flat' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('v360=e:flat:yaw=32.5:pitch=-12:roll=4:v_fov=80');
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-metadata:s:v:0', 'spherical=true']));
  });

  it('injects spherical metadata without v360 when keeping equirectangular output', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-360-eq',
        projection: 'equirectangular',
        panorama: { yaw: 15, pitch: 5, roll: 0, fov: 90, outputProjection: 'equirectangular' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('v360=');
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-metadata:s:v:0', 'spherical=true']));
  });

  it('converts cubemap clips to equirectangular output when requested', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-cubemap',
        projection: 'cubemap',
        panorama: { yaw: 0, pitch: 0, roll: 0, fov: 100, outputProjection: 'equirectangular' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('v360=c3x2:e:yaw=0:pitch=0:roll=0:v_fov=100');
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-metadata:s:v:0', 'spherical=true']));
  });

  it('skips loudness normalization for animated image exports', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loop.gif',
        settings: { format: 'gif', videoCodec: 'gif', loudnessNormalization: 'youtube' }
      })
    );

    expect(plan.filterComplex).not.toContain('loudnorm=');
    expect(plan.passes?.map((pass) => pass.kind)).not.toContain('loudness-analysis');
  });

  it('skips text with a warning when drawtext is unavailable', () => {
    const project = makeProject();
    project.timeline.tracks[2].clips = [makeTextClip({ id: 'clip-text' })];
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: false,
      hasLibfreetype: false,
      hardwareEncoderAvailable: false,
      hardwareEncoder: null,
      drawtextWarning: 'drawtext missing'
    });

    expect(plan.textArtifacts).toHaveLength(0);
    expect(plan.warnings).toContain('drawtext missing');
  });

  it('uses NVENC hardware encoding args when requested and detected', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { hardwareEncoding: true }
      }),
      {
        available: true,
        version: 'ffmpeg',
        hasLibx264: true,
        hasAac: true,
        hasDrawtext: true,
        hasLibfreetype: true,
        hardwareEncoderAvailable: true,
        hardwareEncoder: 'h264_nvenc',
        drawtextWarning: null
      }
    );

    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', '23']));
    expect(plan.outputArgs).not.toContain('-b:v');
    expect(plan.warnings).not.toContain(expect.stringContaining('Hardware video encoding'));
  });

  it('falls back to software encoding with a warning when hardware encoding is unavailable', () => {
    const project = makeProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { hardwareEncoding: true, videoBitrate: '8M' }
      }),
      {
        available: true,
        version: 'ffmpeg',
        hasLibx264: true,
        hasAac: true,
        hasDrawtext: true,
        hasLibfreetype: true,
        hardwareEncoderAvailable: false,
        hardwareEncoder: null,
        drawtextWarning: null
      }
    );

    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-b:v', '8M']));
    expect(plan.warnings).toContain('Hardware video encoding was requested but no supported H.264 hardware encoder was detected. Falling back to software encoding.');
  });

  it('exports text-only timelines over a black base with silent audio', () => {
    const project = makeProject();
    project.media = [];
    project.timeline.tracks[0].clips = [];
    project.timeline.tracks[2].clips = [makeTextClip({ id: 'clip-text-only', start: 0, duration: 2 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(0);
    expect(plan.filterComplex).toContain('color=c=black');
    expect(plan.filterComplex).toContain('anullsrc');
    expect(plan.textArtifacts).toHaveLength(1);
  });

  it('exports credits roll clips as drawtext textfile overlays', () => {
    const project = makeProject();
    project.media = [];
    project.timeline.tracks[0].clips = [];
    project.timeline.tracks[2].clips = [
      makeCreditsClip({
        id: 'clip-credits',
        start: 0,
        duration: 4,
        text: '导演 | 林青\n演员 | Ada',
        rollSpeed: 120,
        style: { fontSize: 36, lineSpacing: 12, horizontalMargin: 72, color: '#ffffff', backgroundColor: '#101820', backgroundOpacity: 1 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(0);
    expect(plan.filterComplex).toContain('drawtext=textfile=__CREDITSFILE_clip_credits__');
    expect(plan.filterComplex).toContain("y='h-t*120'");
    expect(plan.filterComplex).toContain('line_spacing=12');
    expect(plan.textArtifacts).toEqual([
      expect.objectContaining({ clipId: 'clip-credits', text: '导演    林青\n演员    Ada', placeholder: '__CREDITSFILE_clip_credits__' })
    ]);
  });

  it('injects target frame-rate conversion filters and output args', () => {
    const project = makeProject();
    project.settings.fps = 24;
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-24fps', duration: 2 })];

    const exportProject = buildExportProjectFromProject(project, { outputPath: 'D:\\Exports\\out.mp4', settings: { fps: 24 } });
    const plan = buildFfmpegExportPlan(exportProject);

    expect(plan.filterComplex).toContain('fps=24');
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-r', '24']));
  });

  it('burns subtitle clips in with a temporary SRT artifact and force style', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles 1',
        clips: [
          makeSubtitleClip({
            id: 'subtitle-a',
            start: 0.5,
            duration: 1.5,
            text: 'Hello subtitles',
            style: { backgroundOpacity: 0, outlineColor: '#112233', outlineWidth: 3, shadowColor: '#445566', shadowOffset: 2 }
          }),
          makeSubtitleClip({ id: 'subtitle-b', start: 2.5, duration: 1, text: 'Second line' })
        ]
      })
    );

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('subtitles=filename=__SUBTITLEFILE_export_subtitles__');
    expect(plan.filterComplex).toContain("force_style='FontSize=42,PrimaryColour=&Hffffff&");
    expect(plan.filterComplex).toContain('OutlineColour=&H332211&');
    expect(plan.filterComplex).toContain('BackColour=&Hff665544&');
    expect(plan.filterComplex).toContain('BorderStyle=1');
    expect(plan.filterComplex).toContain('Outline=3');
    expect(plan.filterComplex).toContain('Shadow=2');
    expect(plan.filterComplex).toContain('MarginV=72');
    expect(plan.textArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clipId: 'subtitles',
          fileName: 'subtitles.srt',
          pathMode: 'filter',
          text: expect.stringContaining('00:00:00,500 --> 00:00:02,000')
        })
      ])
    );
  });

  it('embeds subtitle clips as a soft mov_text subtitle stream', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles 1',
        clips: [makeSubtitleClip({ id: 'subtitle-soft', start: 1, duration: 2, text: 'Soft subtitle', subtitleMode: 'soft-sub' })]
      })
    );

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const subtitleInput = plan.inputs.at(-1);

    expect(plan.filterComplex).not.toContain('subtitles=filename=');
    expect(subtitleInput).toEqual(expect.objectContaining({ path: '__SUBTITLEFILE_export_subtitles__', args: ['-f', 'srt'] }));
    expect(plan.maps).toEqual(expect.arrayContaining(['-map', `${subtitleInput?.index}:s:0`]));
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:s', 'mov_text']));
    expect(plan.textArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'subtitles.srt',
          pathMode: 'argument',
          text: expect.stringContaining('Soft subtitle')
        })
      ])
    );
  });

  it('embeds multilingual soft subtitles as separate streams with language metadata', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle-zh',
        type: 'subtitle',
        name: '中文字幕',
        language: 'zh',
        clips: [makeSubtitleClip({ id: 'subtitle-zh', trackId: 'track-subtitle-zh', start: 0, duration: 2, text: '你好', subtitleMode: 'soft-sub' })]
      }),
      createTrack({
        id: 'track-subtitle-en',
        type: 'subtitle',
        name: 'English Subtitles',
        language: 'en',
        clips: [makeSubtitleClip({ id: 'subtitle-en', trackId: 'track-subtitle-en', start: 0, duration: 2, text: 'Hello', subtitleMode: 'soft-sub' })]
      })
    );

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { subtitleMode: 'soft-sub', subtitleFormat: 'srt', subtitleLanguages: ['zh', 'en'] }
      })
    );

    const subtitleInputs = plan.inputs.filter((input) => input.path.startsWith('__SUBTITLEFILE_export_subtitles_'));
    expect(subtitleInputs).toHaveLength(2);
    expect(plan.maps).toEqual(expect.arrayContaining(['-map', `${subtitleInputs[0].index}:s:0`, '-map', `${subtitleInputs[1].index}:s:0`]));
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:s', 'mov_text', '-metadata:s:s:0', 'language=zho', '-metadata:s:s:1', 'language=eng']));
    expect(plan.textArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileName: 'subtitles.zh.srt', pathMode: 'argument', text: expect.stringContaining('你好') }),
        expect.objectContaining({ fileName: 'subtitles.en.srt', pathMode: 'argument', text: expect.stringContaining('Hello') })
      ])
    );
  });

  it('burns only the selected subtitle language into the video', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle-zh',
        type: 'subtitle',
        name: '中文字幕',
        language: 'zh',
        clips: [makeSubtitleClip({ id: 'subtitle-zh-burn', trackId: 'track-subtitle-zh', start: 0, duration: 2, text: '中文硬字幕' })]
      }),
      createTrack({
        id: 'track-subtitle-en',
        type: 'subtitle',
        name: 'English Subtitles',
        language: 'en',
        clips: [makeSubtitleClip({ id: 'subtitle-en-burn', trackId: 'track-subtitle-en', start: 0, duration: 2, text: 'English burn-in' })]
      })
    );

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { subtitleMode: 'burn-in', subtitleBurnInLanguage: 'en' }
      })
    );

    expect(plan.filterComplex).toContain('subtitles=filename=__SUBTITLEFILE_export_subtitles_en__');
    expect(plan.textArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'subtitles.en.srt',
          pathMode: 'filter',
          text: expect.stringContaining('English burn-in')
        })
      ])
    );
    expect(plan.textArtifacts.some((artifact) => artifact.text.includes('中文硬字幕'))).toBe(false);
  });

  it('embeds ASS subtitles as an ass stream and emits a sidecar artifact', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles 1',
        clips: [
          makeSubtitleClip({
            id: 'subtitle-ass',
            start: 1,
            duration: 2,
            text: 'Styled subtitle',
            subtitleMode: 'soft-sub',
            style: { fontSize: 36, color: '#aabbcc', backgroundColor: '#112233', backgroundOpacity: 0.25 }
          })
        ]
      })
    );

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mkv',
        settings: { subtitleMode: 'soft-sub', subtitleFormat: 'ass', exportSidecarSubtitle: true, format: 'mkv' }
      })
    );
    const subtitleInput = plan.inputs.at(-1);

    expect(subtitleInput).toEqual(expect.objectContaining({ path: '__SUBTITLEFILE_export_subtitles__', args: ['-f', 'ass'] }));
    expect(plan.maps).toEqual(expect.arrayContaining(['-map', `${subtitleInput?.index}:s:0`]));
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:s', 'ass']));
    expect(plan.textArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'subtitles.ass',
          pathMode: 'argument',
          text: expect.stringContaining('[V4+ Styles]')
        }),
        expect.objectContaining({
          fileName: 'subtitles.ass',
          pathMode: 'sidecar',
          text: expect.stringContaining('Styled subtitle')
        })
      ])
    );
  });

  it('applies export setting overrides for presets', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-video', duration: 2 })];

    const exportProject = buildExportProjectFromProject(project, {
      outputPath: 'out.mp4',
      settings: { width: 1920, height: 1080, fps: 60, sampleRate: 48_000 }
    });
    const plan = buildFfmpegExportPlan(exportProject);

    expect(exportProject.settings.width).toBe(1920);
    expect(exportProject.settings.height).toBe(1080);
    expect(exportProject.settings.fps).toBe(60);
    expect(plan.filterComplex).toContain('s=1920x1080:r=60');
    expect(plan.filterComplex).toContain('aresample=48000');
    expect(plan.outputArgs).toContain('60');
  });

  it('builds current-frame image exports with output seek and one video frame', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-frame', duration: 3 })];

    const plan = buildFfmpegCurrentFrameExportPlan(buildExportProjectFromProject(project, { outputPath: 'D:\\Exports\\frame.jpg' }), 1.25);

    expect(plan.fullArgs[0]).toBe('-y');
    expect(plan.fullArgs).toContain('-filter_complex');
    expect(plan.maps).toEqual(['-map', '[vout]']);
    expect(plan.outputArgs).toEqual(['-ss', '1.25', '-frames:v', '1', '-f', 'image2', 'D:/Exports/frame.jpg']);
    expect(plan.fullArgs).toEqual(expect.arrayContaining(['-ss', '1.25', '-frames:v', '1']));
    expect(plan.fullArgs).not.toContain('[aout]');
    expect(plan.fullArgs).not.toContain('-c:a');
    expect(plan.fullArgs.at(-1)).toBe('D:/Exports/frame.jpg');
    expect(plan.duration).toBeCloseTo(1 / 30);
  });

  it('calculates export preview sample times from the timeline start, middle, and end', () => {
    expect(calculateExportPreviewSampleTimes(6)).toEqual([
      { kind: 'start', time: 0 },
      { kind: 'middle', time: 3 },
      { kind: 'end', time: 6 }
    ]);
    expect(calculateExportPreviewSampleTimes(Number.NaN)).toEqual([
      { kind: 'start', time: 0 },
      { kind: 'middle', time: 0 },
      { kind: 'end', time: 0 }
    ]);
  });

  it('builds three export preview sample plans with full filter chains and single-frame args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-preview', duration: 6, colorCorrection: { brightness: 0.2, contrast: 1.1, saturation: 1.2, hue: 15 } })];

    const samples = buildFfmpegPreviewSamplePlans(buildExportProjectFromProject(project, { outputPath: 'D:\\Exports\\movie.mp4' }), [
      'D:\\Previews\\start.png',
      'D:\\Previews\\middle.png',
      'D:\\Previews\\end.png'
    ]);

    expect(samples.map((sample) => sample.kind)).toEqual(['start', 'middle', 'end']);
    expect(samples.map((sample) => sample.time)).toEqual([0, 3, 6]);
    for (const sample of samples) {
      expect(sample.plan.fullArgs).toContain('-filter_complex');
      expect(sample.plan.filterComplex).toContain('eq=brightness=0.2:contrast=1.1:saturation=1.2');
      expect(sample.plan.outputArgs).toEqual(['-ss', String(sample.time), '-frames:v', '1', '-f', 'image2', sample.outputPath]);
      expect(sample.plan.fullArgs.at(-1)).toBe(sample.outputPath);
      expect(sample.plan.fullArgs).not.toContain('-c:a');
    }
  });

  it('builds single-frame args for preview plans even when the selected export format is animated', () => {
    const project = makeProject();
    const sample = buildFfmpegPreviewSamplePlans(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loop.gif',
        settings: { format: 'gif', videoCodec: 'gif' }
      }),
      ['D:\\Previews\\start.png', 'D:\\Previews\\middle.png', 'D:\\Previews\\end.png']
    )[0];

    expect(sample.plan.outputArgs).toEqual(['-ss', '0', '-frames:v', '1', '-f', 'image2', 'D:/Previews/start.png']);
    expect(sample.plan.fullArgs).not.toContain('__GIF_PALETTE_open_factory__');
  });

  it('clamps current-frame seek time and omits soft subtitle streams from image exports', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-frame-bounds', duration: 2 })];
    project.timeline.tracks.push(
      createTrack({
        id: 'track-soft-subtitle',
        type: 'subtitle',
        name: 'Soft Subtitles',
        clips: [makeSubtitleClip({ id: 'subtitle-soft-frame', start: 0, duration: 2, text: 'Soft', subtitleMode: 'soft-sub' })]
      })
    );

    const latePlan = buildFfmpegCurrentFrameExportPlan(buildExportProjectFromProject(project, { outputPath: 'frame.png' }), 99);
    const earlyPlan = buildFfmpegCurrentFrameExportPlan(buildExportProjectFromProject(project, { outputPath: 'frame.jpg' }), -1);

    expect(latePlan.outputArgs).toEqual(['-ss', '2', '-frames:v', '1', '-f', 'image2', 'frame.png']);
    expect(earlyPlan.outputArgs).toEqual(['-ss', '0', '-frames:v', '1', '-f', 'image2', 'frame.jpg']);
    expect(latePlan.maps).toEqual(['-map', '[vout]']);
    expect(latePlan.inputs.some((input) => input.args.includes('-f') && input.path.includes('SUBTITLE'))).toBe(false);
  });

  it('applies fit scaling and padding for vertical Shorts-style exports', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-shorts', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { width: 1080, height: 1920, scaleMode: 'fit' }
      })
    );

    expect(plan.fullArgs).toContain('-filter_complex');
    expect(plan.fullArgs).not.toContain('-vf');
    expect(plan.filterComplex).toContain('scale=1080:1920:force_original_aspect_ratio=decrease');
    expect(plan.filterComplex).toContain('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black');
  });

  it('injects smart reframe crop and exact output scale for target aspect ratios', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-reframe', duration: 2, transform: { scale: 0.75 } })];

    const exportProject = buildExportProjectFromProject(project, {
      outputPath: 'out.mp4',
      settings: { width: 1920, height: 1080, targetAspectRatio: '9:16', reframeOffsetX: 0.5, reframeOffsetY: -0.25 }
    });
    const plan = buildFfmpegExportPlan(exportProject);

    expect(exportProject.settings).toMatchObject({ width: 1080, height: 1920, targetAspectRatio: '9:16', reframeOffsetX: 0.5, reframeOffsetY: -0.25 });
    expect(plan.filterComplex).toContain("crop=w='if(gte(iw/ih\\,0.5625)\\,ih*0.5625\\,iw)'");
    expect(plan.filterComplex).toContain("x='(iw-ow)/2+(iw-ow)/2*0.5'");
    expect(plan.filterComplex).toContain("y='(ih-oh)/2+(ih-oh)/2*-0.25'");
    expect(plan.filterComplex).toContain('scale=1080:1920');
    expect(plan.filterComplex).toContain('scale=trunc(iw*0.75/2)*2:trunc(ih*0.75/2)*2');
    expect(plan.filterComplex).not.toContain('pad=1080:1920');
  });

  it('exports independent scale axes and rotation filters for transformed clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-rotated-scale',
        duration: 2,
        transform: { x: 10, y: -20, scale: 1, scaleX: 0.5, scaleY: 0.75, rotation: 30, opacity: 1 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('scale=trunc(iw*0.5/2)*2:trunc(ih*0.75/2)*2');
    expect(plan.filterComplex).toContain('rotate=30*PI/180:c=none');
    expect(plan.filterComplex).toContain("overlay=x='(main_w-overlay_w)/2+10':y='(main_h-overlay_h)/2-20'");
  });

  it('exports PiP clip border as a drawbox filter', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-pip-border',
        duration: 2,
        transform: { scale: 0.25, scaleX: 0.25, scaleY: 0.25 },
        border: { enabled: true, color: '#00e5ff', width: 8 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('scale=trunc(iw*0.25/2)*2:trunc(ih*0.25/2)*2');
    expect(plan.filterComplex).toContain('drawbox=x=0:y=0:w=iw:h=ih:color=0x00e5ff:t=8');
  });

  it('omits rotation filter for default zero rotation', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-no-rotation', duration: 2, transform: { rotation: 0 } })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('rotate=');
  });

  it('chains adjustment layer filters over the composited video output', () => {
    const project = makeProject();
    project.timeline.tracks = [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeVideoClip({ id: 'clip-base', duration: 2 })] }),
      createTrack({
        id: 'track-adjustment-a',
        type: 'video',
        name: 'Adjustment A',
        clips: [makeAdjustmentClip({ id: 'adjustment-dark', trackId: 'track-adjustment-a', duration: 2, colorCorrection: { brightness: -0.25, contrast: 0.8 } })]
      }),
      createTrack({
        id: 'track-adjustment-b',
        type: 'video',
        name: 'Adjustment B',
        clips: [makeAdjustmentClip({ id: 'adjustment-blur', trackId: 'track-adjustment-b', duration: 2, effects: [{ id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 4 } }] })]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('[base1]split=2[base2_adjustment_dark_base][base2_adjustment_dark_source]');
    expect(plan.filterComplex).toContain('[base2_adjustment_dark_source]eq=brightness=-0.25:contrast=0.8:saturation=1[base2_adjustment_dark_processed]');
    expect(plan.filterComplex).toContain("enable='between(t,0,2)'[base2]");
    expect(plan.filterComplex).toContain('[base2]split=2[base3_adjustment_blur_base][base3_adjustment_blur_source]');
    expect(plan.filterComplex).toContain('[base3_adjustment_blur_source]gblur=sigma=4[base3_adjustment_blur_processed]');
    expect(plan.filterComplex.indexOf('[base1]split=2')).toBeLessThan(plan.filterComplex.indexOf('[base2]split=2'));
  });

  it('omits neutral adjustment layers from export filters', () => {
    const project = makeProject();
    project.timeline.tracks = [
      createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeVideoClip({ id: 'clip-base', duration: 2 })] }),
      createTrack({
        id: 'track-adjustment',
        type: 'video',
        name: 'Adjustment',
        clips: [makeAdjustmentClip({ id: 'adjustment-neutral', trackId: 'track-adjustment', duration: 2 })]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('adjustment_neutral');
    expect(plan.filterComplex).not.toContain('[base1]split=2');
  });

  it('calculates image watermark overlay coordinates for nine-grid positions', () => {
    expect(calculateWatermarkOverlayPosition('bottom-right', 1920, 1080, 192, 108)).toEqual({ x: 1704, y: 948 });
    expect(calculateWatermarkOverlayPosition('top-left', 1920, 1080, 192, 108)).toEqual({ x: 24, y: 24 });
    expect(calculateWatermarkOverlayPosition('center', 1920, 1080, 192, 108)).toEqual({ x: 864, y: 486 });
  });

  it('adds image watermark input, opacity, and overlay expressions', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-watermark-base', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: {
          width: 1920,
          height: 1080,
          watermark: {
            enabled: true,
            type: 'image',
            path: 'D:\\Brand\\logo.png',
            position: 'bottom-right',
            scalePercent: 10,
            opacity: 0.5
          }
        }
      })
    );

    expect(plan.inputs.at(-1)).toEqual(expect.objectContaining({ path: 'D:/Brand/logo.png', args: ['-loop', '1', '-t', '2'] }));
    expect(plan.filterComplex).toContain('[1:v]scale=192:-1,format=rgba,colorchannelmixer=aa=0.5[watermark_1]');
    expect(plan.filterComplex).toContain("[base1][watermark_1]overlay=x='main_w-overlay_w-24':y='main_h-overlay_h-24':eval=frame");
  });

  it('adds text watermark drawtext args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-text-watermark-base', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: {
          watermark: {
            enabled: true,
            type: 'text',
            text: 'Draft',
            fontFamily: 'Arial',
            color: '#ffcc00',
            fontSize: 42,
            position: 'top-left'
          }
        }
      })
    );

    expect(plan.filterComplex).toContain("drawtext=text='Draft':font='Arial':fontsize=42:fontcolor=0xffcc00:x='24':y='24'");
  });

  it('omits watermark filters for default disabled watermarks', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-no-watermark', duration: 2 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('watermark_');
    expect(plan.filterComplex).not.toContain("drawtext=text='");
  });

  it('adds timecode burn-in drawtext args with frame numbers', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-timecode-burn-in', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: {
          timecodeBurnIn: {
            enabled: true,
            position: 'top-left',
            fontSize: 32,
            color: '#ffcc00',
            backgroundColor: '#000000',
            includeFrameNumber: true
          }
        }
      })
    );

    expect(plan.filterComplex).toContain("drawtext=text='%{pts\\:hms}:%{n}'");
    expect(plan.filterComplex).toContain('fontsize=32');
    expect(plan.filterComplex).toContain('fontcolor=0xffcc00');
    expect(plan.filterComplex).toContain('box=1:boxcolor=0x000000@0.72');
    expect(plan.filterComplex).toContain("x='24':y='24'");
  });

  it('generates a 0.5s slate frame and prepends matching silent audio', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-slate-main', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: {
          slate: { enabled: true }
        }
      })
    );

    expect(plan.filterComplex).toContain('color=c=black:s=1280x720:r=30:d=0.5');
    expect(plan.filterComplex).toContain('drawbox=x=0:y=0:w=iw:h=ih:color=black@1:t=fill');
    expect(plan.filterComplex).toContain("drawtext=text='Project\\\\: Test Project'");
    expect(plan.filterComplex).toContain("drawtext=text='Duration\\\\: 2s'");
    expect(plan.filterComplex).toContain('concat=n=2:v=1:a=0');
    expect(plan.filterComplex).toContain('anullsrc=channel_layout=stereo:sample_rate=44100:d=0.5[slate_audio]');
    expect(plan.filterComplex).toContain('[slate_audio][aout]concat=n=2:v=0:a=1[aout_slate]');
    expect(plan.maps).toEqual(['-map', '[vout]', '-map', '[aout_slate]']);
    expect(plan.duration).toBe(2.5);
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-t', '2.5']));
  });

  it.each([
    ['pixelize', 'pixelize=width=16:height=16'],
    ['gblur', 'gblur=sigma=18'],
    ['solid', 'drawbox=x=0:y=0:w=iw:h=ih:color=0x000000:t=fill']
  ] as const)('generates privacy blur mask filters for %s', (effect, expectedFilter) => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: `clip-privacy-${effect}`,
        duration: 2,
        masks: [
          {
            id: 'privacy-mask',
            type: 'rect',
            x: 0.2,
            y: 0.3,
            w: 0.25,
            h: 0.2,
            keyframes: [
              { time: 0, x: 0.2, y: 0.3, w: 0.25, h: 0.2 },
              { time: 1, x: 0.4, y: 0.35, w: 0.2, h: 0.18 }
            ],
            inverted: false,
            feather: 0,
            enabled: true,
            privacyBlur: { enabled: true, effect, color: '#000000' }
          }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("crop=w='iw*if(lt(t,0),0.25");
    expect(plan.filterComplex).toContain(expectedFilter);
    expect(plan.filterComplex).toContain("overlay=x='main_w*if(lt(t,0),0.2");
  });

  it('adds preset video and audio bitrate args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-bitrate', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.mp4',
        settings: { videoBitrate: '8M', audioBitrate: '192k' }
      })
    );

    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-b:v', '8M', '-b:a', '192k']));
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-movflags', '+faststart']));
  });

  it('builds m4a audio-only exports without a video stream', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-audio-from-video', duration: 2 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'out.m4a',
        settings: { format: 'm4a', outputMode: 'audio', audioCodec: 'aac', audioBitrate: '192k' }
      })
    );

    expect(plan.maps).toEqual(['-map', '[aout]']);
    expect(plan.outputArgs).not.toContain('-c:v');
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:a', 'aac', '-b:a', '192k']));
    expect(plan.outputArgs).not.toContain('-movflags');
    expect(plan.filterComplex).not.toContain('[vout]');
    expect(plan.filterComplex).not.toContain('color=c=black');
  });

  it('turns two opacity keyframes into an alpha fade filter', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-opacity-keyframes',
        duration: 2,
        keyframes: {
          opacity: [
            { id: 'opacity-start', time: 0, value: 1, easing: 'linear' },
            { id: 'opacity-end', time: 1, value: 0, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('fade=t=out:st=0:d=1:alpha=1');
  });

  it('turns text opacity animation keyframes into a faded transparent text layer', () => {
    const project = makeProject();
    project.timeline.tracks[2].clips = [
      makeTextClip({
        id: 'clip-text-fade',
        duration: 2,
        text: 'Animated',
        keyframes: {
          opacity: [
            { id: 'text-fade-start', time: 0, value: 0, easing: 'ease-out' },
            { id: 'text-fade-end', time: 0.5, value: 1, easing: 'ease-out' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'C:/out.mp4' }));

    expect(plan.filterComplex).toContain('color=c=black@0');
    expect(plan.filterComplex).toContain('drawtext=textfile=__TEXTFILE_clip_text_fade__');
    expect(plan.filterComplex).toContain('fade=t=in:st=0:d=0.5:alpha=1');
    expect(plan.filterComplex).toContain('overlay=x=0:y=0');
  });

  it('turns volume keyframes into a frame-evaluated volume expression', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-volume-keyframes',
        duration: 2,
        volume: 1,
        keyframes: {
          volume: [
            { id: 'volume-start', time: 0, value: 1, easing: 'linear' },
            { id: 'volume-end', time: 1, value: 0.5, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("volume='if(lt(t,0),1,if(lte(t,1),1+(0.5-1)*((t-0)/1),0.5))':eval=frame");
  });

  it('turns scale keyframes into a frame-evaluated scale expression', () => {
    const project = makeProject();
    project.media = [
      {
        id: 'asset-image',
        type: 'image',
        name: 'still.png',
        path: 'D:\\Media\\still.png',
        duration: 0,
        width: 640,
        height: 360
      }
    ];
    project.timeline.tracks[0].clips = [
      {
        id: 'clip-ken-burns',
        type: 'image',
        name: 'Still',
        mediaId: 'asset-image',
        trackId: 'track-video',
        start: 0,
        duration: 2,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: {
          scaleX: [
            { id: 'sx-a', time: 0, value: 1, easing: 'linear' },
            { id: 'sx-b', time: 2, value: 1.5, easing: 'linear' }
          ],
          scaleY: [
            { id: 'sy-a', time: 0, value: 1, easing: 'linear' },
            { id: 'sy-b', time: 2, value: 1.5, easing: 'linear' }
          ]
        }
      }
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("scale=w='trunc(iw*(if(lt(t,0),1,if(lte(t,2),1+(1.5-1)*((t-0)/2),1.5)))/2)*2'");
    expect(plan.filterComplex).toContain(':eval=frame');
  });

  it('normalizes sample aspect ratio after Ken Burns scale filters', () => {
    const plan = buildKenBurnsScalePlan({ scaleXEnd: 1.5, scaleYEnd: 1.5 });

    expect(plan.filterComplex).toContain('zoompan=z=');
    expect(plan.filterComplex).toContain(',setsar=1,setpts=PTS-STARTPTS+0/TB,format=rgba');
  });

  it('turns Ken Burns start and end scale keyframes into zoompan parameters', () => {
    const plan = buildKenBurnsScalePlan({ scaleXEnd: 1.5, scaleYEnd: 1.5 });

    expect(plan.filterComplex).toContain("zoompan=z='if(lt(ot,0),1,if(lte(ot,2),1+(1.5-1)*((ot-0)/2),1.5))'");
    expect(plan.filterComplex).toContain(":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=1280x720:fps=30");
  });

  it('turns position keyframes into frame-evaluated overlay expressions', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-position-keyframes',
        duration: 2,
        keyframes: {
          x: [
            { id: 'x-a', time: 0, value: -0.5, easing: 'linear' },
            { id: 'x-b', time: 2, value: 0.5, easing: 'linear' }
          ],
          y: [
            { id: 'y-a', time: 0, value: 0, easing: 'ease-in' },
            { id: 'y-b', time: 2, value: 0.25, easing: 'ease-in' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("overlay=x='main_w/2-overlay_w/2+(main_w/2)*(if(lt(t,0),-0.5,if(lte(t,2),-0.5+(0.5--0.5)*((t-0)/2),0.5)))'");
    expect(plan.filterComplex).toContain("y='main_h/2-overlay_h/2+(main_h/2)*(if(lt(t,0),0,if(lte(t,2),0+(0.25-0)*(((t-0)/2))*(((t-0)/2)),0.25)))'");
  });

  it('uses geq alpha expressions for multi-step opacity keyframes', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-opacity-expression',
        duration: 3,
        keyframes: {
          opacity: [
            { id: 'o-a', time: 0, value: 1, easing: 'linear' },
            { id: 'o-b', time: 1.5, value: 0.5, easing: 'ease-out' },
            { id: 'o-c', time: 3, value: 0, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(if(lt(T,0),1");
    expect(plan.filterComplex).toContain("if(lte(T,1.5),1+(0.5-1)*((T-0)/1.5)");
    expect(plan.filterComplex).toContain("[vclip_opacity_expression]");
  });

  it('rejects an empty timeline before building ffmpeg args', () => {
    const project = makeProject();
    project.timeline.tracks.forEach((track) => {
      track.clips = [];
    });

    expect(() => buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }))).toThrow('timeline is empty');
  });

  it('builds an image-only export with a looped still and generated silent audio', () => {
    const project = makeProject();
    project.media = [
      {
        id: 'asset-image',
        type: 'image',
        name: 'overlay.png',
        path: 'D:\\Media\\overlay.png',
        duration: 0,
        width: 640,
        height: 360
      }
    ];
    project.timeline.tracks[0].clips = [
      {
        id: 'clip-image',
        type: 'image',
        name: 'Still',
        mediaId: 'asset-image',
        trackId: 'track-video',
        start: 0.5,
        duration: 2,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 10, y: -20, scale: 0.5, rotation: 0, opacity: 0.75 }
      }
    ];
    project.timeline.tracks[1].clips = [];
    project.timeline.tracks[2].clips = [];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toEqual([expect.objectContaining({ path: 'D:/Media/overlay.png', args: ['-loop', '1', '-t', '2'] })]);
    expect(plan.filterComplex).toContain("overlay=x='(main_w-overlay_w)/2+10':y='(main_h-overlay_h)/2-20'");
    expect(plan.filterComplex).toContain("enable='between(t,0.5,2.5)'");
    expect(plan.filterComplex).toContain('anullsrc=channel_layout=stereo:sample_rate=44100:d=2.5,volume=1[aout]');
    expect(plan.duration).toBe(2.5);
  });

  it('builds an audio-only export over a black video base', () => {
    const project = makeProject();
    project.media = [
      {
        id: 'asset-audio-only',
        type: 'audio',
        name: 'voice.wav',
        path: '/media/voice.wav',
        duration: 3,
        width: 0,
        height: 0,
        audioChannels: 1,
        audioSampleRate: 22050
      }
    ];
    project.timeline.tracks[0].clips = [];
    project.timeline.tracks[1].clips = [
      {
        id: 'clip-audio-only',
        type: 'audio',
        name: 'Voice',
        mediaId: 'asset-audio-only',
        trackId: 'track-audio',
        start: 0.25,
        duration: 3,
        trimStart: 0.5,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        volume: 0.8
      }
    ];
    project.timeline.tracks[2].clips = [];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(1);
    expect(plan.filterComplex).toContain('color=c=black:s=1280x720:r=30:d=3.25[base0]');
    expect(plan.inputs[0].args).toEqual(['-ss', '0.5', '-t', '3']);
    expect(plan.filterComplex).toContain('[0:a:0]atrim=start=0:duration=3');
    expect(plan.filterComplex).toContain('adelay=250:all=1,volume=0.8');
    expect(plan.filterComplex).toContain('[aclip_audio_only]amix=inputs=1:duration=longest:normalize=0');
    expect(plan.duration).toBe(3.25);
  });

  it('emits opacity, volume, and colored text style filters', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-video-style',
        duration: 2,
        volume: 1.5,
        transform: { opacity: 0.42, scale: 0.75 }
      })
    ];
    project.timeline.tracks[2].clips = [
      makeTextClip({
        id: 'clip-text-style',
        start: 0,
        duration: 2,
        transform: { opacity: 0.8 },
        style: {
          fontSize: 64,
          color: '#ff4fd8',
          backgroundColor: '#00e5ff',
          backgroundOpacity: 0.45
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('colorchannelmixer=aa=0.42');
    expect(plan.filterComplex).toContain('volume=1.5');
    expect(plan.filterComplex).toContain('fontsize=64');
    expect(plan.filterComplex).toContain('fontcolor=0xff4fd8');
    expect(plan.filterComplex).toContain('colorchannelmixer=aa=0.8');
    expect(plan.filterComplex).toContain('box=1:boxcolor=0x00e5ff@0.45');
  });

  it('passes trimStart and duration as ffmpeg input -ss and -t args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-trimmed', trimStart: 1.25, trimEnd: 2, duration: 4 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs[0].args).toEqual(['-ss', '1.25', '-t', '4']);
    expect(plan.fullArgs).toEqual(expect.arrayContaining(['-ss', '1.25', '-t', '4']));
    expect(plan.filterComplex).toContain('[0:v]trim=start=0:duration=4');
    expect(plan.duration).toBe(4);
  });

  it('generates color correction filters only when clip values differ from defaults', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-color',
        duration: 2,
        colorCorrection: { brightness: 0.5, contrast: 1.25, saturation: 1.5, hue: 60 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('eq=brightness=0.5:contrast=1.25:saturation=1.5');
    expect(plan.filterComplex).toContain('hue=h=60');

    const defaultPlan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));
    expect(defaultPlan.filterComplex).not.toContain('eq=brightness=');
    expect(defaultPlan.filterComplex).not.toContain('hue=h=');
  });

  it('skips chroma key filters when the clip chroma key is disabled', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-chroma-disabled',
        chromaKey: { enabled: false, color: [0, 255, 0], colors: [[0, 255, 0]], similarity: 0.2, blend: 0.1, spillSuppression: false, erosion: 0 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('chromakey=');
    expect(plan.filterComplex).not.toContain('lumakey=');
  });

  it('builds luma key filter args from clip keying settings', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-luma-key',
        chromaKey: {
          enabled: true,
          mode: 'luma-key',
          color: [0, 255, 0],
          colors: [[0, 255, 0]],
          similarity: 0.1,
          blend: 0.05,
          spillSuppression: false,
          erosion: 0,
          lumaThreshold: 0.42,
          lumaTolerance: 0.12,
          lumaSoftness: 0.08,
          differenceReferenceTime: 0,
          differenceThreshold: 0.2
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('lumakey=threshold=0.42:tolerance=0.12:softness=0.08');
    expect(plan.filterComplex).not.toContain('chromakey=');
  });

  it('injects difference matte reference frame time and threshold into filter args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-difference-matte',
        duration: 4,
        chromaKey: {
          enabled: true,
          mode: 'difference-matte',
          color: [0, 255, 0],
          colors: [[0, 255, 0]],
          similarity: 0.1,
          blend: 0.05,
          spillSuppression: false,
          erosion: 0,
          lumaThreshold: 0.4,
          lumaTolerance: 0.1,
          lumaSoftness: 0.05,
          differenceReferenceTime: 1.25,
          differenceThreshold: 0.33
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('trim=start=1.25');
    expect(plan.filterComplex).toContain('blend=all_mode=difference');
    expect(plan.filterComplex).toContain("lutyuv=y='if(gt(val,84),255,0)'");
  });

  it('places enabled chroma key filters before scaling and color correction', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-chroma-enabled',
        duration: 2,
        colorCorrection: { brightness: 0.1 },
        chromaKey: { enabled: true, color: [0, 255, 0], colors: [[0, 255, 0]], similarity: 0.24, blend: 0.08, spillSuppression: false, erosion: 0 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const filter = plan.filterComplex;

    expect(filter).toContain('chromakey=color=0x00FF00:similarity=0.24:blend=0.08');
    expect(filter.indexOf('chromakey=color=0x00FF00')).toBeLessThan(filter.indexOf('scale=trunc'));
    expect(filter.indexOf('chromakey=color=0x00FF00')).toBeLessThan(filter.indexOf('eq=brightness=0.1'));
    expect(filter).not.toContain('hue=s=0');
    expect(filter).not.toContain('erosion=');
    expect(filter).not.toContain('dilation=');
  });

  it('chains chroma key filters for multiple sampled colors', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-chroma-multi',
        chromaKey: {
          enabled: true,
          color: [0, 255, 0],
          colors: [
            [0, 255, 0],
            [0, 0, 255]
          ],
          similarity: 0.22,
          blend: 0.06,
          spillSuppression: false,
          erosion: 0
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain(
      'chromakey=color=0x00FF00:similarity=0.22:blend=0.06,chromakey=color=0x0000FF:similarity=0.22:blend=0.06'
    );
  });

  it('adds spill suppression and edge erosion filters only when requested', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-chroma-spill',
        chromaKey: {
          enabled: true,
          color: [0, 255, 0],
          colors: [[0, 255, 0]],
          similarity: 0.18,
          blend: 0.04,
          spillSuppression: true,
          erosion: 2
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('chromakey=color=0x00FF00:similarity=0.18:blend=0.04,erosion=coordinates=255,erosion=coordinates=255,hue=s=0');
  });

  it('uses dilation for negative chroma key erosion values', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-chroma-dilation',
        chromaKey: {
          enabled: true,
          color: [0, 255, 0],
          colors: [[0, 255, 0]],
          similarity: 0.2,
          blend: 0.05,
          spillSuppression: false,
          erosion: -1
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('chromakey=color=0x00FF00:similarity=0.2:blend=0.05,dilation=coordinates=255');
  });

  it('exports simple rect masks as crop plus transparent pad filters', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-rect-mask',
        duration: 2,
        masks: [{ id: 'mask-rect', type: 'rect', x: 0.25, y: 0.2, w: 0.5, h: 0.4, inverted: false, feather: 0, enabled: true }]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("crop=w='iw*0.5':h='ih*0.4':x='iw*0.25':y='ih*0.2'");
    expect(plan.filterComplex).toContain("pad=w='iw/0.5':h='ih/0.4':x='ow*0.25':y='oh*0.2':color=black@0");
  });

  it('exports ellipse and inverted masks as geq alpha expressions', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-ellipse-mask',
        duration: 2,
        masks: [{ id: 'mask-ellipse', type: 'ellipse', x: 0.1, y: 0.2, w: 0.6, h: 0.5, inverted: true, feather: 0.1, enabled: true }]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(");
    expect(plan.filterComplex).toContain('lte(pow((X-(iw*0.4))/max(iw*0.3,1),2)+pow((Y-(ih*0.45))/max(ih*0.25,1),2),1)');
  });

  it('exports path masks as geq alpha expressions from triangulated polygons', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-path-mask',
        duration: 2,
        masks: [
          {
            id: 'mask-path',
            type: 'path',
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            path: [
              { x: 0.2, y: 0.2 },
              { x: 0.8, y: 0.2 },
              { x: 0.5, y: 0.8 },
              { x: 0.2, y: 0.2 }
            ],
            inverted: false,
            feather: 0,
            enabled: true
          }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(");
    expect(plan.filterComplex).toContain('gte(');
    expect(plan.filterComplex).toContain('X/iw');
    expect(plan.filterComplex).toContain('Y/ih');
  });

  it('skips stabilization until analysis has produced a trf path', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-stabilization-pending',
        duration: 2,
        stabilization: { enabled: true, smoothing: 40, zoom: 1.5, analyzed: false, trfPath: null }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('vidstabtransform=');
  });

  it('exports analyzed stabilization with vidstabtransform parameters', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-stabilized',
        duration: 2,
        stabilization: { enabled: true, smoothing: 40, zoom: 1.5, analyzed: true, trfPath: 'C:/Stabilization/clip.trf' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('vidstabtransform=smoothing=40:zoom=1.5:input=C\\\\:/Stabilization/clip.trf');
  });

  it('exports custom shader clips through a temporary PNG sequence artifact', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-shader',
        duration: 1,
        effects: [
          {
            id: 'effect-shader',
            type: 'custom-shader',
            enabled: true,
            params: { source: DEFAULT_CUSTOM_SHADER_SOURCE, preset: 'pixelate' }
          }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const artifact = plan.textArtifacts.find((item) => item.pathMode === 'shader-sequence');
    const manifest = JSON.parse(artifact?.text ?? '{}') as { fragmentSource?: string; mediaPath?: string; frameCount?: number };

    expect(plan.inputs[0]).toMatchObject({
      path: '__CUSTOM_SHADER_SEQUENCE_clip_shader__',
      args: ['-f', 'image2', '-framerate', '30', '-start_number', '1']
    });
    expect(plan.inputs[1]).toMatchObject({ path: 'C:/Videos/sample.mp4', args: ['-ss', '0', '-t', '1'] });
    expect(plan.filterComplex).toContain('overlay=');
    expect(plan.filterComplex).toContain('[0:v]trim=start=0:duration=1,setpts=PTS-STARTPTS+0/TB');
    expect(plan.filterComplex).toContain('[1:a:0]atrim=start=0:duration=1');
    expect(plan.warnings).toContain('Custom shader effect for clip clip-shader will render frame-by-frame and may be slow.');
    expect(artifact).toMatchObject({
      clipId: 'clip-shader:custom-shader',
      fileName: 'custom-shader-clip_shader.json',
      placeholder: '__CUSTOM_SHADER_SEQUENCE_clip_shader__',
      pathMode: 'shader-sequence'
    });
    expect(manifest.mediaPath).toBe('C:/Videos/sample.mp4');
    expect(manifest.frameCount).toBe(30);
    expect(manifest.fragmentSource).toContain('uniform sampler2D u_texture;');
    expect(manifest.fragmentSource).toContain('uniform vec2 u_resolution;');
    expect(manifest.fragmentSource).toContain('uniform float u_time;');
    expect(manifest.fragmentSource).toContain('uniform float u_progress;');
  });

  it('inserts minterpolate for clips with frame interpolation enabled', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-interpolated',
        duration: 2,
        frameInterpolation: { enabled: true, targetFps: 60 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: true,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(plan.filterComplex).toContain('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc,format=rgba');
  });

  it('skips frame interpolation with a warning when minterpolate is unavailable', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-interpolation-unavailable',
        duration: 2,
        frameInterpolation: { enabled: true, targetFps: 120 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: false,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(plan.filterComplex).not.toContain('minterpolate=');
    expect(plan.warnings).toContain('Frame interpolation for clip clip-interpolation-unavailable was skipped because the current FFmpeg build does not support minterpolate.');
  });

  it('inserts blend slow motion interpolation for slowed clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-slow-blend',
        duration: 4,
        speed: 0.5,
        slowMotionMode: 'blend'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('minterpolate=fps=30:mi_mode=blend');
  });

  it('inserts optical flow slow motion interpolation for slowed clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-slow-optical-flow',
        duration: 4,
        speed: 0.4,
        slowMotionMode: 'optical-flow'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1');
  });

  it('inserts mci slow motion interpolation for slowed clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-mci-slow',
        duration: 4,
        speed: 0.5,
        slowMotionMode: 'mci'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc');
    expect(plan.filterComplex).not.toContain('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1');
  });

  it('does not insert slow motion interpolation for realtime or faster clips', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-not-slow',
        duration: 2,
        speed: 1,
        slowMotionMode: 'optical-flow'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('minterpolate=');
  });

  it('falls back optical flow slow motion to blend when minterpolate support is not reported', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-optical-flow-fallback',
        duration: 4,
        speed: 0.5,
        slowMotionMode: 'optical-flow'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: false,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(plan.filterComplex).toContain('minterpolate=fps=30:mi_mode=blend');
    expect(plan.warnings).toContain(
      'Optical flow slow motion for clip clip-optical-flow-fallback fell back to blend because the current FFmpeg build did not report minterpolate support.'
    );
  });

  it('skips blend slow motion interpolation with a warning when minterpolate is unavailable', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-blend-unavailable',
        duration: 4,
        speed: 0.5,
        slowMotionMode: 'blend'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: false,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(plan.filterComplex).not.toContain('minterpolate=');
    expect(plan.warnings).toContain('Slow motion interpolation for clip clip-blend-unavailable was skipped because the current FFmpeg build does not support minterpolate.');
  });

  it('inserts arnndn for clips with audio denoise enabled', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-denoise',
        duration: 2,
        audioDenoise: { enabled: true, strength: 0.75 }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: true,
      hasArnndn: true,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(plan.filterComplex).toContain('arnndn=m=model.rnnn:mix=0.75');
  });

  it('skips audio denoise when disabled or arnndn is unavailable', () => {
    const disabledProject = makeProject();
    disabledProject.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-denoise-disabled',
        duration: 2,
        audioDenoise: { enabled: false, strength: 1 }
      })
    ];
    const disabledPlan = buildFfmpegExportPlan(buildExportProjectFromProject(disabledProject, { outputPath: 'out.mp4' }));
    expect(disabledPlan.filterComplex).not.toContain('arnndn=');

    const unavailableProject = makeProject();
    unavailableProject.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-denoise-unavailable',
        duration: 2,
        audioDenoise: { enabled: true, strength: 1 }
      })
    ];
    const unavailablePlan = buildFfmpegExportPlan(buildExportProjectFromProject(unavailableProject, { outputPath: 'out.mp4' }), {
      available: true,
      version: 'ffmpeg',
      hasLibx264: true,
      hasAac: true,
      hasDrawtext: true,
      hasLibfreetype: true,
      hasMinterpolate: true,
      hasArnndn: false,
      hardwareEncoderAvailable: true,
      hardwareEncoder: 'h264_nvenc',
      drawtextWarning: null
    });

    expect(unavailablePlan.filterComplex).not.toContain('arnndn=');
    expect(unavailablePlan.warnings).toContain('Audio denoise for clip clip-denoise-unavailable was skipped because the current FFmpeg build does not support arnndn.');
  });

  it('builds pitch shift filters from clip semitones', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-pitch-up', duration: 2, pitchSemitones: 12 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('asetrate=44100*2,aresample=44100');
  });

  it('builds reverse audio filters when enabled', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-reverse-audio', duration: 2, reverseAudio: true })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('asetpts=PTS-STARTPTS,areverse');
  });

  it('adds non-linear audio fade curves and leaves default audio processing neutral', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-fade-curves',
        duration: 4,
        fadeInDuration: 1,
        fadeOutDuration: 1.5,
        fadeInCurve: 'ease-in',
        fadeOutCurve: 'ease-out'
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const defaultPlan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('afade=t=in:st=0:d=1:curve=qsin');
    expect(plan.filterComplex).toContain('afade=t=out:st=2.5:d=1.5:curve=hsin');
    expect(defaultPlan.filterComplex).not.toContain('asetrate=');
    expect(defaultPlan.filterComplex).not.toContain('areverse');
    expect(defaultPlan.filterComplex).not.toContain('curve=qsin');
    expect(defaultPlan.filterComplex).not.toContain('curve=hsin');
  });

  it('builds image sequence inputs through a local concat artifact', () => {
    const project = makeProject();
    project.media = [
      {
        id: 'asset-sequence',
        type: 'image',
        name: 'frame001.png 序列',
        path: 'D:\\Media\\frame001.png',
        duration: 0.1,
        width: 320,
        height: 180,
        imageSequence: {
          pattern: 'D:/Media/frame%03d.png',
          startNumber: 1,
          frameCount: 3,
          frameRate: 30,
          paths: ['D:\\Media\\frame001.png', 'D:\\Media\\frame002.png', 'D:\\Media\\frame003.png']
        }
      }
    ];
    project.timeline.tracks[0].clips = [
      {
        ...makeVideoClip({ id: 'clip-sequence', mediaId: 'asset-sequence', duration: 0.1 }),
        type: 'image',
        volume: undefined,
        sequenceFrameRate: 24
      } as Clip
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs[0]).toEqual(expect.objectContaining({ args: ['-f', 'concat', '-safe', '0'], path: '__IMAGE_SEQUENCE_clip_sequence__' }));
    expect(plan.textArtifacts[0]).toEqual(
      expect.objectContaining({
        fileName: 'sequence-clip_sequence.ffconcat',
        pathMode: 'argument',
        text: expect.stringContaining("file 'D:/Media/frame001.png'\nduration 0.041667")
      })
    );
  });

  it('exports PNG sequences as image2 frames without audio mapping', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-png-sequence', duration: 1 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\frames',
        settings: { format: 'png-sequence', fps: 12 }
      })
    );

    expect(plan.maps).toEqual(['-map', '[vout]']);
    expect(plan.outputArgs).toEqual(['-r', '12', '-f', 'image2', 'D:/Exports/frames/frame%04d.png']);
    expect(plan.fullArgs).not.toContain('-c:a');
    expect(plan.filterComplex).toContain('format=rgba[vout]');
  });

  it('builds GIF exports as palettegen and paletteuse passes with clamped frame size and fps', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-gif', duration: 1 })];

    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loop.gif',
        settings: { format: 'gif', width: 1920, height: 1200, fps: 60 }
      })
    );

    expect(plan.passes).toHaveLength(2);
    expect(plan.passes?.[0].name).toBe('gif-palettegen');
    expect(plan.passes?.[0].fullArgs.join(' ')).toContain('palettegen=stats_mode=diff');
    expect(plan.passes?.[0].fullArgs).toEqual(expect.arrayContaining(['-frames:v', '1', '-update', '1', '-f', 'image2', '__GIF_PALETTE_open_factory__']));
    expect(plan.passes?.[1].name).toBe('gif-paletteuse');
    expect(plan.passes?.[1].fullArgs.join(' ')).toContain('paletteuse=dither=sierra2_4a:diff_mode=rectangle');
    expect(plan.passes?.[1].fullArgs).toEqual(expect.arrayContaining(['-i', '__GIF_PALETTE_open_factory__', '-loop', '0', '-t', '1', '-f', 'gif', 'D:/Exports/loop.gif']));
    expect(plan.fullArgs).toEqual(plan.passes?.[1].fullArgs);
    expect(plan.outputArgs).toEqual(['-loop', '0', '-t', '1', '-f', 'gif', 'D:/Exports/loop.gif']);
    expect(plan.filterComplex).toContain('s=1080x675:r=30');
    expect(plan.textArtifacts).toContainEqual(expect.objectContaining({ clipId: 'gif-palette', pathMode: 'argument', placeholder: '__GIF_PALETTE_open_factory__' }));
    expect(plan.fullArgs).not.toContain('-c:a');
  });

  it('builds animated WebP and APNG exports without audio mapping', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-animated-image', duration: 1 })];

    const webpPlan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loop.webp',
        settings: { format: 'webp', fps: 24 }
      })
    );
    const apngPlan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\loop.apng',
        settings: { format: 'apng', fps: 24 }
      })
    );

    expect(webpPlan.maps).toEqual(['-map', '[vout]']);
    expect(webpPlan.outputArgs).toEqual(['-c:v', 'libwebp_anim', '-loop', '0', '-r', '24', '-f', 'webp', 'D:/Exports/loop.webp']);
    expect(webpPlan.fullArgs).not.toContain('-c:a');
    expect(apngPlan.maps).toEqual(['-map', '[vout]']);
    expect(apngPlan.outputArgs).toEqual(['-plays', '0', '-f', 'apng', 'D:/Exports/loop.apng']);
    expect(apngPlan.fullArgs).not.toContain('-c:a');
  });

  it('passes clip LUT paths into export project color correction data', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-lut-data',
        duration: 2,
        colorCorrection: { lutPath: 'C:\\LUTs\\Cine Look.cube' }
      })
    ];

    const exportProject = buildExportProjectFromProject(project, { outputPath: 'out.mp4' });

    expect(exportProject.timeline.tracks[0].clips[0].colorCorrection.lutPath).toBe('C:\\LUTs\\Cine Look.cube');
  });

  it('generates lut3d filters for cube LUT color correction without redundant eq filters', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-lut',
        duration: 2,
        colorCorrection: { lutPath: 'C:\\LUTs\\Cine Look.cube' }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain(String.raw`lut3d=file=C\\:/LUTs/Cine Look.cube`);
    expect(plan.filterComplex).not.toContain('eq=brightness=0:contrast=1:saturation=1');
  });

  it('generates built-in camera log LUT artifacts before user cube LUTs', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-log-lut',
        duration: 2,
        colorCorrection: {
          inputColorSpace: 'slog2',
          lutPath: 'C:\\LUTs\\Cine Look.cube'
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const logFilter = 'lut3d=file=__LOG_LUT_slog2_clip_log_lut__';
    const userFilter = String.raw`lut3d=file=C\\:/LUTs/Cine Look.cube`;

    expect(plan.filterComplex).toContain(logFilter);
    expect(plan.filterComplex).toContain(userFilter);
    expect(plan.filterComplex.indexOf(logFilter)).toBeLessThan(plan.filterComplex.indexOf(userFilter));
    expect(plan.textArtifacts).toEqual([
      expect.objectContaining({
        clipId: 'clip-log-lut:input-color-space',
        fileName: 'log-slog2-clip_log_lut.cube',
        placeholder: '__LOG_LUT_slog2_clip_log_lut__',
        text: expect.stringContaining('LUT_3D_SIZE 17')
      })
    ]);
  });

  it('orders color filters as log conversion, user LUT, eq, hue, and color wheel', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-color-order',
        duration: 2,
        colorCorrection: {
          inputColorSpace: 'slog3',
          lutPath: 'D:\\Looks\\Warm.cube',
          brightness: 0.1,
          contrast: 1.2,
          saturation: 1.1,
          hue: 20,
          threeWayColor: {
            lift: { r: 0.2, g: 0, b: 0, intensity: 1 },
            gamma: { r: 0, g: 0, b: 0, intensity: 1 },
            gain: { r: 0, g: 0, b: 0, intensity: 1 }
          }
        }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;
    const logIndex = filter.indexOf('lut3d=file=__LOG_LUT_slog3_clip_color_order__');
    const userLutIndex = filter.indexOf(String.raw`lut3d=file=D\\:/Looks/Warm.cube`);
    const eqIndex = filter.indexOf('eq=brightness=0.1:contrast=1.2:saturation=1.1');
    const hueIndex = filter.indexOf('hue=h=20');
    const wheelIndex = filter.indexOf('colorbalance=rs=0.2');

    expect(logIndex).toBeGreaterThanOrEqual(0);
    expect(logIndex).toBeLessThan(userLutIndex);
    expect(userLutIndex).toBeLessThan(eqIndex);
    expect(eqIndex).toBeLessThan(hueIndex);
    expect(hueIndex).toBeLessThan(wheelIndex);
  });

  it('generates a temporary 1D LUT only for non-default curves', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-curves',
        duration: 2,
        colorCorrection: {
          colorCurves: {
            master: [
              { x: 0, y: 1 },
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
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('lut1d=file=__CURVE_LUT_clip_curves__');
    expect(plan.fullArgs.join(' ')).toContain('__CURVE_LUT_clip_curves__');
    expect(plan.textArtifacts).toEqual([
      expect.objectContaining({
        clipId: 'clip-curves:color-curves',
        fileName: 'curves-clip_curves.cube',
        placeholder: '__CURVE_LUT_clip_curves__',
        text: expect.stringContaining('LUT_1D_SIZE 17')
      })
    ]);

    const defaultPlan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));
    expect(defaultPlan.filterComplex).not.toContain('lut1d=file=');
  });

  it('generates colorbalance filters only for non-neutral three-way color', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-wheel',
        duration: 2,
        colorCorrection: {
          threeWayColor: {
            lift: { r: 0.2, g: 0, b: 0, intensity: 1 },
            gamma: { r: 0, g: 0, b: 0, intensity: 1 },
            gain: { r: 0, g: 0, b: 0, intensity: 1 }
          }
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('colorbalance=rs=0.2');

    const defaultPlan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));
    expect(defaultPlan.filterComplex).not.toContain('colorbalance=');
  });

  it('chains enabled clip effects after color correction and skips disabled effects', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-effects',
        duration: 2,
        colorCorrection: { brightness: 0.1 },
        effects: [
          { id: 'effect-blur', type: 'blur', enabled: true, params: { radius: 6 } },
          { id: 'effect-grain-disabled', type: 'film-grain', enabled: false, params: { strength: 1, size: 3 } },
          { id: 'effect-sharpen', type: 'sharpen', enabled: true, params: { strength: 1.5 } },
          { id: 'effect-chromatic', type: 'chromatic-aberration', enabled: true, params: { strength: 3 } }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const filter = plan.filterComplex;

    expect(filter).toContain('eq=brightness=0.1:contrast=1:saturation=1,gblur=sigma=6,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.5,rgbashift=rh=3:bh=-3');
    expect(filter).not.toContain('noise=alls=');
  });

  it('skips video restoration filters when every repair control is off', () => {
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('yadif=');
    expect(plan.filterComplex).not.toContain('hqdn3d=');
    expect(plan.filterComplex).not.toContain('nlmeans=');
  });

  it('skips quality enhancement filters when every enhancement control is off', () => {
    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(makeProject(), { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('scale=iw*2:ih*2:flags=lanczos');
    expect(plan.filterComplex).not.toContain('deblock=filter=strong:block=4');
    expect(plan.filterComplex).not.toContain('hue=s=1.2');
    expect(plan.filterComplex).not.toContain('minterpolate=fps=60:mi_mode=blend');
  });

  it('generates hqdn3d args for temporal denoise presets', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-temporal-denoise',
        videoRestoration: {
          deinterlace: { enabled: false, mode: 0 },
          temporalDenoise: { preset: 'high', lumaSpatial: 0, chromaSpatial: 0, lumaTmp: 0 },
          spatialDenoise: { enabled: false, strength: 1.5, patchSize: 7, researchSize: 15 }
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('hqdn3d=luma_spatial=6:chroma_spatial=4.5:luma_tmp=9');
  });

  it('generates yadif and nlmeans args for enabled restoration controls', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-spatial-denoise',
        videoRestoration: {
          deinterlace: { enabled: true, mode: 1 },
          temporalDenoise: { preset: 'off', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
          spatialDenoise: { enabled: true, strength: 3.5, patchSize: 5, researchSize: 13 }
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('yadif=mode=1');
    expect(plan.filterComplex).toContain('nlmeans=s=3.5:p=5:r=13');
  });

  it('generates super resolution quality enhancement args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-super-resolution',
        qualityEnhancement: { superResolution: true, deblock: false, colorBoost: false, frameCompensation: false }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;

    expect(filter).toContain('scale=iw*2:ih*2:flags=lanczos');
    expect(filter).toContain('unsharp=luma_msize_x=3:luma_amount=0.5');
  });

  it('generates deblock quality enhancement args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-deblock',
        qualityEnhancement: { superResolution: false, deblock: true, colorBoost: false, frameCompensation: false }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;

    expect(filter).toContain('deblock=filter=strong:block=4');
  });

  it('generates color boost quality enhancement args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-color-boost',
        qualityEnhancement: { superResolution: false, deblock: false, colorBoost: true, frameCompensation: false }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;

    expect(filter).toContain('hue=s=1.2');
    expect(filter).toContain('colorlevels');
  });

  it('generates frame compensation quality enhancement args', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-frame-compensation',
        qualityEnhancement: { superResolution: false, deblock: false, colorBoost: false, frameCompensation: true }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;

    expect(filter).toContain('minterpolate=fps=60:mi_mode=blend');
  });

  it('chains deinterlace, denoise, and sharpen in repair order before color correction effects', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-repair-order',
        colorCorrection: { brightness: 0.1 },
        videoRestoration: {
          deinterlace: { enabled: true, mode: 0 },
          temporalDenoise: { preset: 'custom', lumaSpatial: 5, chromaSpatial: 2.5, lumaTmp: 7 },
          spatialDenoise: { enabled: true, strength: 2, patchSize: 7, researchSize: 15 }
        },
        effects: [{ id: 'effect-sharpen', type: 'sharpen', enabled: true, params: { strength: 1.25 } }]
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;
    const yadifIndex = filter.indexOf('yadif=mode=0');
    const hqdn3dIndex = filter.indexOf('hqdn3d=luma_spatial=5:chroma_spatial=2.5:luma_tmp=7');
    const nlmeansIndex = filter.indexOf('nlmeans=s=2:p=7:r=15');
    const sharpenIndex = filter.indexOf('unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.25');

    expect(yadifIndex).toBeGreaterThan(-1);
    expect(hqdn3dIndex).toBeGreaterThan(yadifIndex);
    expect(nlmeansIndex).toBeGreaterThan(hqdn3dIndex);
    expect(sharpenIndex).toBeGreaterThan(nlmeansIndex);
  });

  it('chains quality enhancement controls in fixed order after restoration and before color correction', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-quality-order',
        colorCorrection: { brightness: 0.2 },
        videoRestoration: {
          deinterlace: { enabled: false, mode: 0 },
          temporalDenoise: { preset: 'medium', lumaSpatial: 4, chromaSpatial: 3, lumaTmp: 6 },
          spatialDenoise: { enabled: false, strength: 1.5, patchSize: 7, researchSize: 15 }
        },
        qualityEnhancement: { superResolution: true, deblock: true, colorBoost: true, frameCompensation: true }
      })
    ];

    const filter = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' })).filterComplex;
    const hqdn3dIndex = filter.indexOf('hqdn3d=luma_spatial=4:chroma_spatial=3:luma_tmp=6');
    const scaleIndex = filter.indexOf('scale=iw*2:ih*2:flags=lanczos');
    const unsharpIndex = filter.indexOf('unsharp=luma_msize_x=3:luma_amount=0.5');
    const deblockIndex = filter.indexOf('deblock=filter=strong:block=4');
    const hueIndex = filter.indexOf('hue=s=1.2');
    const colorlevelsIndex = filter.indexOf('colorlevels');
    const minterpolateIndex = filter.indexOf('minterpolate=fps=60:mi_mode=blend');
    const colorIndex = filter.indexOf('eq=brightness=0.2');

    expect(hqdn3dIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(hqdn3dIndex);
    expect(unsharpIndex).toBeGreaterThan(scaleIndex);
    expect(deblockIndex).toBeGreaterThan(unsharpIndex);
    expect(hueIndex).toBeGreaterThan(deblockIndex);
    expect(colorlevelsIndex).toBeGreaterThan(hueIndex);
    expect(minterpolateIndex).toBeGreaterThan(colorlevelsIndex);
    expect(colorIndex).toBeGreaterThan(minterpolateIndex);
  });

  it('generates motion blur temporal blend filters and optional camera jitter', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-motion-blur',
        effects: [{ id: 'effect-motion-blur', type: 'motion-blur', enabled: true, params: { intensity: 0.7, angle: 45, samples: 16, jitter: 0.35 } }]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('minterpolate=fps=90:mi_mode=blend');
    expect(plan.filterComplex).toContain('tblend=all_mode=average:all_opacity=0.7');
    expect(plan.filterComplex).toContain("crop=w='iw-");
    expect(plan.filterComplex).toContain('sin(n*12.9898)');
  });

  it('skips motion blur export filters when intensity is zero or the effect is disabled', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-no-motion-blur',
        effects: [
          { id: 'effect-motion-blur-zero', type: 'motion-blur', enabled: true, params: { intensity: 0, angle: 0, samples: 32, jitter: 1 } },
          { id: 'effect-motion-blur-disabled', type: 'motion-blur', enabled: false, params: { intensity: 1, angle: 0, samples: 32, jitter: 1 } }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('tblend=all_mode=average');
    expect(plan.filterComplex).not.toContain('sin(n*12.9898)');
  });

  it.each([
    [
      'bars',
      { style: 'bars', colorStart: '#22d3ee', colorEnd: '#f97316', height: 25, position: 'bottom', sensitivity: 1.2 },
      'showfreqs=s=1280x180:mode=bar:ascale=log:colors=0xffffff',
      "overlay=x=0:y='main_h-overlay_h'"
    ],
    [
      'waveform',
      { style: 'waveform', colorStart: '#ffaa00', colorEnd: '#00aaff', height: 50, position: 'top', sensitivity: 0.8 },
      'showwaves=s=1280x360:mode=line:colors=0xffffff',
      "overlay=x=0:y='0'"
    ],
    [
      'circular',
      { style: 'circular', colorStart: '#ffffff', colorEnd: '#22d3ee', height: 30, position: 'bottom', sensitivity: 2, mirror: true },
      'showfreqs=s=216x216:mode=bar:ascale=log:colors=0xffffff',
      "overlay=x=0:y='main_h-overlay_h'"
    ]
  ])('builds %s audio spectrum export filters over the final mix', (_style, params, expectedFilter, expectedOverlay) => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-spectrum',
        duration: 2,
        effects: [{ id: 'effect-spectrum', type: 'audio-spectrum', enabled: true, params }]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
    const filter = plan.filterComplex;

    expect(filter).toContain('[amixout]asplit=2[aout][spectrum_audio_0]');
    expect(filter).toContain(expectedFilter);
    expect(filter).toContain('split=2');
    expect(filter).toContain('colorchannelmixer=rr=');
    expect(filter).toContain("blend=all_expr='A*(1-Y/H)+B*(Y/H)'");
    expect(filter).toContain('colorkey=0x000000:0.08:0.12');
    expect(filter).toContain(expectedOverlay);
    expect(filter).toContain("enable='between(t,0,2)'");
    if (_style === 'circular') {
      expect(filter).toContain('crop=216:216');
      expect(filter).toContain('vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame');
      expect(filter).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lte(");
      expect(filter).toContain('vflip');
      expect(filter).toContain('overlay=x=0:y=0:format=auto[spectrum0]');
    }
    expect(plan.maps).toEqual(['-map', '[vout]', '-map', '[aout]']);
  });

  it.each([
    ['waveform-line', 'showwaves=s=1280x720:mode=line:colors=0xffffff', "overlay=x='0':y='0'"],
    ['spectrum-bars', 'showfreqs=s=1280x720:mode=bar:ascale=log:colors=0xffffff', "overlay=x='0':y='0'"],
    ['circular-spectrum', 'showfreqs=s=518x518:mode=bar:ascale=log:colors=0xffffff', "overlay=x='(main_w-overlay_w)/2':y='(main_h-overlay_h)/2'"]
  ])('builds %s audio visualization export filters and keeps the audio stream', (style, expectedFilter, expectedOverlay) => {
    const project = makeAudioVisualizationProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\audio-viz.mp4',
        settings: {
          outputMode: 'audio-visualization',
          format: 'mp4',
          width: 1280,
          height: 720,
          audioVisualization: {
            style: style as 'waveform-line' | 'spectrum-bars' | 'circular-spectrum',
            color: '#22d3ee',
            background: { type: 'solid', color: '#050816' }
          }
        }
      })
    );

    expect(plan.inputs).toEqual([expect.objectContaining({ path: 'D:/Media/voice.wav' })]);
    expect(plan.filterComplex).toContain('color=c=0x050816:s=1280x720:r=30:d=2,format=rgba[base0]');
    expect(plan.filterComplex).toContain('[amixout]asplit=2[aout][audio_visualization_mix]');
    expect(plan.filterComplex).toContain(expectedFilter);
    expect(plan.filterComplex).toContain("blend=all_expr='A*(1-Y/H)+B*(Y/H)'");
    expect(plan.filterComplex).toContain('colorkey=0x000000:0.08:0.12');
    expect(plan.filterComplex).toContain(expectedOverlay);
    if (style === 'circular-spectrum') {
      expect(plan.filterComplex).toContain('crop=518:518');
      expect(plan.filterComplex).toContain('vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame');
    }
    expect(plan.maps).toEqual(['-map', '[vout]', '-map', '[aout]']);
    expect(plan.outputArgs).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-c:a', 'aac']));
  });

  it('builds audio visualization over an image background input', () => {
    const project = makeAudioVisualizationProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\audio-viz.mp4',
        settings: {
          outputMode: 'audio-visualization',
          format: 'mp4',
          audioVisualization: {
            style: 'waveform-line',
            color: '#ffaa00',
            background: { type: 'image', path: 'D:\\Media\\cover.png' }
          }
        }
      })
    );

    expect(plan.inputs).toEqual([
      expect.objectContaining({ path: 'D:/Media/voice.wav' }),
      expect.objectContaining({ path: 'D:/Media/cover.png', args: ['-loop', '1', '-t', '2'] })
    ]);
    expect(plan.filterComplex).toContain('[1:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,format=rgba[base0]');
    expect(plan.filterComplex).toContain('showwaves=s=1280x720:mode=line:colors=0xffffff');
    expect(plan.filterComplex).toContain('colorchannelmixer=rr=1:gg=0.667:bb=0');
    expect(plan.filterComplex).toContain("[base0][audio_visualization_layer]overlay=x='0':y='0':eval=frame[base1]");
    expect(plan.fullArgs).toEqual(expect.arrayContaining(['-map', '[vout]', '-map', '[aout]']));
  });

  it('builds audio visualization over a normalized gradient background', () => {
    const project = makeAudioVisualizationProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\audio-viz.mp4',
        settings: {
          outputMode: 'audio-visualization',
          format: 'mp4',
          audioVisualization: {
            style: 'waveform-line',
            color: '#abc',
            background: { type: 'gradient', color: '#abc', color2: '#abc' }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain("color=c=0xaabbcc:s=1280x720:r=30:d=2,format=rgba,geq=r='170':g='187':b='204':a='255'[base0]");
    expect(plan.filterComplex).toContain('showwaves=s=1280x720:mode=line:colors=0xffffff');
    expect(plan.filterComplex).toContain('colorchannelmixer=rr=0.667:gg=0.733:bb=0.8');
  });

  it('expands audio visualization themes into export filter arguments', () => {
    const project = makeAudioVisualizationProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\audio-viz.mp4',
        settings: {
          outputMode: 'audio-visualization',
          format: 'mp4',
          audioVisualization: {
            style: 'spectrum-bars',
            color: '#22d3ee',
            themeId: 'retro-vu',
            background: { type: 'solid', color: '#050816' }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('color=c=0x02130a:s=1280x720:r=30:d=2,format=rgba[base0]');
    expect(plan.filterComplex).toContain('showfreqs=s=1280x720:mode=bar:ascale=log:colors=0xffffff');
    expect(plan.filterComplex).toContain('colorchannelmixer=rr=0.251:gg=0.839:bb=0.314');
    expect(plan.filterComplex).toContain('colorchannelmixer=rr=0.98:gg=0.8:bb=0.082');
    expect(plan.filterComplex).toContain('drawbox=x=0:y=0:w=iw:h=ih:color=0x7ddc63@0.85:t=3');
  });

  it('falls back to default audio visualization settings for invalid custom values', () => {
    const project = makeAudioVisualizationProject();
    const plan = buildFfmpegExportPlan(
      buildExportProjectFromProject(project, {
        outputPath: 'D:\\Exports\\audio-viz.mp4',
        settings: {
          outputMode: 'audio-visualization',
          format: 'mp4',
          audioVisualization: {
            style: 'invalid-style' as never,
            color: 'not-a-color',
            background: { type: 'solid', color: 'bad-color' }
          }
        }
      })
    );

    expect(plan.filterComplex).toContain('color=c=0x050816:s=1280x720:r=30:d=2,format=rgba[base0]');
    expect(plan.filterComplex).toContain('showwaves=s=1280x720:mode=line:colors=0xffffff');
    expect(plan.filterComplex).toContain('colorchannelmixer=rr=0.133:gg=0.827:bb=0.933');
  });

  it('does not generate audio spectrum filters for disabled or zero-height spectrum effects', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-no-spectrum',
        duration: 2,
        effects: [
          { id: 'effect-spectrum-disabled', type: 'audio-spectrum', enabled: false, params: { height: 25 } },
          { id: 'effect-spectrum-zero', type: 'audio-spectrum', enabled: true, params: { height: 0 } }
        ]
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('showfreqs=');
    expect(plan.filterComplex).not.toContain('showwaves=');
    expect(plan.filterComplex).not.toContain('spectrum_audio_0');
  });

  it('chains atempo filters for speeds outside ffmpeg single-filter bounds', () => {
    expect(buildAtempoFilters(0.25)).toEqual(['atempo=0.5', 'atempo=0.5']);
    expect(buildAtempoFilters(3)).toEqual(['atempo=2.0', 'atempo=1.5']);
    expect(buildAtempoFilters(1)).toEqual([]);
  });

  it('uses source duration for inputs and setpts/atempo for clip speed', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-speed', duration: 0.75, speed: 2 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '1.5']);
    expect(plan.filterComplex).toContain('[0:v]trim=start=0:duration=1.5,setpts=(PTS-STARTPTS)/2+0/TB');
    expect(plan.filterComplex).toContain('[0:a:0]atrim=start=0:duration=1.5,asetpts=PTS-STARTPTS,atempo=2.0');
    expect(plan.duration).toBe(0.75);
  });

  it('builds segmented setpts expressions for speed keyframes', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-speed-ramp',
        duration: 1,
        speed: 1,
        keyframes: {
          speed: [
            { id: 'speed-a', time: 0, value: 1, easing: 'linear' },
            { id: 'speed-b', time: 0.5, value: 2, easing: 'linear' },
            { id: 'speed-c', time: 1, value: 1, easing: 'linear' }
          ]
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs[0].args).toEqual(['-ss', '0', '-t', '1.5']);
    expect(plan.filterComplex).toContain("setpts='(if(lte(((PTS-STARTPTS)*TB),0.75)");
    expect(plan.filterComplex).toContain("if(lte(((PTS-STARTPTS)*TB),1.5)");
    expect(plan.filterComplex).toContain('/1.5');
    expect(plan.duration).toBe(1);
  });

  it('falls back to average speed and warns when speed ramp setpts exceeds the expression limit', () => {
    const project = makeProject();
    const speedFrames = Array.from({ length: 120 }, (_, index) => ({
      id: `speed-${index}`,
      time: index / 30,
      value: index % 2 === 0 ? 1 : 2,
      easing: 'linear' as const
    }));
    project.timeline.tracks[0].clips = [
      makeVideoClip({
        id: 'clip-long-speed-ramp',
        duration: 4,
        speed: 1,
        keyframes: { speed: speedFrames }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.warnings).toContain('Speed ramp setpts for clip clip-long-speed-ramp exceeded 4096 characters and fell back to average speed.');
    expect(plan.filterComplex).toContain('setpts=(PTS-STARTPTS)/');
    expect(plan.filterComplex).not.toContain("vclip_long_speed_ramp],setpts='");
  });

  it('multiplies clip audio volume by track volume', () => {
    const project = makeProject();
    project.timeline.tracks[0].volume = 0.5;
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-track-volume', duration: 2, volume: 0.8 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('volume=0.4');
  });

  it('adds track pan after combined clip and track volume', () => {
    const project = makeProject();
    project.timeline.tracks[0].volume = 0.5;
    project.timeline.tracks[0].pan = -1;
    project.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-track-pan', duration: 2, volume: 0.8 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('adelay=0:all=1,volume=0.4,stereopan=pan=-1,aformat=channel_layouts=stereo');
  });

  it('adds clip audio channel routing filters and skips the normal default', () => {
    const expectations = [
      ['mono-left', 'pan=stereo|c0=c0|c1=0*c0'],
      ['mono-right', 'pan=stereo|c0=0*c0|c1=c0'],
      ['mono-both', 'pan=stereo|c0=c0|c1=c0'],
      ['swap-stereo', 'pan=stereo|c0=c1|c1=c0'],
      ['stereo-left-mono', 'pan=stereo|c0=c0|c1=c0'],
      ['stereo-right-mono', 'pan=stereo|c0=c1|c1=c1'],
      ['stereo-to-mono', 'pan=mono|c0=0.5*c0+0.5*c1']
    ] as const;

    for (const [mode, expectedFilter] of expectations) {
      const project = makeProject();
      project.timeline.tracks[0].clips = [makeVideoClip({ id: `clip-${mode}`, duration: 2, audioChannelRouting: mode })];

      const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

      expect(plan.filterComplex).toContain(expectedFilter);
    }

    const defaultProject = makeProject();
    defaultProject.timeline.tracks[0].clips = [makeVideoClip({ id: 'clip-normal', duration: 2, audioChannelRouting: 'normal' })];

    const defaultPlan = buildFfmpegExportPlan(buildExportProjectFromProject(defaultProject, { outputPath: 'out.mp4' }));

    expect(defaultPlan.filterComplex).not.toContain('pan=');
  });

  it('adds enabled track EQ bands and compressor filters to audio export', () => {
    const project = makeProject();
    project.timeline.tracks[0].eq = {
      enabled: true,
      bands: [
        { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: 3, q: 0.7 },
        { id: 'eq-low-mid', type: 'peaking', frequency: 400, gain: -2, q: 1.1 },
        { id: 'eq-high-mid', type: 'peaking', frequency: 2500, gain: 0, q: 1 },
        { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 1.5, q: 0.8 }
      ]
    };
    project.timeline.tracks[0].compressor = { enabled: true, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 };

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('equalizer=f=100:width_type=o:width=0.7:g=3');
    expect(plan.filterComplex).toContain('equalizer=f=400:width_type=o:width=1.1:g=-2');
    expect(plan.filterComplex).toContain('equalizer=f=8000:width_type=o:width=0.8:g=1.5');
    expect(plan.filterComplex).not.toContain('equalizer=f=2500:width_type=o:width=1:g=0');
    expect(plan.filterComplex).toContain('acompressor=threshold=0.063:ratio=4:attack=12:release=180:makeup=1.995');
  });

  it('skips disabled track EQ and compressor filters', () => {
    const project = makeProject();
    project.timeline.tracks[0].eq = {
      enabled: false,
      bands: [
        { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: 6, q: 0.7 },
        { id: 'eq-low-mid', type: 'peaking', frequency: 400, gain: 6, q: 1 },
        { id: 'eq-high-mid', type: 'peaking', frequency: 2500, gain: 6, q: 1 },
        { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 6, q: 0.7 }
      ]
    };
    project.timeline.tracks[0].compressor = { enabled: false, threshold: -24, ratio: 4, attack: 12, release: 180, makeupGain: 6 };

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('equalizer=');
    expect(plan.filterComplex).not.toContain('acompressor=');
  });

  it('builds nested sequence export plans before the main sequence input', () => {
    const project = makeProject();
    const nestedClip = createNestedSequenceClip({
      id: 'clip-nested',
      type: 'nested-sequence',
      name: 'Nested A',
      trackId: 'track-video',
      sequenceId: 'sequence-a',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0
    });
    project.timeline.tracks[0].clips = [nestedClip];
    project.sequences = [
      createSequence({ id: 'sequence-main', name: 'Main Sequence', timeline: project.timeline }),
      createSequence({
        id: 'sequence-a',
        name: 'Nested A',
        timeline: {
          tracks: [createTrack({ id: 'track-nested-video', type: 'video', name: 'Nested Video', clips: [makeVideoClip({ id: 'nested-source', duration: 2 })] })],
          transitions: []
        }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs[0].path).toBe('__NESTED_SEQUENCE_sequence_a__.mp4');
    expect(plan.nestedPlans).toHaveLength(1);
    expect(plan.nestedPlans[0].sequenceId).toBe('sequence-a');
    expect(plan.nestedPlans[0].placeholder).toBe('__NESTED_SEQUENCE_sequence_a__.mp4');
    expect(plan.nestedPlans[0].plan.fullArgs.at(-1)).toBe('__NESTED_SEQUENCE_sequence_a__.mp4');
    expect(plan.duration).toBe(2);
  });

  it('flattens multicam sequences to direct angle clips for export', () => {
    const project = makeProject();
    project.media.push({
      id: 'asset-b',
      type: 'video',
      name: 'camera-b.mp4',
      path: 'D:\\Media\\camera-b.mp4',
      duration: 20,
      width: 1920,
      height: 1080,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 48000
    });
    project.timeline.tracks = [
      createTrack({ id: 'track-a', type: 'video', name: 'Camera A', clips: [makeVideoClip({ id: 'clip-a', trackId: 'track-a', mediaId: 'asset-1', duration: 4 })] }),
      createTrack({ id: 'track-b', type: 'video', name: 'Camera B', clips: [makeVideoClip({ id: 'clip-b', trackId: 'track-b', mediaId: 'asset-b', duration: 4 })] })
    ];
    const multicamProject = createMulticamSequenceProject(project, ['clip-a', 'clip-b'], { sequenceName: 'Multicam' }).project;
    const multicamClip = multicamProject.timeline.tracks[0].clips[0];
    if (multicamClip.type !== 'nested-sequence' || !multicamClip.multicam) {
      throw new Error('Expected multicam nested clip');
    }
    multicamClip.multicam.switches = [
      { id: 'switch-0', time: 0, angleId: multicamClip.multicam.angles[0].id },
      { id: 'switch-1', time: 2, angleId: multicamClip.multicam.angles[1].id }
    ];

    const exportProject = buildExportProjectFromProject(multicamProject, { outputPath: 'out.mp4' });
    const plan = buildFfmpegExportPlan(exportProject);

    expect(exportProject.timeline.tracks).toHaveLength(2);
    expect(exportProject.timeline.tracks[0].clips.map((clip) => clip.type)).toEqual(['video', 'video']);
    expect(exportProject.timeline.tracks[1].clips).toEqual([]);
    expect(plan.inputs.map((input) => input.path)).toEqual(['C:/Videos/sample.mp4', 'D:/Media/camera-b.mp4']);
    expect(plan.nestedPlans).toHaveLength(0);
    expect(plan.fullArgs.join(' ')).not.toContain('__NESTED_SEQUENCE_');
  });

  it('warns when nested sequence export depth exceeds the limit', () => {
    const project = makeProject();
    const makeNestedClip = (id: string, sequenceId: string) =>
      createNestedSequenceClip({
        id,
        type: 'nested-sequence',
        name: sequenceId,
        trackId: `track-${id}`,
        sequenceId,
        start: 0,
        duration: 1,
        trimStart: 0,
        trimEnd: 0
      });
    project.timeline.tracks[0].clips = [makeNestedClip('main-nested', 'sequence-a')];
    project.sequences = [
      createSequence({ id: 'sequence-main', name: 'Main Sequence', timeline: project.timeline }),
      createSequence({ id: 'sequence-a', name: 'A', timeline: { tracks: [createTrack({ id: 'track-a', type: 'video', name: 'A', clips: [makeNestedClip('a-nested', 'sequence-b')] })] } }),
      createSequence({ id: 'sequence-b', name: 'B', timeline: { tracks: [createTrack({ id: 'track-b', type: 'video', name: 'B', clips: [makeNestedClip('b-nested', 'sequence-c')] })] } }),
      createSequence({ id: 'sequence-c', name: 'C', timeline: { tracks: [createTrack({ id: 'track-c', type: 'video', name: 'C', clips: [makeNestedClip('c-nested', 'sequence-d')] })] } }),
      createSequence({
        id: 'sequence-d',
        name: 'D',
        timeline: { tracks: [createTrack({ id: 'track-d', type: 'video', name: 'D', clips: [makeVideoClip({ id: 'leaf-video', trackId: 'track-d', duration: 1 })] })] }
      })
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(JSON.stringify(plan)).toContain('exceeds maximum depth 3');
  });

  it('omits stereopan for centered tracks', () => {
    const project = makeProject();
    project.timeline.tracks[0].pan = 0;

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).not.toContain('stereopan=');
  });

  it('adds master volume to the final mixed output node', () => {
    const project = makeProject();
    project.masterVolume = 0.25;

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('amix=inputs=1:duration=longest:normalize=0');
    expect(plan.filterComplex).toContain('aresample=44100,volume=0.25[aout]');
  });

  it('adds master volume to generated silent output', () => {
    const project = makeProject();
    project.masterVolume = 0.5;
    project.timeline.tracks.forEach((track) => {
      track.clips = [];
    });
    project.timeline.tracks[2].clips = [makeTextClip({ id: 'silent-master-text', duration: 2 })];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('anullsrc=channel_layout=stereo:sample_rate=44100:d=2,volume=0.5[aout]');
  });

  it('excludes muted tracks from export inputs and uses silent audio when no audio clips remain', () => {
    const project = makeProject();
    project.timeline.tracks[0].muted = true;

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(0);
    expect(plan.filterComplex).toContain('anullsrc=channel_layout=stereo');
  });

  it('exports only solo tracks when any track is soloed', () => {
    const project = makeProject();
    project.timeline.tracks[0].solo = true;
    project.timeline.tracks[1].clips = [
      {
        id: 'clip-audio',
        type: 'audio',
        name: 'voice.wav',
        mediaId: 'asset-1',
        trackId: 'track-audio',
        start: 0,
        duration: 2,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        volume: 1
      }
    ];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(1);
    expect(plan.inputs[0].path).toBe('C:/Videos/sample.mp4');
    expect(plan.filterComplex).toContain('[0:a:0]');
    expect(plan.filterComplex).not.toContain('[1:a:0]');
  });

  it('builds dissolve xfade filters for adjacent video clip transitions', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-b', start: 2, duration: 2 })
    ];
    project.timeline.transitions = [{ id: 'transition-1', type: 'dissolve', duration: 0.5, fromClipId: 'clip-a', toClipId: 'clip-b' }];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.inputs).toHaveLength(2);
    expect(plan.filterComplex).toContain('xfade=transition=dissolve:duration=0.5:offset=1.5');
    expect(plan.filterComplex).toContain('setpts=PTS-STARTPTS+0/TB[xfadetransition_1]');
    expect(plan.filterComplex).toContain("enable='between(t,0,3.5)'");
    expect(plan.duration).toBe(3.5);
    expect(plan.outputArgs).toContain('3.5');
  });

  it('builds fade-black xfade filters for adjacent video clip transitions', () => {
    const project = makeProject();
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-b', start: 2, duration: 2 })
    ];
    project.timeline.transitions = [{ id: 'transition-fade', type: 'fade-black', duration: 0.25, fromClipId: 'clip-a', toClipId: 'clip-b' }];

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('xfade=transition=fadeblack:duration=0.25:offset=1.75');
    expect(plan.duration).toBe(3.75);
  });

  it('warns and falls back when a transition cannot be rendered as one visual segment', () => {
    const audioProject = makeProject();
    audioProject.media.push({
      id: 'audio-asset',
      type: 'audio',
      name: 'voice.wav',
      path: 'C:\\Audio\\voice.wav',
      duration: 4,
      width: 0,
      height: 0
    });
    audioProject.timeline.tracks[0].clips = [];
    audioProject.timeline.tracks[1].clips = [
      {
        id: 'audio-a',
        type: 'audio',
        name: 'A',
        mediaId: 'audio-asset',
        trackId: 'track-audio',
        start: 0,
        duration: 2,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        volume: 1
      },
      {
        id: 'audio-b',
        type: 'audio',
        name: 'B',
        mediaId: 'audio-asset',
        trackId: 'track-audio',
        start: 2,
        duration: 2,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        volume: 1
      }
    ];
    audioProject.timeline.transitions = [{ id: 'audio-transition', type: 'dissolve', duration: 0.5, fromClipId: 'audio-a', toClipId: 'audio-b' }];

    const audioPlan = buildFfmpegExportPlan(buildExportProjectFromProject(audioProject, { outputPath: 'out.mp4' }));
    expect(audioPlan.warnings).toContain('Transition audio-transition was skipped because both clips must be visual media clips.');

    const chainedProject = makeProject();
    chainedProject.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-b', start: 2, duration: 2 }),
      makeVideoClip({ id: 'clip-c', start: 4, duration: 2 })
    ];
    chainedProject.timeline.transitions = [
      { id: 'transition-ab', type: 'dissolve', duration: 0.5, fromClipId: 'clip-a', toClipId: 'clip-b' },
      { id: 'transition-bc', type: 'dissolve', duration: 0.5, fromClipId: 'clip-b', toClipId: 'clip-c' }
    ];
    const chainedPlan = buildFfmpegExportPlan(buildExportProjectFromProject(chainedProject, { outputPath: 'out.mp4' }));
    expect(chainedPlan.warnings).toContain('Transition transition-bc was skipped because chained transitions are not yet supported in one export segment.');

    const missingInputProject = makeProject();
    missingInputProject.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'clip-a', start: 0, duration: 2 }),
      makeVideoClip({ id: 'clip-b', mediaId: 'missing-asset', start: 2, duration: 2 })
    ];
    missingInputProject.timeline.transitions = [{ id: 'transition-missing', type: 'dissolve', duration: 0.5, fromClipId: 'clip-a', toClipId: 'clip-b' }];
    const missingInputPlan = buildFfmpegExportPlan(buildExportProjectFromProject(missingInputProject, { outputPath: 'out.mp4' }));
    expect(missingInputPlan.warnings).toContain('Transition transition-missing was skipped because one of its clips has no media input.');
  });
});

function buildKenBurnsScalePlan({ scaleXEnd, scaleYEnd }: { scaleXEnd: number; scaleYEnd: number }) {
  const project = makeProject();
  project.media = [
    {
      id: 'asset-ken-burns-scale',
      type: 'image',
      name: 'ken-burns-scale.png',
      path: 'D:\\Media\\ken-burns-scale.png',
      duration: 0,
      width: 640,
      height: 360
    }
  ];
  project.timeline.tracks[0].clips = [
    {
      id: 'clip-ken-burns-scale',
      type: 'image',
      name: 'Ken Burns scale',
      mediaId: 'asset-ken-burns-scale',
      trackId: 'track-video',
      start: 0,
      duration: 2,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      kenBurns: true,
      keyframes: {
        scaleX: [
          { id: 'kb-test-sx-start', time: 0, value: 1, easing: 'linear' },
          { id: 'kb-test-sx-end', time: 2, value: scaleXEnd, easing: 'linear' }
        ],
        scaleY: [
          { id: 'kb-test-sy-start', time: 0, value: 1, easing: 'linear' },
          { id: 'kb-test-sy-end', time: 2, value: scaleYEnd, easing: 'linear' }
        ]
      }
    }
  ];

  return buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));
}

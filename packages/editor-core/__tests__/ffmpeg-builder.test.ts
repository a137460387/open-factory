import { describe, expect, it } from 'vitest';
import { buildAtempoFilters, buildExportProjectFromProject, buildFfmpegExportPlan, createTrack, type Clip } from '../src';
import { makeProject, makeSubtitleClip, makeTextClip, makeVideoClip } from './test-utils';

describe('multitrack ffmpeg builder', () => {
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
      drawtextWarning: 'drawtext missing'
    });

    expect(plan.textArtifacts).toHaveLength(0);
    expect(plan.warnings).toContain('drawtext missing');
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

  it('burns subtitle clips in with a temporary SRT artifact and force style', () => {
    const project = makeProject();
    project.timeline.tracks.push(
      createTrack({
        id: 'track-subtitle',
        type: 'subtitle',
        name: 'Subtitles 1',
        clips: [
          makeSubtitleClip({ id: 'subtitle-a', start: 0.5, duration: 1.5, text: 'Hello subtitles' }),
          makeSubtitleClip({ id: 'subtitle-b', start: 2.5, duration: 1, text: 'Second line' })
        ]
      })
    );

    const plan = buildFfmpegExportPlan(buildExportProjectFromProject(project, { outputPath: 'out.mp4' }));

    expect(plan.filterComplex).toContain('subtitles=filename=__SUBTITLEFILE_export_subtitles__');
    expect(plan.filterComplex).toContain("force_style='FontSize=42,PrimaryColour=&Hffffff&");
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
    expect(plan.filterComplex).toContain("overlay=x='(main_w-overlay_w)/2+10':y='(main_h-overlay_h)/2+-20'");
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
    expect(plan.filterComplex).toContain('alpha=0.8');
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

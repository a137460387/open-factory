import { describe, expect, it } from 'vitest';
import { buildMediaPrecheckResult, detectAudioVideoSyncIssue, detectColorSpacePrecheckIssue, parseFfprobePrecheckError } from '../src';

describe('media precheck', () => {
  it('flags audio and video duration drift greater than 0.5 seconds', () => {
    const issue = detectAudioVideoSyncIssue({
      format: { duration: 10 },
      videoStreams: [{ codecName: 'h264', duration: 10 }],
      audioStreams: [{ codecName: 'aac', duration: 10.75 }]
    });

    expect(issue).toMatchObject({
      type: 'av-sync',
      severity: 'warning',
      videoDuration: 10,
      audioDuration: 10.75,
      deltaSeconds: 0.75
    });
    expect(
      detectAudioVideoSyncIssue({
        format: { duration: 10 },
        videoStreams: [{ codecName: 'h264', duration: 10 }],
        audioStreams: [{ codecName: 'aac', duration: 10.5 }]
      })
    ).toBeUndefined();
  });

  it('flags HDR media in an SDR project', () => {
    expect(
      detectColorSpacePrecheckIssue(
        {
          videoStreams: [{ codecName: 'hevc', colorPrimaries: 'bt2020', colorTransfer: 'smpte2084', colorSpace: 'bt2020nc', hdrMetadata: ['Mastering display metadata'] }],
          audioStreams: []
        },
        'sdr'
      )
    ).toMatchObject({ type: 'hdr-sdr', severity: 'warning' });
    expect(
      detectColorSpacePrecheckIssue(
        {
          videoStreams: [{ codecName: 'hevc', colorPrimaries: 'bt2020', colorTransfer: 'smpte2084' }],
          audioStreams: []
        },
        'hdr'
      )
    ).toBeUndefined();
  });

  it('parses ffprobe errors into actionable categories', () => {
    expect(parseFfprobePrecheckError('Unknown decoder h265')).toMatchObject({ category: 'unsupported-codec' });
    expect(parseFfprobePrecheckError('moov atom not found')).toMatchObject({ category: 'invalid-data' });
    expect(parseFfprobePrecheckError('No such file or directory')).toMatchObject({ category: 'missing-file' });
    expect(parseFfprobePrecheckError('Access is denied')).toMatchObject({ category: 'permission' });
    expect(parseFfprobePrecheckError('unexpected stderr')).toMatchObject({ category: 'unknown' });
  });

  it('summarizes passing media and codec warnings', () => {
    const passing = buildMediaPrecheckResult({
      asset: { id: 'ok', name: 'ok.mp4', path: 'C:/Media/ok.mp4', type: 'video' },
      analysis: {
        videoStreams: [{ codecName: 'h264', duration: 4 }],
        audioStreams: [{ codecName: 'aac', duration: 4 }]
      }
    });
    const warning = buildMediaPrecheckResult({
      asset: { id: 'codec', name: 'codec.mp4', path: 'C:/Media/codec.mp4', type: 'video' },
      analysis: {
        videoStreams: [{ duration: 4 }],
        audioStreams: [{ codecName: 'aac', duration: 4 }]
      }
    });

    expect(passing).toMatchObject({ status: 'pass', issues: [] });
    expect(warning.status).toBe('warning');
    expect(warning.issues[0]).toMatchObject({ type: 'codec', severity: 'warning', details: 'video' });
    expect(detectAudioVideoSyncIssue({ videoStreams: [], audioStreams: [{ codecName: 'aac', duration: 4 }] })).toBeUndefined();
  });

  it('summarizes ffprobe and ffmpeg scan errors as failed media rows', () => {
    const ffprobe = buildMediaPrecheckResult({
      asset: { id: 'bad-probe', name: 'bad.mov', path: 'C:/Media/bad.mov', type: 'video' },
      ffprobeError: 'Invalid data found when processing input'
    });
    const integrity = buildMediaPrecheckResult({
      asset: { id: 'bad-scan', name: 'bad-scan.mov', path: 'C:/Media/bad-scan.mov', type: 'video' },
      analysis: {
        videoStreams: [{ codecName: 'h264', duration: 4 }],
        audioStreams: [{ codecName: 'aac', duration: 4 }]
      },
      integrityErrorOutput: 'error while decoding MB 12'
    });

    expect(ffprobe.status).toBe('error');
    expect(ffprobe.issues[0]).toMatchObject({ type: 'ffprobe-error', severity: 'error', ffprobeError: { category: 'invalid-data' } });
    expect(integrity.status).toBe('error');
    expect(integrity.issues[0]).toMatchObject({ type: 'integrity', severity: 'error' });
  });
});

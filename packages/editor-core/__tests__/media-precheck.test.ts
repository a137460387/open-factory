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

  it('flags file header mismatch when MP4 file contains WAV data', () => {
    const wavHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    const sniff = sniffFileHeader(wavHeader, 'fake.mp4');
    const result = buildMediaPrecheckResult({
      asset: { id: 'sniff', name: 'fake.mp4', path: 'C:/Media/fake.mp4', type: 'video' },
      analysis: { videoStreams: [], audioStreams: [{ codecName: 'pcm_s16le', duration: 5 }] },
      fileSniff: sniff
    });
    expect(result.status).toBe('warning');
    expect(result.issues.some((i) => i.type === 'file-header-mismatch')).toBe(true);
  });

  it('marks forced import as warning status', () => {
    const result = buildMediaPrecheckResult({
      asset: { id: 'forced', name: 'forced.mp4', path: 'C:/Media/forced.mp4', type: 'video' },
      ffprobeError: 'Invalid data found when processing input',
      forcedImport: true
    });
    expect(result.status).toBe('warning');
    expect(result.issues.some((i) => i.type === 'file-header-mismatch' && i.details === 'force-imported')).toBe(true);
  });

  it('three-state logic: pass for matching header, warning for mismatch, error for ffprobe failure', () => {
    const mp4Header = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const pass = buildMediaPrecheckResult({
      asset: { id: 'a', name: 'a.mp4', path: '/a.mp4', type: 'video' },
      analysis: { videoStreams: [{ codecName: 'h264', duration: 3 }], audioStreams: [{ codecName: 'aac', duration: 3 }] },
      fileSniff: sniffFileHeader(mp4Header, 'a.mp4')
    });
    expect(pass.status).toBe('pass');

    const wavHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    const warn = buildMediaPrecheckResult({
      asset: { id: 'b', name: 'b.mp4', path: '/b.mp4', type: 'video' },
      analysis: { videoStreams: [], audioStreams: [{ codecName: 'pcm_s16le', duration: 3 }] },
      fileSniff: sniffFileHeader(wavHeader, 'b.mp4')
    });
    expect(warn.status).toBe('warning');

    const err = buildMediaPrecheckResult({
      asset: { id: 'c', name: 'c.mp4', path: '/c.mp4', type: 'video' },
      ffprobeError: 'moov atom not found'
    });
    expect(err.status).toBe('error');
  });
});
import { sniffFileHeader } from '../src/media-file-sniff';

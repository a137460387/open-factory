import { useMemo, useState } from 'react';
import {
  buildExportProjectFromProject,
  buildFfmpegCurrentFrameExportPlan,
  buildThumbnailExportSettings,
  buildThumbnailOutputFileName,
  buildThumbnailOutputPath,
  buildThumbnailSampleTimestamps,
  createId,
  createProject,
  createTrack,
  getThumbnailPlatformSize,
  rankThumbnailCandidates,
  scoreThumbnailFrame,
  type Clip,
  type MediaAsset,
  type Project,
  type ThumbnailCandidate,
  type ThumbnailFrameSample,
  type ThumbnailPlatformPreset,
  type Track
} from '@open-factory/editor-core';
import { Check, ImageDown, Loader2, X } from 'lucide-react';
import { createClipFromAsset, createTextClip } from '../lib/clipFactory';
import { getFfmpegCapabilities, detectPrivacyRegions, convertLocalFileSrc, openDirectoryDialog, runExport, saveFileDialog } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { zhCN } from '../i18n/strings';
import { usePrivacyDetectionSettingsStore } from '../store/privacyDetectionSettingsStore';

interface ThumbnailGeneratorDialogProps {
  project: Project;
  initialAssetIds?: string[];
  onClose(): void;
}

interface CandidateView extends ThumbnailCandidate {
  id: string;
  dataUrl: string;
  asset: MediaAsset;
}

const SAMPLE_WIDTH = 96;
const SAMPLE_HEIGHT = 54;
const PREVIEW_WIDTH = 320;

export function ThumbnailGeneratorDialog({ project, initialAssetIds = [], onClose }: ThumbnailGeneratorDialogProps) {
  const t = zhCN.thumbnailGenerator;
  const modelPath = usePrivacyDetectionSettingsStore((state) => state.modelPath);
  const videoAssets = useMemo(() => project.media.filter((asset) => asset.type === 'video' && !asset.missing), [project.media]);
  const initialVideos = useMemo(() => {
    const ids = new Set(initialAssetIds);
    return ids.size > 0 ? videoAssets.filter((asset) => ids.has(asset.id)) : [];
  }, [initialAssetIds, videoAssets]);
  const timelineAssetId = useMemo(() => findTimelineVideoAssetId(project), [project]);
  const [assetId, setAssetId] = useState(initialVideos[0]?.id ?? timelineAssetId ?? videoAssets[0]?.id ?? '');
  const [platform, setPlatform] = useState<ThumbnailPlatformPreset>('youtube');
  const [crop, setCrop] = useState(true);
  const [titleText, setTitleText] = useState('');
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState<'analyze' | 'export' | 'batch'>();
  const [status, setStatus] = useState<string>();
  const activeAsset = videoAssets.find((asset) => asset.id === assetId) ?? videoAssets[0];
  const batchAssets = initialVideos.length > 0 ? initialVideos : activeAsset ? [activeAsset] : [];
  const size = getThumbnailPlatformSize(platform);

  const analyze = async () => {
    if (!activeAsset) {
      setStatus(t.noVideo);
      return;
    }
    setBusy('analyze');
    setStatus(t.analyzing);
    try {
      const nextCandidates = await analyzeThumbnailCandidates({
        asset: activeAsset,
        platform,
        crop,
        titleText,
        modelPath
      });
      setCandidates(nextCandidates);
      setSelectedId(nextCandidates[0]?.id);
      setStatus(t.candidateCount(nextCandidates.length));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.analyzeFailedMessage);
      showToast({ kind: 'error', title: t.analyzeFailed, message: error instanceof Error ? error.message : t.analyzeFailedMessage });
    } finally {
      setBusy(undefined);
    }
  };

  const exportSelected = async () => {
    const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];
    if (!selected) {
      setStatus(t.selectCandidateFirst);
      return;
    }
    const outputPath = await saveFileDialog(buildThumbnailOutputFileName(selected.asset.name).replace(/\.jpg$/i, '.png'), [
      { name: t.pngFilter, extensions: ['png'] },
      { name: t.jpegFilter, extensions: ['jpg', 'jpeg'] }
    ]);
    if (!outputPath) {
      return;
    }
    setBusy('export');
    setStatus(t.exporting);
    try {
      await exportThumbnailFrame({
        baseProject: project,
        asset: selected.asset,
        outputPath,
        time: selected.timestamp,
        platform,
        crop,
        titleText
      });
      setStatus(t.exported(outputPath));
      showToast({ kind: 'success', title: t.exportedTitle, message: t.exported(outputPath) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.exportFailedMessage);
      showToast({ kind: 'error', title: t.exportFailed, message: error instanceof Error ? error.message : t.exportFailedMessage });
    } finally {
      setBusy(undefined);
    }
  };

  const exportBatch = async () => {
    if (batchAssets.length === 0) {
      setStatus(t.noVideo);
      return;
    }
    const directory = await openDirectoryDialog();
    if (!directory) {
      return;
    }
    setBusy('batch');
    setStatus(t.batchRunning(0, batchAssets.length));
    try {
      let completed = 0;
      for (const asset of batchAssets) {
        const topCandidate = (
          await analyzeThumbnailCandidates({
            asset,
            platform,
            crop,
            titleText,
            modelPath
          })
        )[0];
        const outputPath = buildThumbnailOutputPath(directory, asset.name);
        await exportThumbnailFrame({
          baseProject: project,
          asset,
          outputPath,
          time: topCandidate?.timestamp ?? 0,
          platform,
          crop,
          titleText
        });
        completed += 1;
        setStatus(t.batchRunning(completed, batchAssets.length));
      }
      setStatus(t.batchCompleted(completed));
      showToast({ kind: 'success', title: t.batchCompletedTitle, message: t.batchCompleted(completed) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t.exportFailedMessage);
      showToast({ kind: 'error', title: t.exportFailed, message: error instanceof Error ? error.message : t.exportFailedMessage });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-testid="thumbnail-generator-dialog">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <div className="text-xs text-slate-500">{t.canvasSize(size.width, size.height)}</div>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-panel" type="button" aria-label={zhCN.common.close} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-px bg-line">
          <aside className="space-y-3 overflow-y-auto bg-panel p-4 text-sm">
            <label className="block text-xs font-semibold text-slate-600">
              {t.source}
              <select className="mt-1 h-9 w-full rounded border border-line bg-white px-2 text-sm" value={assetId} data-testid="thumbnail-source-select" onChange={(event) => setAssetId(event.target.value)}>
                {videoAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              {t.platform}
              <select className="mt-1 h-9 w-full rounded border border-line bg-white px-2 text-sm" value={platform} data-testid="thumbnail-platform-select" onChange={(event) => setPlatform(event.target.value as ThumbnailPlatformPreset)}>
                {(['youtube', 'bilibili', 'douyin'] as ThumbnailPlatformPreset[]).map((preset) => (
                  <option key={preset} value={preset}>
                    {t.platforms[preset]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <span>{t.crop}</span>
              <input type="checkbox" checked={crop} data-testid="thumbnail-crop-checkbox" onChange={(event) => setCrop(event.target.checked)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              {t.titleText}
              <input className="mt-1 h-9 w-full rounded border border-line bg-white px-2 text-sm" value={titleText} data-testid="thumbnail-title-input" onChange={(event) => setTitleText(event.target.value)} />
            </label>
            <button
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-[#176858] disabled:opacity-50"
              type="button"
              disabled={!activeAsset || Boolean(busy)}
              data-testid="thumbnail-analyze-button"
              onClick={() => void analyze()}
            >
              {busy === 'analyze' ? <Loader2 className="animate-spin" size={15} /> : <ImageDown size={15} />}
              {t.analyze}
            </button>
            <button
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              disabled={candidates.length === 0 || Boolean(busy)}
              data-testid="thumbnail-export-selected-button"
              onClick={() => void exportSelected()}
            >
              {busy === 'export' ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
              {t.exportSelected}
            </button>
            <button
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-panel disabled:opacity-50"
              type="button"
              disabled={batchAssets.length === 0 || Boolean(busy)}
              data-testid="thumbnail-export-batch-button"
              onClick={() => void exportBatch()}
            >
              {busy === 'batch' ? <Loader2 className="animate-spin" size={15} /> : <ImageDown size={15} />}
              {t.exportBatch(batchAssets.length)}
            </button>
            {status ? <div className="rounded-md border border-line bg-white px-3 py-2 text-xs text-slate-600" data-testid="thumbnail-generator-status">{status}</div> : null}
          </aside>
          <main className="min-h-0 overflow-y-auto bg-white p-4">
            {candidates.length === 0 ? (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed border-line bg-panel text-sm text-slate-500" data-testid="thumbnail-candidate-empty">
                {t.emptyCandidates}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="thumbnail-candidate-grid">
                {candidates.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    className={`overflow-hidden rounded-md border bg-white text-left shadow-sm ${selectedId === candidate.id ? 'border-brand ring-2 ring-brand/20' : 'border-line hover:border-brand'}`}
                    type="button"
                    data-testid={`thumbnail-candidate-${index}`}
                    aria-pressed={selectedId === candidate.id}
                    onClick={() => setSelectedId(candidate.id)}
                  >
                    <img className="aspect-video w-full bg-slate-950 object-contain" src={candidate.dataUrl} alt="" />
                    <div className="space-y-1 p-2 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span>{t.candidateLabel(index + 1)}</span>
                        <span className="tabular-nums">{Math.round(candidate.score.total)}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[11px] text-slate-500">
                        <span>{t.scoreFace(candidate.score.face)}</span>
                        <span>{t.scoreClarity(candidate.score.clarity)}</span>
                        <span>{t.scoreColor(candidate.score.color)}</span>
                        <span>{t.scoreMotion(candidate.score.motion)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{t.timestamp(candidate.timestamp)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

async function analyzeThumbnailCandidates({
  asset,
  platform,
  crop,
  titleText,
  modelPath
}: {
  asset: MediaAsset;
  platform: ThumbnailPlatformPreset;
  crop: boolean;
  titleText: string;
  modelPath: string;
}): Promise<CandidateView[]> {
  const duration = Math.max(asset.duration || 0, 0);
  const timestamps = buildThumbnailSampleTimestamps(duration);
  const faceTimes = await detectFaceTimes(asset, timestamps, modelPath);
  const samples = await sampleAssetFrames(asset, timestamps, faceTimes, platform, crop, titleText);
  const scored = samples.map((sample, index) => ({
    ...sample,
    score: scoreThumbnailFrame(sample, {
      previous: samples[index - 1],
      next: samples[index + 1]
    })
  }));
  return rankThumbnailCandidates(scored).map((candidate, index) => ({
    ...candidate,
    id: `${asset.id}-${index}-${candidate.timestamp}`,
    asset,
    dataUrl: renderPreviewFromSample(candidate, platform, crop, titleText)
  }));
}

async function detectFaceTimes(asset: MediaAsset, timestamps: number[], modelPath: string): Promise<Set<number>> {
  if (!modelPath.trim()) {
    return new Set();
  }
  try {
    const result = await detectPrivacyRegions({
      modelPath,
      mediaPath: asset.path,
      clipId: asset.id,
      duration: asset.duration
    });
    const tolerance = Math.max(0.2, (asset.duration || timestamps.length) / Math.max(1, timestamps.length) / 2);
    return new Set(timestamps.filter((timestamp) => result.boxes.some((box) => Math.abs(box.time - timestamp) <= tolerance)));
  } catch {
    return new Set();
  }
}

async function sampleAssetFrames(
  asset: MediaAsset,
  timestamps: number[],
  faceTimes: Set<number>,
  platform: ThumbnailPlatformPreset,
  crop: boolean,
  titleText: string
): Promise<ThumbnailFrameSample[]> {
  try {
    const video = await loadVideo(asset);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('canvas unavailable');
    }
    const samples: ThumbnailFrameSample[] = [];
    for (const timestamp of timestamps) {
      await seekVideo(video, timestamp);
      drawVideoFrame(context, video, SAMPLE_WIDTH, SAMPLE_HEIGHT, crop);
      drawPreviewTitle(context, SAMPLE_WIDTH, SAMPLE_HEIGHT, titleText);
      const image = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      samples.push({ timestamp, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT, data: image.data, faceDetected: faceTimes.has(timestamp) });
    }
    return samples;
  } catch {
    return timestamps.map((timestamp, index) => makeFallbackSample(asset, timestamp, index, faceTimes.has(timestamp), platform));
  }
}

function loadVideo(asset: MediaAsset): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timeout = window.setTimeout(() => reject(new Error('video metadata timeout')), 1200);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve(video);
    };
    const onError = () => {
      cleanup();
      reject(new Error('video load failed'));
    };
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = convertLocalFileSrc(asset.path);
  });
}

function seekVideo(video: HTMLVideoElement, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - timestamp) < 0.035 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }
    const timeout = window.setTimeout(() => reject(new Error('video seek timeout')), 800);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('video seek failed'));
    };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = Math.max(0, timestamp);
  });
}

function makeFallbackSample(asset: MediaAsset, timestamp: number, index: number, faceDetected: boolean, platform: ThumbnailPlatformPreset): ThumbnailFrameSample {
  const size = getThumbnailPlatformSize(platform);
  const data: number[] = [];
  const seed = hashText(`${asset.id}:${asset.name}:${index}`);
  for (let y = 0; y < SAMPLE_HEIGHT; y += 1) {
    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const wave = (x * 7 + y * 13 + seed + Math.round(timestamp * 19)) % 255;
      const platformBias = size.height > size.width ? 40 : 0;
      data.push((wave + platformBias) % 255, (wave * 2 + seed) % 255, (255 - wave + index * 11) % 255, 255);
    }
  }
  return { timestamp, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT, data, faceDetected };
}

function renderPreviewFromSample(sample: ThumbnailFrameSample, platform: ThumbnailPlatformPreset, crop: boolean, titleText: string): string {
  const size = getThumbnailPlatformSize(platform);
  const width = PREVIEW_WIDTH;
  const height = Math.max(120, Math.round((PREVIEW_WIDTH * size.height) / size.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }
  const image = new ImageData(new Uint8ClampedArray(Array.from(sample.data)), sample.width, sample.height);
  const source = document.createElement('canvas');
  source.width = sample.width;
  source.height = sample.height;
  source.getContext('2d')?.putImageData(image, 0, 0);
  context.fillStyle = '#020617';
  context.fillRect(0, 0, width, height);
  drawCanvasSource(context, source, width, height, crop);
  drawPreviewTitle(context, width, height, titleText);
  return canvas.toDataURL('image/png');
}

function drawVideoFrame(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number, crop: boolean): void {
  context.fillStyle = '#020617';
  context.fillRect(0, 0, width, height);
  drawCanvasSource(context, video, width, height, crop);
}

function drawCanvasSource(context: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, crop: boolean): void {
  const sourceWidth = 'videoWidth' in source ? source.videoWidth || width : 'naturalWidth' in source ? source.naturalWidth || width : 'width' in source ? Number(source.width) || width : width;
  const sourceHeight = 'videoHeight' in source ? source.videoHeight || height : 'naturalHeight' in source ? source.naturalHeight || height : 'height' in source ? Number(source.height) || height : height;
  const scale = crop ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawPreviewTitle(context: CanvasRenderingContext2D, width: number, height: number, titleText: string): void {
  const text = titleText.trim();
  if (!text) {
    return;
  }
  const fontSize = Math.max(16, Math.round(height * 0.08));
  context.fillStyle = 'rgba(2, 6, 23, 0.62)';
  context.fillRect(0, height - fontSize * 2.2, width, fontSize * 2.2);
  context.fillStyle = '#ffffff';
  context.font = `700 ${fontSize}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height - fontSize * 1.1, width - 24);
}

async function exportThumbnailFrame({
  baseProject,
  asset,
  outputPath,
  time,
  platform,
  crop,
  titleText
}: {
  baseProject: Project;
  asset: MediaAsset;
  outputPath: string;
  time: number;
  platform: ThumbnailPlatformPreset;
  crop: boolean;
  titleText: string;
}): Promise<void> {
  const project = buildThumbnailProject(baseProject, asset, platform, titleText);
  const capabilities = await getFfmpegCapabilities();
  const exportProject = buildExportProjectFromProject(project, {
    outputPath,
    settings: buildThumbnailExportSettings(platform, crop)
  });
  const plan = buildFfmpegCurrentFrameExportPlan(exportProject, time, capabilities);
  await runExport(plan);
}

function buildThumbnailProject(baseProject: Project, asset: MediaAsset, platform: ThumbnailPlatformPreset, titleText: string): Project {
  const size = getThumbnailPlatformSize(platform);
  const project = buildSingleAssetProject(asset, titleText);
  project.settings = {
    ...project.settings,
    width: size.width,
    height: size.height
  };
  return project;
}

function buildSingleAssetProject(asset: MediaAsset, titleText: string): Project {
  const project = createProject(`${asset.name} Thumbnail`);
  const videoTrack = createTrack({ id: createId('track'), type: 'video', name: zhCN.panels.preview, clips: [] });
  const textTrack = createTrack({ id: createId('track'), type: 'text', name: zhCN.thumbnailGenerator.titleTrack, clips: [] });
  const timeline = { tracks: [videoTrack, textTrack], transitions: [] };
  const clip = createClipFromAsset(asset, videoTrack, timeline);
  videoTrack.clips = [{ ...clip, start: 0, duration: Math.max(asset.duration || 1, 1), trimStart: 0, trimEnd: 0 }];
  if (titleText.trim()) {
    const titleClip = createTextClip(textTrack, timeline) as Extract<Clip, { type: 'text' }>;
    textTrack.clips = [
      {
        ...titleClip,
        id: createId('clip'),
        name: zhCN.thumbnailGenerator.titleTrack,
        start: 0,
        duration: Math.max(asset.duration || 1, 1),
        text: titleText.trim(),
        transform: {
          x: 0,
          y: -96,
          scale: 1,
          rotation: 0,
          opacity: 1
        },
        style: {
          fontSize: 72,
          color: '#ffffff',
          backgroundColor: '#000000',
          backgroundOpacity: 0.45,
          fontFamily: 'Inter',
          bold: true,
          italic: false
        }
      }
    ];
  }
  return {
    ...project,
    media: [asset],
    timeline
  };
}

function findTimelineVideoAssetId(project: Project): string | undefined {
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if ('mediaId' in clip) {
        const asset = project.media.find((item) => item.id === clip.mediaId && item.type === 'video' && !item.missing);
        if (asset) {
          return asset.id;
        }
      }
    }
  }
  return undefined;
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return hash;
}

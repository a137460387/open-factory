import { zhCN } from '../i18n/strings';

export interface TimelineThumbnailWorkerInput {
  id: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export interface TimelineThumbnailWorkerOutput {
  id: string;
  success: boolean;
  dataUrl?: string;
  error?: string;
}

self.onmessage = async (event: MessageEvent<TimelineThumbnailWorkerInput>) => {
  const { id, bitmap, width, height } = event.data;
  try {
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error(zhCN.errors.thumbnailOffscreenUnavailable);
    }
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(zhCN.errors.thumbnailWorkerCanvasFailed);
    }
    context.fillStyle = '#dbeafe';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    const payload: TimelineThumbnailWorkerOutput = { id, success: true, dataUrl: await blobToDataUrl(blob) };
    self.postMessage(payload);
  } catch (error) {
    bitmap.close();
    const payload: TimelineThumbnailWorkerOutput = {
      id,
      success: false,
      error: error instanceof Error ? error.message : zhCN.errors.thumbnailRenderFailed,
    };
    self.postMessage(payload);
  }
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

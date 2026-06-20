import { buildMediaPrecheckResult, sniffFileHeader, getFileExtension, type MediaPrecheckResult, type Project, type FileSniffResult } from '@open-factory/editor-core';
import { analyzeMedia, scanMediaIntegrity, readFileHeaderBytes, type MediaAnalysis, type MediaIntegrityScanResult } from '../lib/tauri-bridge';

export interface PreImportFileEntry {
  name: string;
  path: string;
  type: 'video' | 'audio' | 'image';
}

export interface PreImportResult {
  entry: PreImportFileEntry;
  status: 'pass' | 'warning' | 'error';
  fileSniff?: FileSniffResult;
  forced?: boolean;
}

export async function runBatchPreImportCheck(files: PreImportFileEntry[]): Promise<PreImportResult[]> {
  const results: PreImportResult[] = [];
  for (const file of files) {
    try {
      const header = await readFileHeaderBytes(file.path, 16);
      const sniff = sniffFileHeader(header, file.name);
      const status = sniff.status === 'mismatch' ? 'warning' : 'pass';
      results.push({ entry: file, status, fileSniff: sniff });
    } catch {
      results.push({ entry: file, status: 'error' });
    }
  }
  return results;
}

export function markForcedImport(result: PreImportResult): PreImportResult {
  return { ...result, status: 'warning', forced: true };
}

export interface MediaPrecheckDependencies {
  analyzeMedia(path: string): Promise<MediaAnalysis> | MediaAnalysis;
  scanMediaIntegrity(path: string): Promise<MediaIntegrityScanResult> | MediaIntegrityScanResult;
}

export async function runProjectMediaPrecheck(project: Project, dependencies: MediaPrecheckDependencies = defaultDependencies): Promise<MediaPrecheckResult[]> {
  const results: MediaPrecheckResult[] = [];
  for (const asset of project.media) {
    results.push(await runSingleMediaPrecheck(asset, dependencies));
  }
  return results;
}

async function runSingleMediaPrecheck(asset: Project['media'][number], dependencies: MediaPrecheckDependencies): Promise<MediaPrecheckResult> {
  let analysis: MediaAnalysis | undefined;
  let ffprobeError: string | undefined;
  let integrityErrorOutput: string | undefined;
  try {
    analysis = await dependencies.analyzeMedia(asset.path);
  } catch (error) {
    ffprobeError = error instanceof Error ? error.message : String(error);
  }
  if (!ffprobeError) {
    try {
      const scan = await dependencies.scanMediaIntegrity(asset.path);
      if (!scan.ok) {
        integrityErrorOutput = scan.errorOutput ?? 'FFmpeg scan failed.';
      }
    } catch (error) {
      integrityErrorOutput = error instanceof Error ? error.message : String(error);
    }
  }
  return buildMediaPrecheckResult({
    asset,
    analysis,
    ffprobeError,
    integrityErrorOutput,
    projectColorSpace: 'sdr'
  });
}

const defaultDependencies: MediaPrecheckDependencies = {
  analyzeMedia,
  scanMediaIntegrity
};

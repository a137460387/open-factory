import { buildMediaPrecheckResult, type MediaPrecheckResult, type Project } from '@open-factory/editor-core';
import { analyzeMedia, scanMediaIntegrity, type MediaAnalysis, type MediaIntegrityScanResult } from '../lib/tauri-bridge';

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

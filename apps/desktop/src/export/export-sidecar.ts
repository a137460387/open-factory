export function buildSidecarSubtitlePath(outputPath: string, artifactFileName: string): string {
  const extension = artifactFileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'srt';
  const lastSlash = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
  const lastDot = outputPath.lastIndexOf('.');
  const base = lastDot > lastSlash ? outputPath.slice(0, lastDot) : outputPath;
  return `${base}.${extension.toLowerCase()}`;
}

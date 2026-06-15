export function buildSidecarSubtitlePath(outputPath: string, artifactFileName: string): string {
  const match = artifactFileName.match(/(?:\.([a-z]{2}))?\.([a-z0-9]+)$/i);
  const language = match?.[1]?.toLowerCase();
  const extension = match?.[2] ?? 'srt';
  const lastSlash = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
  const lastDot = outputPath.lastIndexOf('.');
  const base = lastDot > lastSlash ? outputPath.slice(0, lastDot) : outputPath;
  return `${base}${language ? `.${language}` : ''}.${extension.toLowerCase()}`;
}

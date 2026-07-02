export function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\\|?*\x00-\x1f]/g, '-').trim() || 'open-factory';
}

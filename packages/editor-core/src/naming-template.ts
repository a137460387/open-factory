export interface NamingTemplateVariable {
  key: string;
  label: string;
  placeholder: string;
}

export const NAMING_TEMPLATE_VARIABLES: NamingTemplateVariable[] = [
  { key: 'project', label: '项目名', placeholder: '{project}' },
  { key: 'preset', label: '预设名', placeholder: '{preset}' },
  { key: 'date', label: '日期', placeholder: '{date}' },
  { key: 'time', label: '时间', placeholder: '{time}' },
  { key: 'index', label: '序号', placeholder: '{index}' },
  { key: 'resolution', label: '分辨率', placeholder: '{resolution}' },
  { key: 'fps', label: '帧率', placeholder: '{fps}' },
  { key: 'text', label: '自定义文本', placeholder: '{text:...}' },
];

export interface NamingTemplateContext {
  projectName: string;
  presetName: string;
  date?: string;
  time?: string;
  index?: number;
  indexPadding?: number;
  indexStart?: number;
  resolution?: string;
  fps?: number;
  customText?: string;
  dateFormat?: 'YYYYMMDD' | 'YYYY-MM-DD';
}

export interface NamingTemplateConfig {
  template: string;
  indexStart?: number;
  indexPadding?: number;
  dateFormat?: 'YYYYMMDD' | 'YYYY-MM-DD';
  customText?: string;
}

export const DEFAULT_NAMING_TEMPLATE: NamingTemplateConfig = {
  template: '{project}_{preset}_{date}_{index}',
  indexStart: 1,
  indexPadding: 3,
  dateFormat: 'YYYYMMDD',
};

export function formatDateForNaming(date: Date, format: 'YYYYMMDD' | 'YYYY-MM-DD'): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  if (format === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  }
  return `${y}${m}${d}`;
}

export function formatTimeForNaming(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}${m}${s}`;
}

export function formatIndexForNaming(index: number, padding: number): string {
  return index.toString().padStart(Math.max(1, padding), '0');
}

export function resolveNamingTemplate(config: NamingTemplateConfig, context: NamingTemplateContext): string {
  const now = new Date();
  const dateFormat = config.dateFormat ?? 'YYYYMMDD';
  const padding = config.indexPadding ?? 3;
  const index = context.index ?? 1;

  let result = config.template;
  result = result.replace(/\{project\}/g, sanitizeFileName(context.projectName || 'project'));
  result = result.replace(/\{preset\}/g, sanitizeFileName(context.presetName || 'preset'));
  result = result.replace(/\{date\}/g, formatDateForNaming(context.date ? new Date(context.date) : now, dateFormat));
  result = result.replace(/\{time\}/g, formatTimeForNaming(context.time ? new Date(context.time) : now));
  result = result.replace(/\{index\}/g, formatIndexForNaming(index, padding));
  result = result.replace(/\{resolution\}/g, context.resolution ?? '');
  result = result.replace(/\{fps\}/g, context.fps != null ? `${context.fps}fps` : '');
  result = result.replace(/\{text:([^}]*)\}/g, (_match, text) => {
    return sanitizeFileName(config.customText ?? text ?? '');
  });
  result = result.replace(/\{text\}/g, sanitizeFileName(config.customText ?? ''));

  return result.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
}

export function resolveNamingTemplateBatch(
  config: NamingTemplateConfig,
  baseContext: Omit<NamingTemplateContext, 'index'>,
  count: number,
): string[] {
  const indexStart = config.indexStart ?? 1;
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(resolveNamingTemplate(config, { ...baseContext, index: indexStart + i }));
  }
  return results;
}

export function previewNamingTemplate(config: NamingTemplateConfig): string {
  return resolveNamingTemplate(config, {
    projectName: '示例项目',
    presetName: 'Web1080p',
    index: config.indexStart ?? 1,
    resolution: '1920x1080',
    fps: 30,
    customText: config.customText,
  });
}

export function serializeNamingTemplateConfig(config: NamingTemplateConfig): string {
  return JSON.stringify(config);
}

export function deserializeNamingTemplateConfig(json: string): NamingTemplateConfig | undefined {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed && typeof parsed.template === 'string') {
      return {
        template: parsed.template,
        indexStart: typeof parsed.indexStart === 'number' ? parsed.indexStart : 1,
        indexPadding: typeof parsed.indexPadding === 'number' ? parsed.indexPadding : 3,
        dateFormat: parsed.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'YYYYMMDD',
        customText: typeof parsed.customText === 'string' ? parsed.customText : undefined,
      };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

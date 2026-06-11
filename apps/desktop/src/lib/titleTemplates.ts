import { TITLE_TEMPLATE_IDS, type TitleTemplateId } from '@open-factory/editor-core';

export const TITLE_TEMPLATE_DRAG_MIME = 'application/x-open-factory-title-template';

export function isTitleTemplateId(value: string): value is TitleTemplateId {
  return TITLE_TEMPLATE_IDS.includes(value as TitleTemplateId);
}

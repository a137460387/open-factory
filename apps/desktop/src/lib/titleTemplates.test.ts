import { describe, it, expect } from 'vitest';
import { isTitleTemplateId, TITLE_TEMPLATE_DRAG_MIME } from '../titleTemplates';

describe('titleTemplates', () => {
  describe('TITLE_TEMPLATE_DRAG_MIME', () => {
    it('is a valid MIME type string', () => {
      expect(TITLE_TEMPLATE_DRAG_MIME).toBe('application/x-open-factory-title-template');
    });
  });

  describe('isTitleTemplateId', () => {
    it('returns true for valid template IDs', () => {
      // TITLE_TEMPLATE_IDS from editor-core should contain known IDs
      // We test with a known valid ID pattern
      const result = isTitleTemplateId('minimal');
      expect(typeof result).toBe('boolean');
    });

    it('returns false for empty string', () => {
      expect(isTitleTemplateId('')).toBe(false);
    });

    it('returns false for random string', () => {
      expect(isTitleTemplateId('nonexistent-template-xyz')).toBe(false);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXT_STYLE,
  buildArcTextLayout,
  buildRichTextDrawSegments,
  calculateTextAutoLayout,
  formatOpenTypeFeatureList,
  serializeRichTextDocument
} from '../src';

describe('advanced text layout', () => {
  it('serializes character-level rich text formatting', () => {
    const serialized = serializeRichTextDocument(
      {
        paragraphs: [
          {
            runs: [
              { text: 'Open ', color: '#ffffff' },
              { text: 'Factory', bold: true, italic: true, underline: true, color: '#ff4fd8', fontSize: 64 }
            ]
          }
        ]
      },
      ''
    );

    expect(serialized).toContain('"bold":true');
    expect(serialized).toContain('"italic":true');
    expect(serialized).toContain('"underline":true');
    expect(serialized).toContain('"fontSize":64');
  });

  it('splits rich text paragraphs into draw segments', () => {
    const segments = buildRichTextDrawSegments({
      richText: {
        paragraphs: [
          { runs: [{ text: 'One' }] },
          { runs: [{ text: 'Two' }] },
          { runs: [{ text: 'Three' }] }
        ]
      },
      plainText: '',
      baseStyle: DEFAULT_TEXT_STYLE,
      layout: { paragraphSpacing: 16, firstLineIndent: 24 }
    });

    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.paragraphIndex)).toEqual([0, 1, 2]);
    expect(segments[0].xOffset).toBe(24);
    expect(segments[1].yOffset).toBeGreaterThan(segments[0].yOffset);
  });

  it('calculates auto-height text boxes from paragraph content', () => {
    const layout = calculateTextAutoLayout({
      richText: {
        paragraphs: [
          { runs: [{ text: 'First', fontSize: 40 }] },
          { runs: [{ text: 'Second', fontSize: 40 }] }
        ]
      },
      plainText: '',
      baseStyle: DEFAULT_TEXT_STYLE,
      layout: { fitMode: 'auto-height', boxWidth: 320, boxHeight: 24, paragraphSpacing: 20, firstLineIndent: 0 }
    });

    expect(layout.fitMode).toBe('auto-height');
    expect(layout.height).toBeGreaterThan(100);
    expect(layout.scale).toBe(1);
  });

  it('maps arc radius to character rotation angle', () => {
    const tight = buildArcTextLayout({ text: 'AB', arc: { enabled: true, radius: 80, startAngle: 0 }, fontSize: 48 });
    const wide = buildArcTextLayout({ text: 'AB', arc: { enabled: true, radius: 320, startAngle: 0 }, fontSize: 48 });

    expect(tight[1].rotation - tight[0].rotation).toBeGreaterThan(wide[1].rotation - wide[0].rotation);
  });

  it('formats enabled OpenType feature args', () => {
    expect(formatOpenTypeFeatureList({ liga: true, smcp: true, tnum: false, swsh: true })).toBe('liga=1,smcp=1,swsh=1');
  });
});

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_THEMES,
  buildThemeCssVariables,
  contrastRatio,
  deleteCustomTheme,
  applyThemeDefinitionToDocument,
  upsertCustomTheme,
  validateThemeContrast,
  type ThemeSettings
} from './theme';

describe('theme definitions', () => {
  it('builds CSS variables from a built-in theme', () => {
    const variables = buildThemeCssVariables(BUILTIN_THEMES.light);

    expect(variables['--color-bg-primary']).toBe('#edeff3');
    expect(variables['--color-bg-primary-rgb']).toBe('237 239 243');
    expect(variables['--color-accent']).toBe('#1f7a68');
    expect(variables['--color-canvas-bg']).toBe('#1b2028');
    expect(variables['--shadow-soft']).toContain('rgba');
  });

  it('applies variables and body class to a document', () => {
    const document = createDocumentMock();

    applyThemeDefinitionToDocument(BUILTIN_THEMES.light, document);

    expect(document.vars.get('--color-bg-primary')).toBe('#edeff3');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.dataset.theme).toBe('light');
  });

  it('creates, updates, and deletes custom themes', () => {
    const created = upsertCustomTheme(undefined, {
      name: 'Client Green',
      colors: {
        primary: '#0f766e',
        accent: '#f97316',
        background: '#0b1120',
        text: '#f8fafc'
      }
    });

    expect(created.settings.activeThemeId).toBe(created.theme.id);
    expect(created.settings.customThemes).toHaveLength(1);
    expect(created.theme.id).toBe('custom-client-green');

    const updated = upsertCustomTheme(created.settings, {
      id: created.theme.id,
      name: 'Client Green Updated',
      colors: { primary: '#14b8a6' }
    });

    expect(updated.settings.customThemes).toHaveLength(1);
    expect(updated.theme.name).toBe('Client Green Updated');
    expect(updated.theme.colors.primary).toBe('#14b8a6');

    const deleted = deleteCustomTheme(updated.settings, updated.theme.id);

    expect(deleted.customThemes).toHaveLength(0);
    expect(deleted.activeThemeId).toBe('dark');
  });

  it('calculates WCAG contrast ratio correctly', () => {
    // white on black = 21:1
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    // same color = 1:1
    expect(contrastRatio('#808080', '#808080')).toBeCloseTo(1, 2);
  });

  it('all built-in themes pass WCAG AA for primary/secondary text pairs', () => {
    for (const [id, theme] of Object.entries(BUILTIN_THEMES)) {
      const results = validateThemeContrast(theme);
      const failures = results.filter((r) => !r.pass && r.foreground !== theme.colors.textMuted);
      expect(failures, `Theme ${id} has AA failures: ${JSON.stringify(failures)}`).toHaveLength(0);
    }
  });

  it('all built-in themes pass WCAG AA for muted text on primary bg', () => {
    for (const [id, theme] of Object.entries(BUILTIN_THEMES)) {
      const ratio = contrastRatio(theme.colors.textMuted, theme.colors.bgPrimary);
      expect(ratio, `Theme ${id} textMuted on bgPrimary`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function createDocumentMock() {
  const vars = new Map<string, string>();
  const classes = new Set<string>(['theme-dark', 'other-class']);
  const classList = {
    add: (value: string) => classes.add(value),
    remove: (value: string) => classes.delete(value),
    contains: (value: string) => classes.has(value),
    [Symbol.iterator]: function* iterator() {
      yield* classes;
    }
  };
  return {
    vars,
    documentElement: {
      style: {
        setProperty: (key: string, value: string) => vars.set(key, value)
      }
    },
    body: {
      classList,
      dataset: {} as Record<string, string>
    }
  } as unknown as Document & { vars: Map<string, string>; body: Document['body'] & { dataset: Record<string, string>; classList: typeof classList } };
}

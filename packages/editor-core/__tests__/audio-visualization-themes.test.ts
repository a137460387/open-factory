import { describe, expect, it } from 'vitest';
import {
  expandAudioVisualizationTheme,
  normalizeAudioVisualizationTheme,
  normalizeCustomAudioVisualizationThemes,
  removeCustomAudioVisualizationTheme,
  upsertCustomAudioVisualizationTheme
} from '../src';

describe('audio visualization themes', () => {
  it('expands the neon cyberpunk theme to concrete colors and rendering parameters', () => {
    expect(expandAudioVisualizationTheme({ themeId: 'neon-cyberpunk' })).toEqual({
      themeId: 'neon-cyberpunk',
      colorStart: '#8b5cf6',
      colorEnd: '#22d3ee',
      background: { type: 'gradient', color: '#120026', color2: '#020617' },
      glow: true,
      glowColor: '#a78bfa',
      glowStrength: 0.75,
      particles: true,
      particleColor: '#67e8f9',
      border: true,
      borderColor: '#38bdf8',
      borderWidth: 2
    });
  });

  it('falls back to manual colors when no built-in theme is selected', () => {
    expect(expandAudioVisualizationTheme({ colorStart: '#123', colorEnd: '#abcdef' })).toMatchObject({
      themeId: 'manual',
      colorStart: '#112233',
      colorEnd: '#abcdef',
      background: { type: 'solid', color: '#050816' },
      glow: false,
      particles: false,
      border: false
    });
  });

  it('normalizes inline theme snapshots and invalid stored theme entries', () => {
    expect(
      expandAudioVisualizationTheme({
        theme: {
          id: 42 as never,
          name: '',
          colorStart: '#f0a',
          colorEnd: '#001122',
          background: { type: 'solid', color: '#bad' },
          borderWidth: Number.NaN
        }
      })
    ).toMatchObject({
      themeId: 'neon-cyberpunk',
      colorStart: '#ff00aa',
      colorEnd: '#001122',
      background: { type: 'solid', color: '#bbaadd' },
      borderWidth: 2
    });

    expect(normalizeAudioVisualizationTheme({ id: 123 as never }).id).toBe('neon-cyberpunk');
    expect(normalizeCustomAudioVisualizationThemes([null, 'bad', { id: 'Valid Theme', name: 'Valid' }])).toHaveLength(1);
  });

  it('normalizes custom theme CRUD operations without allowing built-in id collisions', () => {
    const inserted = upsertCustomAudioVisualizationTheme([], {
      id: 'My Theme',
      name: '  My Theme  ',
      colorStart: '#abc',
      colorEnd: '#def',
      background: { type: 'gradient', color: '#111111', color2: '#222222' },
      glow: true,
      glowColor: '#333333',
      glowStrength: 2,
      particles: true,
      particleColor: '#444444',
      border: true,
      borderColor: '#555555',
      borderWidth: 99
    });

    expect(inserted).toEqual([
      {
        id: 'my-theme',
        name: 'My Theme',
        colorStart: '#aabbcc',
        colorEnd: '#ddeeff',
        background: { type: 'gradient', color: '#111111', color2: '#222222' },
        glow: true,
        glowColor: '#333333',
        glowStrength: 1,
        particles: true,
        particleColor: '#444444',
        border: true,
        borderColor: '#555555',
        borderWidth: 12
      }
    ]);

    const updated = upsertCustomAudioVisualizationTheme(inserted, { id: 'my-theme', name: 'Updated', colorStart: '#010203' });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: 'my-theme', name: 'Updated', colorStart: '#010203' });

    expect(removeCustomAudioVisualizationTheme(updated, 'my-theme')).toEqual([]);
    expect(normalizeCustomAudioVisualizationThemes([{ id: 'retro-vu', name: 'duplicate built-in' }, inserted[0], inserted[0]])).toEqual(inserted);
  });
});

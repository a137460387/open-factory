import { describe, it, expect } from 'vitest';
import { parseCubeFile, parse3dlFile, exportToCube, generateLUTPreview } from '../../src/color-grading/lut-parser';
import { validateLUTData, normalizeColorGradingLUTLayer, createColorGradingLUTLayer } from '../../src/color-grading/lut';

describe('parseCubeFile', () => {
  it('should parse a standard 3D .cube file', () => {
    const size = 2;
    const content = `TITLE "Test LUT"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0`;

    const lut = parseCubeFile(content);
    expect(lut.size).toBe(2);
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
    expect(lut.data.length).toBe(2 * 2 * 2 * 3);
    expect(lut.data[0]).toBeCloseTo(0.0);
    expect(lut.data[3]).toBeCloseTo(1.0);
    expect(lut.data[4]).toBeCloseTo(0.0);
  });

  it('should parse a .cube file with custom domain', () => {
    const content = `LUT_3D_SIZE 2
DOMAIN_MIN -0.5 -0.5 -0.5
DOMAIN_MAX 1.5 1.5 1.5
0.0 0.0 0.0
0.5 0.0 0.0
0.0 0.5 0.0
0.5 0.5 0.0
0.0 0.0 0.5
0.5 0.0 0.5
0.0 0.5 0.5
0.5 0.5 0.5`;

    const lut = parseCubeFile(content);
    expect(lut.domainMin).toEqual([-0.5, -0.5, -0.5]);
    expect(lut.domainMax).toEqual([1.5, 1.5, 1.5]);
  });

  it('should expand a 1D LUT to 3D', () => {
    const content = `LUT_1D_SIZE 3
0.0 0.0 0.0
0.5 0.25 0.75
1.0 1.0 1.0`;

    const lut = parseCubeFile(content);
    expect(lut.size).toBe(3);
    // 1D expanded to 3D: size^3 * 3 = 27 * 3 = 81
    expect(lut.data.length).toBe(3 * 3 * 3 * 3);

    // Verify that R channel lookup works (1D -> same value for all g,b combos)
    // At r=0 (index 0): value = 0.0
    const idx000 = (0 * 3 * 3 + 0 * 3 + 0) * 3;
    expect(lut.data[idx000]).toBeCloseTo(0.0);
    expect(lut.data[idx000 + 1]).toBeCloseTo(0.0);
    expect(lut.data[idx000 + 2]).toBeCloseTo(0.0);

    // At r=1 (index 1): value = 0.5 0.25 0.75
    const idx001 = (0 * 3 * 3 + 0 * 3 + 1) * 3;
    expect(lut.data[idx001]).toBeCloseTo(0.5);
    expect(lut.data[idx001 + 1]).toBeCloseTo(0.25);
    expect(lut.data[idx001 + 2]).toBeCloseTo(0.75);
  });

  it('should throw on missing LUT_3D_SIZE', () => {
    const content = `0.0 0.0 0.0
1.0 1.0 1.0`;
    expect(() => parseCubeFile(content)).toThrow('missing LUT_3D_SIZE or LUT_1D_SIZE');
  });

  it('should throw on data count mismatch', () => {
    const content = `LUT_3D_SIZE 3
0.0 0.0 0.0
1.0 1.0 1.0`;
    expect(() => parseCubeFile(content)).toThrow(/expected \d+ values, got \d+/);
  });

  it('should skip comment lines', () => {
    const content = `# This is a comment
LUT_3D_SIZE 2
# Another comment
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0`;

    const lut = parseCubeFile(content);
    expect(lut.size).toBe(2);
    expect(lut.data.length).toBe(24);
  });
});

describe('parse3dlFile', () => {
  it('should parse a standard .3dl file with 10-bit values', () => {
    // size=2, 8 data lines (2^3)
    const content = `2
0 0 0
1023 0 0
0 1023 0
1023 1023 0
0 0 1023
1023 0 1023
0 1023 1023
1023 1023 1023`;

    const lut = parse3dlFile(content);
    expect(lut.size).toBe(2);
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
    expect(lut.data.length).toBe(24);
    // 1023 / 1023 = 1.0
    expect(lut.data[3]).toBeCloseTo(1.0);
    expect(lut.data[0]).toBeCloseTo(0.0);
  });

  it('should parse a .3dl file with float values (already normalized)', () => {
    const content = `2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0`;

    const lut = parse3dlFile(content);
    expect(lut.size).toBe(2);
    expect(lut.data[0]).toBeCloseTo(0.0);
    expect(lut.data[3]).toBeCloseTo(1.0);
  });

  it('should infer size from data count when size line is missing', () => {
    // 2^3 = 8 data lines, each with 3 values
    const content = `0 0 0
0 0 0
0 0 0
0 0 0
0 0 0
0 0 0
0 0 0
0 0 0`;

    const lut = parse3dlFile(content);
    expect(lut.size).toBe(2);
    expect(lut.data.length).toBe(24);
  });

  it('should throw when size cannot be determined', () => {
    const content = `0 0 0
1 1 1`;
    expect(() => parse3dlFile(content)).toThrow('cannot determine LUT size');
  });
});

describe('exportToCube', () => {
  it('should export LUT data in .cube format', () => {
    const lut = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array([
        0, 0, 0,  1, 0, 0,
        0, 1, 0,  1, 1, 0,
        0, 0, 1,  1, 0, 1,
        0, 1, 1,  1, 1, 1,
      ]),
    };

    const output = exportToCube(lut, 'Test');
    expect(output).toContain('TITLE "Test"');
    expect(output).toContain('LUT_3D_SIZE 2');
    expect(output).toContain('DOMAIN_MIN 0 0 0');
    expect(output).toContain('DOMAIN_MAX 1 1 1');
    expect(output).toContain('0.000000 0.000000 0.000000');
    expect(output).toContain('1.000000 0.000000 0.000000');
  });

  it('should export without title when not provided', () => {
    const lut = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(24),
    };

    const output = exportToCube(lut);
    expect(output).not.toContain('TITLE');
    expect(output).toContain('LUT_3D_SIZE 2');
  });

  it('should roundtrip with parseCubeFile', () => {
    const original = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array([
        0, 0, 0,  0.5, 0, 0,
        0, 0.5, 0,  0.5, 0.5, 0,
        0, 0, 0.5,  0.5, 0, 0.5,
        0, 0.5, 0.5,  0.5, 0.5, 0.5,
      ]),
    };

    const exported = exportToCube(original, 'Roundtrip');
    const parsed = parseCubeFile(exported);

    expect(parsed.size).toBe(original.size);
    expect(parsed.domainMin).toEqual(original.domainMin);
    expect(parsed.domainMax).toEqual(original.domainMax);
    for (let i = 0; i < original.data.length; i++) {
      expect(parsed.data[i]).toBeCloseTo(original.data[i], 5);
    }
  });
});

describe('validateLUTData', () => {
  it('should return true for valid LUT data', () => {
    const data = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(24), // 2^3 * 3
    };
    expect(validateLUTData(data)).toBe(true);
  });

  it('should return false for size < 2', () => {
    const data = {
      size: 1,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(3),
    };
    expect(validateLUTData(data)).toBe(false);
  });

  it('should return false for size > 256', () => {
    const data = {
      size: 300,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(300 * 300 * 300 * 3),
    };
    expect(validateLUTData(data)).toBe(false);
  });

  it('should return false for mismatched data length', () => {
    const data = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(10), // wrong: should be 24
    };
    expect(validateLUTData(data)).toBe(false);
  });

  it('should return false for out-of-range domain values', () => {
    const data = {
      size: 2,
      domainMin: [-20, 0, 0] as [number, number, number],
      domainMax: [1, 1, 1] as [number, number, number],
      data: new Float32Array(24),
    };
    expect(validateLUTData(data)).toBe(false);

    const data2 = {
      size: 2,
      domainMin: [0, 0, 0] as [number, number, number],
      domainMax: [1, 20, 1] as [number, number, number],
      data: new Float32Array(24),
    };
    expect(validateLUTData(data2)).toBe(false);
  });
});

describe('normalizeColorGradingLUTLayer', () => {
  it('should normalize a valid layer object', () => {
    const result = normalizeColorGradingLUTLayer({
      id: 'test-id',
      lutId: 'lut-1',
      intensity: 0.8,
      enabled: true,
    });
    expect(result).toEqual({
      id: 'test-id',
      lutId: 'lut-1',
      intensity: 0.8,
      enabled: true,
    });
  });

  it('should return null for null/undefined input', () => {
    expect(normalizeColorGradingLUTLayer(null)).toBeNull();
    expect(normalizeColorGradingLUTLayer(undefined)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(normalizeColorGradingLUTLayer('string')).toBeNull();
    expect(normalizeColorGradingLUTLayer(42)).toBeNull();
  });

  it('should return null when lutId is missing', () => {
    expect(normalizeColorGradingLUTLayer({ id: 'test' })).toBeNull();
  });

  it('should clamp intensity to 0-1', () => {
    const result = normalizeColorGradingLUTLayer({ lutId: 'lut-1', intensity: 1.5 });
    expect(result!.intensity).toBe(1);

    const result2 = normalizeColorGradingLUTLayer({ lutId: 'lut-1', intensity: -0.5 });
    expect(result2!.intensity).toBe(0);
  });

  it('should default intensity to 1 when missing', () => {
    const result = normalizeColorGradingLUTLayer({ lutId: 'lut-1' });
    expect(result!.intensity).toBe(1);
  });

  it('should default enabled to true when not explicitly false', () => {
    const result = normalizeColorGradingLUTLayer({ lutId: 'lut-1' });
    expect(result!.enabled).toBe(true);

    const result2 = normalizeColorGradingLUTLayer({ lutId: 'lut-1', enabled: false });
    expect(result2!.enabled).toBe(false);
  });

  it('should generate id when missing', () => {
    const result = normalizeColorGradingLUTLayer({ lutId: 'lut-1' });
    expect(result!.id).toMatch(/^lut-layer-/);
  });
});

describe('createColorGradingLUTLayer', () => {
  it('should create a layer with correct defaults', () => {
    const layer = createColorGradingLUTLayer('my-lut');
    expect(layer.lutId).toBe('my-lut');
    expect(layer.intensity).toBe(1);
    expect(layer.enabled).toBe(true);
    expect(layer.id).toMatch(/^lut-layer-/);
  });

  it('should generate unique ids', () => {
    const layer1 = createColorGradingLUTLayer('lut-1');
    const layer2 = createColorGradingLUTLayer('lut-1');
    expect(layer1.id).not.toBe(layer2.id);
  });
});

describe('generateLUTPreview', () => {
  it('should generate pixel data with correct dimensions', () => {
    const lut = parseCubeFile(`LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0`);

    const preview = generateLUTPreview(lut, 4, 2);
    expect(preview.length).toBe(4 * 2 * 4); // width * height * RGBA
    // Alpha channel should be 255
    expect(preview[3]).toBe(255);
    expect(preview[7]).toBe(255);
  });

  it('should produce grayscale output for identity LUT', () => {
    // Identity LUT: input = output
    const size = 3;
    const data = new Float32Array(size * size * size * 3);
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const idx = (b * size * size + g * size + r) * 3;
          data[idx] = r / (size - 1);
          data[idx + 1] = g / (size - 1);
          data[idx + 2] = b / (size - 1);
        }
      }
    }

    const lut = { size, domainMin: [0, 0, 0] as [number, number, number], domainMax: [1, 1, 1] as [number, number, number], data };
    const preview = generateLUTPreview(lut, 8, 1);

    // For a grayscale ramp (r=g=b=t), the identity LUT should return the same value
    // First pixel (x=0, t=0): should be near 0
    expect(preview[0]).toBeCloseTo(0, 0);
    expect(preview[1]).toBeCloseTo(0, 0);
    expect(preview[2]).toBeCloseTo(0, 0);

    // Last pixel (x=7, t=1): should be near 255
    const lastIdx = 7 * 4;
    expect(preview[lastIdx]).toBeCloseTo(255, 0);
    expect(preview[lastIdx + 1]).toBeCloseTo(255, 0);
    expect(preview[lastIdx + 2]).toBeCloseTo(255, 0);
  });
});

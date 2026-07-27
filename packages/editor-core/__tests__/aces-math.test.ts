import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  multiplyMatrix3x3,
  multiplyMatrix4x4,
  multiplyMatrices3x3,
  invertMatrix3x3,
  createDefaultColorManagementConfig,
  validateColorManagementConfig,
  parseCubeFile,
} from '../src/color/aces';

describe('clamp', () => {
  it('returns value within range', () => { expect(clamp(5, 0, 10)).toBe(5); });
  it('clamps to min', () => { expect(clamp(-5, 0, 10)).toBe(0); });
  it('clamps to max', () => { expect(clamp(15, 0, 10)).toBe(10); });
  it('handles equal bounds', () => { expect(clamp(5, 5, 5)).toBe(5); });
});

describe('lerp', () => {
  it('returns a at t=0', () => { expect(lerp(0, 100, 0)).toBe(0); });
  it('returns b at t=1', () => { expect(lerp(0, 100, 1)).toBe(100); });
  it('returns midpoint at t=0.5', () => { expect(lerp(0, 100, 0.5)).toBe(50); });
  it('extrapolates beyond 1', () => { expect(lerp(0, 100, 2)).toBe(200); });
});

describe('multiplyMatrix3x3', () => {
  it('identity matrix preserves vector', () => {
    const identity: [number,number,number,number,number,number,number,number,number] = [1,0,0,0,1,0,0,0,1];
    const v = { r: 1, g: 2, b: 3 };
    expect(multiplyMatrix3x3(identity, v)).toEqual(v);
  });

  it('scales vector correctly', () => {
    const scale: [number,number,number,number,number,number,number,number,number] = [2,0,0,0,3,0,0,0,4];
    expect(multiplyMatrix3x3(scale, { r: 1, g: 1, b: 1 })).toEqual({ r: 2, g: 3, b: 4 });
  });
});

describe('multiplyMatrix4x4', () => {
  it('identity preserves vector (ignoring translation)', () => {
    const identity: [number,number,number,number,number,number,number,number,number,number,number,number] = [1,0,0,0,0,1,0,0,0,0,1,0];
    expect(multiplyMatrix4x4(identity, { r: 1, g: 2, b: 3 })).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('adds translation', () => {
    const m: [number,number,number,number,number,number,number,number,number,number,number,number] = [1,0,0,10,0,1,0,20,0,0,1,30];
    expect(multiplyMatrix4x4(m, { r: 0, g: 0, b: 0 })).toEqual({ r: 10, g: 20, b: 30 });
  });
});

describe('multiplyMatrices3x3', () => {
  it('identity * identity = identity', () => {
    const I: [number,number,number,number,number,number,number,number,number] = [1,0,0,0,1,0,0,0,1];
    expect(multiplyMatrices3x3(I, I)).toEqual(I);
  });

  it('A * A^-1 = identity', () => {
    const A: [number,number,number,number,number,number,number,number,number] = [2,1,0,0,1,1,1,0,1];
    const Ainv = invertMatrix3x3(A);
    const result = multiplyMatrices3x3(A, Ainv);
    for (let i = 0; i < 9; i++) {
      expect(result[i]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 10);
    }
  });
});

describe('invertMatrix3x3', () => {
  it('inverts identity to identity', () => {
    const I: [number,number,number,number,number,number,number,number,number] = [1,0,0,0,1,0,0,0,1];
    expect(invertMatrix3x3(I)).toEqual(I);
  });

  it('throws for singular matrix', () => {
    const singular: [number,number,number,number,number,number,number,number,number] = [1,0,0,0,0,0,0,0,0];
    expect(() => invertMatrix3x3(singular)).toThrow();
  });

  it('inverts a known matrix', () => {
    const A: [number,number,number,number,number,number,number,number,number] = [2,0,0,0,3,0,0,0,4];
    const inv = invertMatrix3x3(A);
    expect(inv[0]).toBeCloseTo(0.5);
    expect(inv[4]).toBeCloseTo(1/3);
    expect(inv[8]).toBeCloseTo(0.25);
  });
});

describe('createDefaultColorManagementConfig', () => {
  it('returns valid config', () => {
    const config = createDefaultColorManagementConfig();
    expect(config.workingColorSpace).toBe('acescg');
    expect(config.displayColorSpace).toBe('srgb');
    expect(validateColorManagementConfig(config)).toBe(true);
  });
});

describe('validateColorManagementConfig', () => {
  it('validates correct config', () => {
    expect(validateColorManagementConfig(createDefaultColorManagementConfig())).toBe(true);
  });

  it('rejects config with missing fields', () => {
    expect(validateColorManagementConfig({} as never)).toBe(false);
  });
});

describe('parseCubeFile', () => {
  it('parses a minimal .cube file', () => {
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
    expect(lut.name).toBe('Test LUT');
    expect(lut.size).toBe(2);
    expect(lut.data).toHaveLength(24); // 8 entries * 3 components
  });

  it('skips comment lines', () => {
    const content = `# This is a comment
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 1.0 1.0`;
    const lut = parseCubeFile(content);
    expect(lut.size).toBe(2);
  });

  it('parses domain min/max', () => {
    const content = `DOMAIN_MIN -0.1 -0.1 -0.1
DOMAIN_MAX 1.1 1.1 1.1
0.0 0.0 0.0`;
    const lut = parseCubeFile(content);
    expect(lut.domainMin).toEqual({ r: -0.1, g: -0.1, b: -0.1 });
    expect(lut.domainMax).toEqual({ r: 1.1, g: 1.1, b: 1.1 });
  });
});

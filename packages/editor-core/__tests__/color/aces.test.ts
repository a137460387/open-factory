import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  multiplyMatrix3x3,
  multiplyMatrix4x4,
  multiplyMatrices3x3,
  invertMatrix3x3,
  TRANSFER_FUNCTIONS,
  TONE_MAPPING_FUNCTIONS,
  COLOR_SPACE_CONVERSIONS,
  LUTManager,
  ACESColorManager,
  createDefaultColorManagementConfig,
  validateColorManagementConfig,
  parseCubeFile,
  type RGBColor,
  type XYZColor,
  type LABColor,
  type ColorMatrix3x3,
  type LUTData,
  type ColorManagementConfig,
} from '../../src/color/aces';

// ==================== 辅助函数测试 ====================

describe('辅助函数', () => {
  describe('clamp', () => {
    it('应该限制值在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('应该正确插值', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
    });
  });

  describe('multiplyMatrix3x3', () => {
    it('应该正确计算矩阵向量乘法', () => {
      const matrix: ColorMatrix3x3 = [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ];
      const vector: RGBColor = { r: 1, g: 2, b: 3 };
      const result = multiplyMatrix3x3(matrix, vector);
      expect(result.r).toBe(1);
      expect(result.g).toBe(2);
      expect(result.b).toBe(3);
    });

    it('应该正确计算非单位矩阵', () => {
      const matrix: ColorMatrix3x3 = [
        2, 0, 0,
        0, 3, 0,
        0, 0, 4,
      ];
      const vector: RGBColor = { r: 1, g: 2, b: 3 };
      const result = multiplyMatrix3x3(matrix, vector);
      expect(result.r).toBe(2);
      expect(result.g).toBe(6);
      expect(result.b).toBe(12);
    });
  });

  describe('multiplyMatrix4x4', () => {
    it('应该正确计算4x4矩阵向量乘法', () => {
      const matrix = [
        1, 0, 0, 1,
        0, 1, 0, 2,
        0, 0, 1, 3,
        0, 0, 0, 1,
      ];
      const vector: RGBColor = { r: 1, g: 2, b: 3 };
      const result = multiplyMatrix4x4(matrix as any, vector);
      expect(result.r).toBe(2);
      expect(result.g).toBe(4);
      expect(result.b).toBe(6);
    });
  });

  describe('multiplyMatrices3x3', () => {
    it('应该正确计算矩阵乘法', () => {
      const a: ColorMatrix3x3 = [
        1, 2, 3,
        4, 5, 6,
        7, 8, 9,
      ];
      const b: ColorMatrix3x3 = [
        9, 8, 7,
        6, 5, 4,
        3, 2, 1,
      ];
      const result = multiplyMatrices3x3(a, b);
      expect(result[0]).toBe(30);
      expect(result[1]).toBe(24);
      expect(result[2]).toBe(18);
    });
  });

  describe('invertMatrix3x3', () => {
    it('应该计算单位矩阵的逆', () => {
      const identity: ColorMatrix3x3 = [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ];
      const inverse = invertMatrix3x3(identity);
      expect(inverse[0]).toBe(1);
      expect(inverse[1]).toBe(0);
      expect(inverse[2]).toBe(0);
    });

    it('应该计算可逆矩阵的逆', () => {
      const matrix: ColorMatrix3x3 = [
        2, 0, 0,
        0, 3, 0,
        0, 0, 4,
      ];
      const inverse = invertMatrix3x3(matrix);
      expect(inverse[0]).toBeCloseTo(0.5, 5);
      expect(inverse[4]).toBeCloseTo(1 / 3, 5);
      expect(inverse[8]).toBeCloseTo(0.25, 5);
    });

    it('应该对不可逆矩阵抛出错误', () => {
      const singular: ColorMatrix3x3 = [
        1, 0, 0,
        0, 0, 0,
        0, 0, 1,
      ];
      expect(() => invertMatrix3x3(singular)).toThrow();
    });
  });
});

// ==================== 传输特性函数测试 ====================

describe('传输特性函数', () => {
  describe('sRGB', () => {
    it('应该正确转换线性到sRGB', () => {
      expect(TRANSFER_FUNCTIONS.linearToSrgb(0)).toBe(0);
      expect(TRANSFER_FUNCTIONS.linearToSrgb(1)).toBeCloseTo(1, 2);
      expect(TRANSFER_FUNCTIONS.linearToSrgb(0.5)).toBeGreaterThan(0.5);
    });

    it('应该正确转换sRGB到线性', () => {
      expect(TRANSFER_FUNCTIONS.srgbToLinear(0)).toBe(0);
      expect(TRANSFER_FUNCTIONS.srgbToLinear(1)).toBeCloseTo(1, 2);
    });

    it('应该互为逆函数', () => {
      const value = 0.5;
      const srgb = TRANSFER_FUNCTIONS.linearToSrgb(value);
      const linear = TRANSFER_FUNCTIONS.srgbToLinear(srgb);
      expect(linear).toBeCloseTo(value, 5);
    });
  });

  describe('Gamma 2.2', () => {
    it('应该正确转换', () => {
      expect(TRANSFER_FUNCTIONS.linearToGamma22(0)).toBe(0);
      expect(TRANSFER_FUNCTIONS.linearToGamma22(1)).toBeCloseTo(1, 2);
    });
  });

  describe('PQ', () => {
    it('应该正确转换', () => {
      const value = 100; // 100 nits
      const pq = TRANSFER_FUNCTIONS.linearToPQ(value);
      expect(pq).toBeGreaterThan(0);
      expect(pq).toBeLessThanOrEqual(1);
    });
  });

  describe('HLG', () => {
    it('应该正确转换', () => {
      const value = 0.5;
      const hlg = TRANSFER_FUNCTIONS.linearToHLG(value);
      expect(hlg).toBeGreaterThan(0);
    });
  });

  describe('ACEScct', () => {
    it('应该正确转换', () => {
      const value = 0.5;
      const acescct = TRANSFER_FUNCTIONS.linearToACEScct(value);
      expect(acescct).toBeDefined();
    });

    it('应该互为逆函数', () => {
      const value = 0.5;
      const acescct = TRANSFER_FUNCTIONS.linearToACEScct(value);
      const linear = TRANSFER_FUNCTIONS.acescctToLinear(acescct);
      expect(linear).toBeCloseTo(value, 5);
    });
  });
});

// ==================== 色调映射函数测试 ====================

describe('色调映射函数', () => {
  describe('Reinhard', () => {
    it('应该映射颜色到[0, 1]', () => {
      const color: RGBColor = { r: 2, g: 3, b: 4 };
      const result = TONE_MAPPING_FUNCTIONS.reinhard(color);
      expect(result.r).toBeLessThanOrEqual(1);
      expect(result.g).toBeLessThanOrEqual(1);
      expect(result.b).toBeLessThanOrEqual(1);
    });
  });

  describe('ACES Hill', () => {
    it('应该映射颜色到[0, 1]', () => {
      const color: RGBColor = { r: 2, g: 3, b: 4 };
      const result = TONE_MAPPING_FUNCTIONS.acesHill(color);
      expect(result.r).toBeLessThanOrEqual(1);
      expect(result.g).toBeLessThanOrEqual(1);
      expect(result.b).toBeLessThanOrEqual(1);
    });
  });

  describe('Filmic', () => {
    it('应该映射颜色到[0, 1]', () => {
      const color: RGBColor = { r: 2, g: 3, b: 4 };
      const result = TONE_MAPPING_FUNCTIONS.filmic(color);
      expect(result.r).toBeLessThanOrEqual(1);
      expect(result.g).toBeLessThanOrEqual(1);
      expect(result.b).toBeLessThanOrEqual(1);
    });
  });
});

// ==================== 色彩空间转换测试 ====================

describe('色彩空间转换', () => {
  describe('sRGB到XYZ', () => {
    it('应该转换白色', () => {
      const white: RGBColor = { r: 1, g: 1, b: 1 };
      const xyz = COLOR_SPACE_CONVERSIONS.srgbToXYZ(white);
      expect(xyz.x).toBeCloseTo(0.9505, 2);
      expect(xyz.y).toBeCloseTo(1.0, 2);
      expect(xyz.z).toBeCloseTo(1.089, 2);
    });

    it('应该转换黑色', () => {
      const black: RGBColor = { r: 0, g: 0, b: 0 };
      const xyz = COLOR_SPACE_CONVERSIONS.srgbToXYZ(black);
      expect(xyz.x).toBeCloseTo(0, 2);
      expect(xyz.y).toBeCloseTo(0, 2);
      expect(xyz.z).toBeCloseTo(0, 2);
    });
  });

  describe('XYZ到sRGB', () => {
    it('应该转换白色', () => {
      const white: XYZColor = { x: 0.9505, y: 1.0, z: 1.089 };
      const srgb = COLOR_SPACE_CONVERSIONS.xyzToSrgb(white);
      expect(srgb.r).toBeCloseTo(1, 2);
      expect(srgb.g).toBeCloseTo(1, 2);
      expect(srgb.b).toBeCloseTo(1, 2);
    });
  });

  describe('XYZ到LAB', () => {
    it('应该转换白色', () => {
      const white: XYZColor = { x: 0.9505, y: 1.0, z: 1.089 };
      const lab = COLOR_SPACE_CONVERSIONS.xyzToLab(white);
      expect(lab.l).toBeCloseTo(100, 0);
      expect(lab.a).toBeCloseTo(0, 0);
      expect(lab.b).toBeCloseTo(0, 0);
    });
  });

  describe('LAB到XYZ', () => {
    it('应该转换白色', () => {
      const white: LABColor = { l: 100, a: 0, b: 0 };
      const xyz = COLOR_SPACE_CONVERSIONS.labToXYZ(white);
      expect(xyz.x).toBeCloseTo(0.9505, 2);
      expect(xyz.y).toBeCloseTo(1.0, 2);
      expect(xyz.z).toBeCloseTo(1.089, 2);
    });
  });
});

// ==================== LUT管理器测试 ====================

describe('LUT管理器', () => {
  describe('LUTManager', () => {
    it('应该添加和获取LUT', () => {
      const manager = new LUTManager();
      const lut: LUTData = {
        id: 'test-lut',
        name: 'Test LUT',
        type: '3d',
        size: 3,
        data: new Float32Array(27 * 3),
        sourceColorSpace: 'srgb',
        targetColorSpace: 'srgb',
        domainMin: { r: 0, g: 0, b: 0 },
        domainMax: { r: 1, g: 1, b: 1 },
      };

      manager.addLUT(lut);
      expect(manager.getLUT('test-lut')).toBe(lut);
    });

    it('应该移除LUT', () => {
      const manager = new LUTManager();
      const lut: LUTData = {
        id: 'test-lut',
        name: 'Test LUT',
        type: '3d',
        size: 3,
        data: new Float32Array(27 * 3),
        sourceColorSpace: 'srgb',
        targetColorSpace: 'srgb',
        domainMin: { r: 0, g: 0, b: 0 },
        domainMax: { r: 1, g: 1, b: 1 },
      };

      manager.addLUT(lut);
      expect(manager.removeLUT('test-lut')).toBe(true);
      expect(manager.getLUT('test-lut')).toBeUndefined();
    });

    it('应该列出所有LUT', () => {
      const manager = new LUTManager();
      const lut1: LUTData = {
        id: 'lut-1',
        name: 'LUT 1',
        type: '3d',
        size: 3,
        data: new Float32Array(27 * 3),
        sourceColorSpace: 'srgb',
        targetColorSpace: 'srgb',
        domainMin: { r: 0, g: 0, b: 0 },
        domainMax: { r: 1, g: 1, b: 1 },
      };
      const lut2: LUTData = {
        id: 'lut-2',
        name: 'LUT 2',
        type: '1d',
        size: 256,
        data: new Float32Array(256 * 3),
        sourceColorSpace: 'srgb',
        targetColorSpace: 'srgb',
        domainMin: { r: 0, g: 0, b: 0 },
        domainMax: { r: 1, g: 1, b: 1 },
      };

      manager.addLUT(lut1);
      manager.addLUT(lut2);
      expect(manager.listLUTs().length).toBe(2);
    });

    it('应该应用3D LUT', () => {
      const manager = new LUTManager();
      const lut: LUTData = {
        id: 'identity-lut',
        name: 'Identity LUT',
        type: '3d',
        size: 2,
        data: new Float32Array([
          0, 0, 0, 1, 0, 0,
          0, 1, 0, 1, 1, 0,
          0, 0, 1, 1, 0, 1,
          0, 1, 1, 1, 1, 1,
        ]),
        sourceColorSpace: 'srgb',
        targetColorSpace: 'srgb',
        domainMin: { r: 0, g: 0, b: 0 },
        domainMax: { r: 1, g: 1, b: 1 },
      };

      manager.addLUT(lut);
      const color: RGBColor = { r: 0.5, g: 0.5, b: 0.5 };
      const result = manager.apply3DLUT(lut, color);
      expect(result.r).toBeDefined();
      expect(result.g).toBeDefined();
      expect(result.b).toBeDefined();
    });
  });
});

// ==================== ACES色彩管理器测试 ====================

describe('ACES色彩管理器', () => {
  describe('ACESColorManager', () => {
    it('应该创建默认配置', () => {
      const manager = new ACESColorManager();
      const config = manager.getConfig();
      expect(config.workingColorSpace).toBe('acescg');
      expect(config.displayColorSpace).toBe('srgb');
      expect(config.enableACES).toBe(true);
    });

    it('应该更新配置', () => {
      const manager = new ACESColorManager();
      manager.updateConfig({ enableHDR: true });
      expect(manager.getConfig().enableHDR).toBe(true);
    });

    it('应该转换色彩空间', () => {
      const manager = new ACESColorManager();
      const color: RGBColor = { r: 1, g: 0, b: 0 };
      const converted = manager.convertColorSpace(color, 'srgb', 'acescg');
      expect(converted.r).toBeDefined();
      expect(converted.g).toBeDefined();
      expect(converted.b).toBeDefined();
    });

    it('应该应用色调映射', () => {
      const manager = new ACESColorManager();
      const color: RGBColor = { r: 2, g: 3, b: 4 };
      const mapped = manager.applyToneMapping(color);
      expect(mapped.r).toBeLessThanOrEqual(1);
      expect(mapped.g).toBeLessThanOrEqual(1);
      expect(mapped.b).toBeLessThanOrEqual(1);
    });

    it('应该生成OCIO配置', () => {
      const manager = new ACESColorManager();
      const ocioConfig = manager.generateOCIOConfig();
      expect(ocioConfig.name).toBe('Open Factory ACES Config');
      expect(ocioConfig.colorSpaces.length).toBeGreaterThan(0);
    });
  });
});

// ==================== 配置测试 ====================

describe('配置', () => {
  describe('createDefaultColorManagementConfig', () => {
    it('应该创建默认配置', () => {
      const config = createDefaultColorManagementConfig();
      expect(config.workingColorSpace).toBe('acescg');
      expect(config.displayColorSpace).toBe('srgb');
      expect(config.outputColorSpace).toBe('rec709');
      expect(config.enableACES).toBe(true);
      expect(config.acesVersion).toBe('1.3');
      expect(config.enableHDR).toBe(false);
      expect(config.hdrPeakLuminance).toBe(1000);
      expect(config.enableToneMapping).toBe(true);
      expect(config.toneMappingMethod).toBe('aces-hill');
      expect(config.enableLUT).toBe(true);
      expect(config.lutSize).toBe(33);
    });
  });

  describe('validateColorManagementConfig', () => {
    it('应该验证有效配置', () => {
      const config = createDefaultColorManagementConfig();
      expect(validateColorManagementConfig(config)).toBe(true);
    });

    it('应该拒绝无效配置', () => {
      const invalid = { enableACES: 'invalid' } as any;
      expect(validateColorManagementConfig(invalid)).toBe(false);
    });
  });
});

// ==================== LUT解析测试 ====================

describe('LUT解析', () => {
  describe('parseCubeFile', () => {
    it('应该解析有效的.cube文件', () => {
      const content = `TITLE "Test LUT"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1`;

      const lut = parseCubeFile(content);
      expect(lut.name).toBe('Test LUT');
      expect(lut.type).toBe('3d');
      expect(lut.size).toBe(2);
      expect(lut.data.length).toBe(24); // 8 * 3
    });
  });
});

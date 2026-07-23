/**
 * Tests for Personal Style Model Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createStyleModel,
  applyStyleToProject,
  compareStyleModels,
  generateStyleNodeData,
  LocalStyleModelStorage,
  type PersonalStyleModel,
} from './style-model-manager';

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock timeline data
const mockTimeline = {
  tracks: [
    {
      id: 'track-1',
      clips: [
        { start: 0, duration: 3, mediaId: 'media-1', transition: { type: 'hard-cut' } },
        { start: 3, duration: 5, mediaId: 'media-2', transition: { type: 'cross-dissolve' } },
        { start: 8, duration: 2, mediaId: 'media-3', transition: { type: 'hard-cut' } },
      ],
    },
  ],
};

const mockProject = {
  id: 'project-1',
  timeline: mockTimeline,
  presets: [
    {
      type: 'color-grading',
      params: {
        lut: 'cinematic-warm.lut',
        colorTemperature: 5800,
        contrast: 15,
        saturation: 10,
      },
    },
  ],
};

describe('createStyleModel', () => {
  it('should create a style model from projects', () => {
    const model = createStyleModel([mockProject]);

    expect(model.id).toBeDefined();
    expect(model.sourceProjectIds).toEqual(['project-1']);
    expect(model.editingStyle.vector).toHaveLength(128);
    expect(model.colorProfile).toBeDefined();
    expect(model.combinedVector).toHaveLength(256);
    expect(model.summary).toBeDefined();
  });

  it('should merge multiple projects', () => {
    const project2 = {
      ...mockProject,
      id: 'project-2',
    };

    const model = createStyleModel([mockProject, project2]);

    expect(model.sourceProjectIds).toEqual(['project-1', 'project-2']);
    expect(model.summary).toBeDefined();
  });

  it('should preserve existing model ID when updating', () => {
    const existingModel: PersonalStyleModel = {
      id: 'existing-id',
      createdAt: 1000,
      updatedAt: 1000,
      sourceProjectIds: [],
      editingStyle: { vector: new Array(128).fill(0), dimensions: [], confidence: [] },
      colorProfile: {
        topLuts: [],
        avgColorTemperature: 5500,
        colorTemperatureStdDev: 0,
        avgContrast: 0,
        contrastRange: { min: 0, max: 0 },
        avgSaturation: 0,
        saturationRange: { min: 0, max: 0 },
        styleClusters: [],
        dominantStyle: null,
        preferenceVector: new Array(64).fill(0),
      },
      combinedVector: new Array(256).fill(0),
      summary: {
        editingPace: 'medium',
        shotDuration: 'medium',
        colorTemperature: 'neutral',
        contrast: 'medium',
        saturation: 'natural',
        topLuts: [],
        description: 'test',
      },
    };

    const model = createStyleModel([mockProject], existingModel);

    expect(model.id).toBe('existing-id');
    expect(model.createdAt).toBe(1000);
    expect(model.updatedAt).toBeGreaterThan(1000);
  });
});

describe('applyStyleToProject', () => {
  let model: PersonalStyleModel;

  beforeEach(() => {
    model = createStyleModel([mockProject]);
  });

  it('should generate edit point recommendations', () => {
    const result = applyStyleToProject(model, mockTimeline);

    expect(result.editPoints).toBeDefined();
    expect(Array.isArray(result.editPoints)).toBe(true);
  });

  it('should generate color grading recommendations', () => {
    const result = applyStyleToProject(model, mockTimeline);

    expect(result.colorGrading).toBeDefined();
    expect(result.colorGrading.params).toBeDefined();
    expect(result.colorGrading.confidence).toBeGreaterThanOrEqual(0);
    expect(result.colorGrading.confidence).toBeLessThanOrEqual(1);
  });

  it('should return match score', () => {
    const result = applyStyleToProject(model, mockTimeline);

    expect(result.matchScore).toBeGreaterThanOrEqual(0);
    expect(result.matchScore).toBeLessThanOrEqual(1);
  });

  it('should handle empty timeline', () => {
    const emptyTimeline = { tracks: [] };
    const result = applyStyleToProject(model, emptyTimeline);

    expect(result.editPoints).toHaveLength(0);
    expect(result.colorGrading).toBeDefined();
  });

  it('should use audio beat times when provided', () => {
    const beatTimes = [1.0, 2.0, 3.0, 4.0, 5.0];
    const result = applyStyleToProject(model, mockTimeline, beatTimes);

    expect(result.editPoints).toBeDefined();
  });
});

describe('compareStyleModels', () => {
  it('should return similarity between two models', () => {
    const model1 = createStyleModel([mockProject]);
    const model2 = createStyleModel([mockProject]);

    const similarity = compareStyleModels(model1, model2);

    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1.001); // Allow floating point tolerance
    expect(similarity).toBeGreaterThan(0.9); // Same source should be very similar
  });

  it('should return 0 for models with zero vectors', () => {
    const emptyModel: PersonalStyleModel = {
      id: 'empty',
      createdAt: 0,
      updatedAt: 0,
      sourceProjectIds: [],
      editingStyle: { vector: new Array(128).fill(0), dimensions: [], confidence: [] },
      colorProfile: {
        topLuts: [],
        avgColorTemperature: 5500,
        colorTemperatureStdDev: 0,
        avgContrast: 0,
        contrastRange: { min: 0, max: 0 },
        avgSaturation: 0,
        saturationRange: { min: 0, max: 0 },
        styleClusters: [],
        dominantStyle: null,
        preferenceVector: new Array(64).fill(0),
      },
      combinedVector: new Array(256).fill(0),
      summary: {
        editingPace: 'medium',
        shotDuration: 'medium',
        colorTemperature: 'neutral',
        contrast: 'medium',
        saturation: 'natural',
        topLuts: [],
        description: 'empty',
      },
    };

    const similarity = compareStyleModels(emptyModel, emptyModel);
    expect(similarity).toBe(0);
  });
});

describe('generateStyleNodeData', () => {
  it('should generate node data for node editor', () => {
    const model = createStyleModel([mockProject]);
    const nodeData = generateStyleNodeData(model);

    expect(nodeData.inputs).toBeDefined();
    expect(nodeData.inputs.colorTemperature).toBeDefined();
    expect(nodeData.inputs.contrast).toBeDefined();
    expect(nodeData.inputs.saturation).toBeDefined();
    expect(nodeData.metadata).toBeDefined();
    expect(nodeData.metadata.modelId).toBe(model.id);
  });

  it('should include LUT when available', () => {
    const model = createStyleModel([mockProject]);
    const nodeData = generateStyleNodeData(model);

    if (model.colorProfile.topLuts.length > 0) {
      expect(nodeData.lut).toBeDefined();
    }
  });
});

describe('LocalStyleModelStorage', () => {
  let storage: LocalStyleModelStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStyleModelStorage();
  });

  it('should save and load models', () => {
    const model = createStyleModel([mockProject]);
    storage.saveModel(model);

    const loaded = storage.loadModels();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(model.id);
  });

  it('should update existing model', () => {
    const model = createStyleModel([mockProject]);
    storage.saveModel(model);

    const updated = { ...model, updatedAt: Date.now() + 1000 };
    storage.saveModel(updated);

    const loaded = storage.loadModels();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].updatedAt).toBe(updated.updatedAt);
  });

  it('should delete models', () => {
    const model = createStyleModel([mockProject]);
    storage.saveModel(model);
    storage.deleteModel(model.id);

    const loaded = storage.loadModels();
    expect(loaded).toHaveLength(0);
  });

  it('should manage active model', () => {
    const model = createStyleModel([mockProject]);
    storage.saveModel(model);

    expect(storage.getActiveModel()).toBeNull();

    storage.setActiveModel(model.id);
    expect(storage.getActiveModel()?.id).toBe(model.id);

    storage.setActiveModel(null);
    expect(storage.getActiveModel()).toBeNull();
  });

  it('should clear active model when deleted', () => {
    const model = createStyleModel([mockProject]);
    storage.saveModel(model);
    storage.setActiveModel(model.id);
    storage.deleteModel(model.id);

    expect(storage.getActiveModel()).toBeNull();
  });
});

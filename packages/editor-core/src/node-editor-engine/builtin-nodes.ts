/**
 * Built-in node definitions for the node editor engine.
 */

import type {NodeDefinition} from '../node-editor-types';

export const BUILTIN_NODES: readonly NodeDefinition[] = [
  // Input nodes
  {
    type: 'input.video',
    name: 'Video Input',
    description: 'Load video from media library',
    category: 'input',
    icon: '🎬',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'video', name: 'Video', direction: 'output', dataType: 'video' },
      { id: 'audio', name: 'Audio', direction: 'output', dataType: 'audio' },
    ],
  },
  {
    type: 'input.audio',
    name: 'Audio Input',
    description: 'Load audio from media library',
    category: 'input',
    icon: '🎵',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'audio', name: 'Audio', direction: 'output', dataType: 'audio' },
    ],
  },
  {
    type: 'input.image',
    name: 'Image Input',
    description: 'Load image from media library',
    category: 'input',
    icon: '🖼️',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'image', name: 'Image', direction: 'output', dataType: 'image' },
    ],
  },
  {
    type: 'input.timeline',
    name: 'Timeline Input',
    description: 'Use current timeline as input',
    category: 'input',
    icon: '⏱️',
    color: '#4CAF50',
    inputs: [],
    outputs: [
      { id: 'timeline', name: 'Timeline', direction: 'output', dataType: 'timeline' },
      { id: 'clips', name: 'Clips', direction: 'output', dataType: 'clip', multiple: true },
    ],
  },

  // AI Engine nodes
  {
    type: 'ai.highlight-detection',
    name: 'Highlight Detection',
    description: 'Detect highlight moments in video',
    category: 'ai-engine',
    icon: '⭐',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'highlights', name: 'Highlights', direction: 'output', dataType: 'metadata' },
      { id: 'timestamps', name: 'Timestamps', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      sensitivity: 0.7,
      minDuration: 1,
    },
  },
  {
    type: 'ai.smart-trim',
    name: 'Smart Trim',
    description: 'AI-powered intelligent video trimming',
    category: 'ai-engine',
    icon: '✂️',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
      { id: 'highlights', name: 'Highlights', direction: 'input', dataType: 'metadata' },
    ],
    outputs: [
      { id: 'trimmed', name: 'Trimmed Video', direction: 'output', dataType: 'video' },
      { id: 'segments', name: 'Segments', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      aggressiveness: 'medium',
      keepPace: true,
    },
  },
  {
    type: 'ai.auto-subtitle',
    name: 'Auto Subtitle',
    description: 'Generate subtitles from speech',
    category: 'ai-engine',
    icon: '💬',
    color: '#2196F3',
    inputs: [
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio', required: true },
    ],
    outputs: [
      { id: 'subtitles', name: 'Subtitles', direction: 'output', dataType: 'subtitle' },
    ],
    defaultConfig: {
      language: 'auto',
      maxCharsPerLine: 42,
      style: 'default',
    },
  },
  {
    type: 'ai.color-grading',
    name: 'AI Color Grading',
    description: 'Automatic color correction and grading',
    category: 'ai-engine',
    icon: '🎨',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'graded', name: 'Graded Video', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      style: 'cinematic',
      intensity: 0.8,
    },
  },
  {
    type: 'ai.audio-enhance',
    name: 'Audio Enhance',
    description: 'Enhance audio quality with AI',
    category: 'ai-engine',
    icon: '🔊',
    color: '#2196F3',
    inputs: [
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio', required: true },
    ],
    outputs: [
      { id: 'enhanced', name: 'Enhanced Audio', direction: 'output', dataType: 'audio' },
    ],
    defaultConfig: {
      denoise: true,
      normalize: true,
      targetLoudness: -14,
    },
  },
  {
    type: 'ai.scene-detection',
    name: 'Scene Detection',
    description: 'Detect scene changes in video',
    category: 'ai-engine',
    icon: '🎬',
    color: '#2196F3',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'scenes', name: 'Scenes', direction: 'output', dataType: 'metadata' },
      { id: 'timestamps', name: 'Timestamps', direction: 'output', dataType: 'metadata' },
    ],
    defaultConfig: {
      threshold: 0.3,
      minSceneLength: 0.5,
    },
  },

  // Transform nodes
  {
    type: 'transform.crop',
    name: 'Crop',
    description: 'Crop video or image',
    category: 'transform',
    icon: '🔲',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    },
  },
  {
    type: 'transform.resize',
    name: 'Resize',
    description: 'Resize video or image',
    category: 'transform',
    icon: '↔️',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      width: 1920,
      height: 1080,
      maintainAspectRatio: true,
    },
  },
  {
    type: 'transform.speed',
    name: 'Speed Change',
    description: 'Change playback speed',
    category: 'transform',
    icon: '⏩',
    color: '#FF9800',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'video', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'video' },
    ],
    defaultConfig: {
      speed: 1.0,
      keepAudio: true,
    },
  },

  // Output nodes
  {
    type: 'output.timeline',
    name: 'Timeline Output',
    description: 'Send result to timeline',
    category: 'output',
    icon: '📤',
    color: '#9C27B0',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video' },
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio' },
      { id: 'subtitles', name: 'Subtitles', direction: 'input', dataType: 'subtitle' },
    ],
    outputs: [],
    defaultConfig: {
      trackName: 'AI Output',
      autoAlign: true,
    },
  },
  {
    type: 'output.export',
    name: 'Export',
    description: 'Export to file',
    category: 'output',
    icon: '💾',
    color: '#9C27B0',
    inputs: [
      { id: 'video', name: 'Video', direction: 'input', dataType: 'video', required: true },
      { id: 'audio', name: 'Audio', direction: 'input', dataType: 'audio' },
    ],
    outputs: [],
    defaultConfig: {
      format: 'mp4',
      quality: 'high',
      outputPath: '',
    },
  },

  // Control flow nodes
  {
    type: 'control.if',
    name: 'If Condition',
    description: 'Conditional branching',
    category: 'control',
    icon: '❓',
    color: '#607D8B',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'any', required: true },
      { id: 'condition', name: 'Condition', direction: 'input', dataType: 'metadata' },
    ],
    outputs: [
      { id: 'true', name: 'True', direction: 'output', dataType: 'any' },
      { id: 'false', name: 'False', direction: 'output', dataType: 'any' },
    ],
  },
  {
    type: 'control.merge',
    name: 'Merge',
    description: 'Merge multiple inputs',
    category: 'control',
    icon: '🔀',
    color: '#607D8B',
    inputs: [
      { id: 'input1', name: 'Input 1', direction: 'input', dataType: 'any' },
      { id: 'input2', name: 'Input 2', direction: 'input', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'any' },
    ],
  },
  {
    type: 'control.delay',
    name: 'Delay',
    description: 'Add delay between operations',
    category: 'control',
    icon: '⏳',
    color: '#607D8B',
    inputs: [
      { id: 'input', name: 'Input', direction: 'input', dataType: 'any', required: true },
    ],
    outputs: [
      { id: 'output', name: 'Output', direction: 'output', dataType: 'any' },
    ],
    defaultConfig: {
      duration: 1000,
    },
  },
];

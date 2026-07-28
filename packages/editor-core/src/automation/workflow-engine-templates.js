/**
 * Built-in workflow templates
 */

/** 内置工作流模板 */
export const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-auto-quality-fix',
    name: '自动质量修复',
    description: '当素材质量低于阈值时自动应用修复效果',
    category: '质量',
    workflow: {
      name: '自动质量修复',
      description: '检测低质量素材并自动应用修复',
      version: '1.0.0',
      triggers: [
        {
          id: 'trigger-quality',
          type: 'scene-detected',
          params: { afterAnalysis: true },
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'step-check',
          name: '检查质量分数',
          conditions: [
            {
              id: 'cond-quality',
              field: 'scene.quality',
              operator: 'less_than',
              value: 70,
            },
          ],
          actions: [
            {
              id: 'action-fix',
              type: 'apply-effect',
              params: { effectType: 'quality-enhance', intensity: 0.8 },
              continueOnError: false,
            },
          ],
          skipOnError: false,
        },
      ],
      enabled: true,
      tags: ['质量', '自动修复'],
    },
  },
  {
    id: 'tpl-auto-subtitle',
    name: '自动字幕生成',
    description: '导入媒体后自动生成字幕',
    category: '字幕',
    workflow: {
      name: '自动字幕生成',
      description: '为导入的视频自动生成字幕',
      version: '1.0.0',
      triggers: [
        {
          id: 'trigger-import',
          type: 'media-import',
          params: { mediaTypes: ['video'] },
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'step-analyze',
          name: '分析音频',
          conditions: [],
          actions: [
            {
              id: 'action-transcribe',
              type: 'analyze-scene',
              params: { analysisType: 'transcription' },
              continueOnError: false,
            },
          ],
          skipOnError: false,
        },
        {
          id: 'step-subtitle',
          name: '生成字幕',
          conditions: [],
          actions: [
            {
              id: 'action-add-sub',
              type: 'add-subtitle',
              params: { style: 'default' },
              continueOnError: true,
            },
          ],
          skipOnError: true,
        },
      ],
      enabled: true,
      tags: ['字幕', '自动'],
    },
  },
  {
    id: 'tpl-smart-cut',
    name: '智能剪辑流程',
    description: '自动分析场景并执行智能剪辑',
    category: '剪辑',
    workflow: {
      name: '智能剪辑流程',
      description: '从场景分析到智能剪辑的完整流程',
      version: '1.0.0',
      triggers: [
        {
          id: 'trigger-manual',
          type: 'manual',
          params: {},
          enabled: true,
        },
      ],
      steps: [
        {
          id: 'step-scene',
          name: '场景分析',
          conditions: [],
          actions: [
            {
              id: 'action-analyze',
              type: 'analyze-scene',
              params: { detectScenes: true, generateTags: true },
              continueOnError: false,
            },
          ],
          skipOnError: false,
        },
        {
          id: 'step-cut',
          name: '智能剪辑',
          conditions: [
            {
              id: 'cond-has-scenes',
              field: 'analysis.sceneCount',
              operator: 'greater_than',
              value: 0,
            },
          ],
          actions: [
            {
              id: 'action-cut',
              type: 'auto-cut',
              params: { strategy: 'highlight', maxDuration: 60 },
              continueOnError: false,
            },
          ],
          skipOnError: false,
        },
        {
          id: 'step-grade',
          name: '自动调色',
          conditions: [],
          actions: [
            {
              id: 'action-grade',
              type: 'apply-color-grade',
              params: { preset: 'cinematic' },
              continueOnError: true,
            },
          ],
          skipOnError: true,
        },
      ],
      enabled: true,
      tags: ['剪辑', '智能', '完整流程'],
    },
  },
];

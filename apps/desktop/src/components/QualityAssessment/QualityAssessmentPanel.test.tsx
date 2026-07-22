// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock Tauri bridge
vi.mock('../../lib/tauri-bridge', () => ({
  callAiApi: vi.fn().mockResolvedValue(JSON.stringify({ grade: 'A', score: 85, dimensions: [], issues: [], suggestions: [] })),
  readAiApiKey: vi.fn().mockResolvedValue('test-key'),
}));

// Mock toast
vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
}));

// Mock AI settings store
vi.mock('../../store/aiSettingsStore', () => ({
  useAISettingsStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      providers: [
        { id: 'openai', name: 'OpenAI', enabled: true, type: 'text' },
        { id: 'claude', name: 'Claude', enabled: true, type: 'text' },
      ],
    }),
  ),
}));

// Mock editor-core
vi.mock('@open-factory/editor-core', () => ({
  buildEnhancedQualitySystemPrompt: vi.fn(() => 'system prompt'),
  parseEnhancedQualityResponseSafe: vi.fn(() => ({
    grade: 'A',
    score: 85,
    dimensions: [
      { key: 'sharpness', score: 90, grade: 'A', notes: '清晰度良好' },
      { key: 'noise', score: 80, grade: 'B', notes: '噪点可控' },
    ],
    issues: [
      { severity: 'medium', description: '部分画面偏暗', location: '00:30-01:00', fix: '调整曝光' },
    ],
    suggestions: [
      { priority: 'high', action: '增加对比度', expectedImprovement: 5 },
    ],
  })),
  mapScoreToEnhancedGrade: vi.fn(() => 'A'),
}));

import { QualityAssessmentPanel } from './QualityAssessmentPanel';

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  timeline: {
    tracks: [
      {
        id: 'track-1',
        type: 'video',
        clips: [
          { id: 'clip-1', start: 0, duration: 10, mediaFile: 'test.mp4' },
        ],
      },
    ],
  },
} as any;

describe('QualityAssessmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state with profile selector', () => {
    const { container } = render(
      <QualityAssessmentPanel project={mockProject} onClose={() => {}} />,
    );
    expect(container.textContent).toContain('质量评估');
    expect(container.textContent).toContain('广播级');
    expect(container.textContent).toContain('网络发布');
  });

  it('renders close button', () => {
    const onClose = vi.fn();
    const { container } = render(
      <QualityAssessmentPanel project={mockProject} onClose={onClose} />,
    );
    const closeBtn = container.querySelector('button');
    expect(closeBtn).toBeTruthy();
  });

  it('displays assessment button text', () => {
    const { container } = render(
      <QualityAssessmentPanel project={mockProject} onClose={() => {}} />,
    );
    expect(container.textContent).toContain('开始评估');
  });
});

import React from 'react';
import type { Clip, ColorCorrection } from '@open-factory/editor-core';
interface Props { clip: Clip; onCommitColorCorrection: (patch: Partial<ColorCorrection>) => void; onChooseLUT: () => void; }
export const ProfessionalColorGradingPanel: React.FC<Props> = () => <div data-testid="professional-color-grading-panel" className="p-2 text-xs text-[var(--color-text-muted)]">开发中</div>;

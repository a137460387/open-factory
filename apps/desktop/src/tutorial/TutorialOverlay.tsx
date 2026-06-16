import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { TUTORIAL_STEPS, type TutorialProgressSettings, type TutorialStepDefinition } from './tutorialState';

interface TutorialOverlayProps {
  progress: TutorialProgressSettings;
  onSkip(): void;
  onCloseCelebration(): void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const PADDING = 8;

export function TutorialOverlay({ progress, onSkip, onCloseCelebration }: TutorialOverlayProps) {
  const step = TUTORIAL_STEPS[progress.tutorialStep];
  const [rect, setRect] = useState<Rect | undefined>();
  const completed = progress.tutorialCompleted;

  useEffect(() => {
    if (!step || completed) {
      setRect(undefined);
      return undefined;
    }
    let frame = 0;
    const update = () => {
      const target = findTutorialTarget(step.targetSelector);
      if (!target) {
        setRect(undefined);
        return;
      }
      const bounds = target.getBoundingClientRect();
      setRect({
        left: Math.max(0, bounds.left - PADDING),
        top: Math.max(0, bounds.top - PADDING),
        width: Math.min(window.innerWidth, bounds.width + PADDING * 2),
        height: Math.min(window.innerHeight, bounds.height + PADDING * 2)
      });
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    const interval = window.setInterval(update, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.clearInterval(interval);
    };
  }, [completed, step]);

  if (completed) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" data-testid="tutorial-complete-overlay">
        <div className="w-full max-w-sm rounded-md border border-line bg-white p-5 text-center shadow-soft">
          <CheckCircle2 className="mx-auto text-brand" size={36} />
          <div className="mt-3 text-base font-semibold text-ink">{zhCN.tutorial.completedTitle}</div>
          <button
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-[#176858]"
            type="button"
            data-testid="tutorial-complete-close"
            onClick={onCloseCelebration}
          >
            {zhCN.common.close}
          </button>
        </div>
      </div>
    );
  }

  if (!step) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] text-white" data-testid="tutorial-overlay" data-step-index={progress.tutorialStep} data-step-id={step.id}>
      <TutorialMask rect={rect} />
      {rect ? <div className="pointer-events-none fixed rounded-md border-2 border-amber-300 shadow-[0_0_0_4px_rgba(250,204,21,0.28),0_0_28px_rgba(250,204,21,0.5)]" style={rectStyle(rect)} data-testid="tutorial-highlight" /> : null}
      <TutorialBubble step={step} rect={rect} progress={progress} onSkip={onSkip} />
    </div>
  );
}

function TutorialMask({ rect }: { rect?: Rect }) {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  if (!rect) {
    return <div className="pointer-events-auto fixed inset-0 bg-black/60" data-testid="tutorial-mask" />;
  }
  const right = Math.max(0, viewportWidth - rect.left - rect.width);
  const bottom = Math.max(0, viewportHeight - rect.top - rect.height);
  return (
    <>
      <div className="pointer-events-auto fixed left-0 right-0 top-0 bg-black/60" style={{ height: rect.top }} data-testid="tutorial-mask-top" />
      <div className="pointer-events-auto fixed left-0 bg-black/60" style={{ top: rect.top, width: rect.left, height: rect.height }} data-testid="tutorial-mask-left" />
      <div className="pointer-events-auto fixed bg-black/60" style={{ top: rect.top, right: 0, width: right, height: rect.height }} data-testid="tutorial-mask-right" />
      <div className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-black/60" style={{ height: bottom }} data-testid="tutorial-mask-bottom" />
    </>
  );
}

function TutorialBubble({ step, rect, progress, onSkip }: { step: TutorialStepDefinition; rect?: Rect; progress: TutorialProgressSettings; onSkip(): void }) {
  const style = useMemo(() => {
    if (!rect) {
      return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }
    const width = 320;
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.left));
    const below = rect.top + rect.height + 12;
    const top = below + 180 < window.innerHeight ? below : Math.max(16, rect.top - 188);
    return { left, top, width };
  }, [rect]);
  const t = zhCN.tutorial;
  const copy = t.steps[step.id];
  return (
    <aside className="pointer-events-auto fixed rounded-md border border-white/20 bg-slate-950/95 p-4 text-white shadow-soft" style={style} data-testid="tutorial-bubble">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">{t.progress(progress.tutorialStep + 1, TUTORIAL_STEPS.length)}</div>
          <h2 className="mt-1 text-base font-semibold">{copy.title}</h2>
        </div>
        <button className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white" type="button" title={t.skip} aria-label={t.skip} data-testid="tutorial-skip-button" onClick={onSkip}>
          <X size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-5 text-slate-200">{copy.body}</p>
      <div className="mt-3 rounded border border-amber-200/30 bg-amber-200/10 px-2 py-1.5 text-xs text-amber-100" data-testid="tutorial-step-waiting">
        {t.waitingForAction}
      </div>
    </aside>
  );
}

function rectStyle(rect: Rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function findTutorialTarget(targetSelector: string): HTMLElement | undefined {
  const selectors = targetSelector
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
  for (const selector of selectors) {
    const target = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisibleTutorialTarget);
    if (target) {
      return target;
    }
  }
  return undefined;
}

function isVisibleTutorialTarget(target: HTMLElement): boolean {
  const bounds = target.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }
  const style = window.getComputedStyle(target);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

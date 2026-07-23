/**
 * Gesture Tutorial Overlay
 *
 * First-launch gesture tutorial that guides users through
 * each supported gesture with camera preview and live feedback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Hand,
  ChevronRight,
  ChevronLeft,
  X,
  Camera,
  CameraOff,
  Check,
  SkipForward,
} from 'lucide-react';
import {
  getGestureTutorialSteps,
  type GestureType,
  type GestureMapping,
  DEFAULT_GESTURE_MAPPINGS,
} from '@open-factory/editor-core/gesture-control';
import { clsx } from 'clsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GestureTutorialOverlayProps {
  /** Whether the tutorial is visible */
  open: boolean;
  /** Called when tutorial is completed or dismissed */
  onClose(): void;
  /** Called when user wants to enable gesture control */
  onEnableGesture?(): void;
}

// ---------------------------------------------------------------------------
// Gesture icon mapping (simple SVG hand poses)
// ---------------------------------------------------------------------------

const GESTURE_EMOJI: Record<GestureType, string> = {
  'swipe-left': '👈',
  'swipe-right': '👉',
  'swipe-up': '👆',
  'swipe-down': '👇',
  'pinch-in': '🤏',
  'pinch-out': '🖐️',
  'fist': '✊',
  'open-palm': '✋',
  'point': '☝️',
  'two-finger-tap': '✌️',
  'thumbs-up': '👍',
  'thumbs-down': '👎',
  'peace-sign': '✌️',
  'grab': '✊',
  'release': '🖐️',
  'none': '❓',
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function GestureTutorialOverlay({ open, onClose, onEnableGesture }: GestureTutorialOverlayProps) {
  const steps = getGestureTutorialSteps();
  const [currentStep, setCurrentStep] = useState(0);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check camera availability
  useEffect(() => {
    if (!open) return;

    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const hasCamera = devices.some((d) => d.kind === 'videoinput');
      setCameraAvailable(hasCamera);
    }).catch(() => {
      setCameraAvailable(false);
    });
  }, [open]);

  // Start camera preview
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraAvailable(false);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
  }, [cameraStream]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopCamera();
      setCurrentStep(0);
    }
  }, [open, stopCamera]);

  if (!open) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="gesture-tutorial-overlay"
    >
      <div className="relative w-full max-w-md rounded-xl border border-line bg-[var(--color-bg-elevated)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Hand size={16} className="text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">手势控制教程</span>
          </div>
          <button
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="gesture-tutorial-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[var(--color-bg-secondary)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Camera preview area */}
        <div className="relative mx-4 mt-4 aspect-video overflow-hidden rounded-lg bg-black/90">
          {cameraStream ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              data-testid="gesture-camera-preview"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-white/50">
              {cameraAvailable === false ? (
                <>
                  <CameraOff size={32} />
                  <span className="text-xs">未检测到摄像头</span>
                </>
              ) : (
                <>
                  <Camera size={32} />
                  <button
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                    type="button"
                    onClick={startCamera}
                    data-testid="gesture-start-camera"
                  >
                    开启摄像头
                  </button>
                </>
              )}
            </div>
          )}

          {/* Gesture emoji overlay */}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1.5 text-2xl">
            {GESTURE_EMOJI[step.gesture]}
          </div>
        </div>

        {/* Step content */}
        <div className="px-4 py-4">
          <div className="mb-1 text-lg font-semibold text-[var(--color-text-secondary)]">
            {step.instruction}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {step.tip}
          </div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            步骤 {currentStep + 1} / {steps.length}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <button
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-panel disabled:opacity-40"
            type="button"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => s - 1)}
            data-testid="gesture-tutorial-prev"
          >
            <ChevronLeft size={14} />
            上一步
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-panel"
            type="button"
            onClick={onClose}
            data-testid="gesture-tutorial-skip"
          >
            <SkipForward size={14} />
            跳过教程
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              data-testid="gesture-tutorial-next"
            >
              下一步
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              type="button"
              onClick={() => {
                onEnableGesture?.();
                onClose();
              }}
              data-testid="gesture-tutorial-finish"
            >
              <Check size={14} />
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gesture Practice Panel (for Settings)
// ---------------------------------------------------------------------------

export interface GesturePracticePanelProps {
  /** Custom gesture mappings */
  mappings?: GestureMapping[];
  /** Called when mappings are updated */
  onMappingsChange?(mappings: GestureMapping[]): void;
}

export function GesturePracticePanel({
  mappings = DEFAULT_GESTURE_MAPPINGS,
  onMappingsChange,
}: GesturePracticePanelProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [lastDetectedGesture, setLastDetectedGesture] = useState<GestureType | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="space-y-4" data-testid="gesture-practice-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">手势练习场</h3>
        <button
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
            cameraActive
              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
              : 'bg-[var(--color-accent)] text-white hover:opacity-90',
          )}
          type="button"
          onClick={cameraActive ? stopCamera : startCamera}
          data-testid="gesture-practice-camera-toggle"
        >
          {cameraActive ? <CameraOff size={14} /> : <Camera size={14} />}
          {cameraActive ? '关闭摄像头' : '开启摄像头'}
        </button>
      </div>

      {/* Camera preview */}
      <div className="aspect-video overflow-hidden rounded-lg bg-black/90">
        {cameraActive ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">
            <Camera size={48} />
          </div>
        )}
      </div>

      {/* Detected gesture feedback */}
      {lastDetectedGesture ? (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check size={16} />
          检测到: {lastDetectedGesture}
        </div>
      ) : null}

      {/* Gesture mapping list */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          手势映射
        </h4>
        {mappings.map((m) => (
          <div
            key={m.gesture}
            className="flex items-center justify-between rounded-md border border-line px-3 py-2"
            data-testid={`gesture-mapping-${m.gesture}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{GESTURE_EMOJI[m.gesture]}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">{m.description}</span>
            </div>
            <span className="rounded bg-panel px-2 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)]">
              {m.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

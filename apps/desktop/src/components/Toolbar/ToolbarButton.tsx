import { clsx } from 'clsx';

interface ToolButtonProps {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onClick(): void;
  testId?: string;
  playbackState?: 'playing' | 'paused';
}

export function ToolButton({ title, icon, disabled, active, onClick, testId, playbackState }: ToolButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-700 transition',
        active ? 'border-brand bg-brand text-white' : undefined,
        disabled ? 'opacity-40' : 'hover:border-line hover:bg-panel hover:text-ink',
      )}
      title={title}
      aria-label={title}
      data-testid={testId}
      data-playback-state={playbackState}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export function formatRecordingElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

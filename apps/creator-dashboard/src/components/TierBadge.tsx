import type { CreatorTier } from '@open-factory/creator-dashboard';

interface TierBadgeProps {
  tier: CreatorTier;
  size?: 'sm' | 'md';
}

const tierConfig: Record<CreatorTier, { label: string; bg: string; text: string }> = {
  starter: { label: 'Starter', bg: 'bg-foreground-muted/15', text: 'text-foreground-muted' },
  advanced: { label: 'Advanced', bg: 'bg-accent/15', text: 'text-accent' },
  professional: { label: 'Professional', bg: 'bg-info/15', text: 'text-info' },
  flagship: { label: 'Flagship', bg: 'bg-warning/15', text: 'text-warning' },
};

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const cfg = tierConfig[tier];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`rounded-full font-semibold ${cfg.bg} ${cfg.text} ${sizeClasses}`}>
      {cfg.label}
    </span>
  );
}

import type { Creator } from '@open-factory/creator-dashboard';
import { TierBadge } from './TierBadge';
import { formatCurrency } from '@/lib/utils';

interface CreatorProfileProps {
  creator: Creator;
}

export function CreatorProfile({ creator }: CreatorProfileProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      {/* Header accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-accent via-info to-accent" />
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-surface-overlay flex items-center justify-center text-2xl font-bold text-accent flex-shrink-0">
            {creator.displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">{creator.displayName}</h2>
              <TierBadge tier={creator.tier} />
              {creator.verifiedAt && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-foreground-muted mt-1 line-clamp-2">{creator.bio}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted">
              <span>Joined {new Date(creator.createdAt).toLocaleDateString()}</span>
              <span>{creator.commissionRate * 100}% commission</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {creator.tags.length > 0 && (
          <div className="flex gap-1.5 mt-4 flex-wrap">
            {creator.tags.map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-surface-overlay text-foreground-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <div className="text-xs text-foreground-muted">Total Revenue</div>
            <div className="text-lg font-bold mt-0.5">{formatCurrency(creator.totalRevenue)}</div>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">Monthly Revenue</div>
            <div className="text-lg font-bold mt-0.5">{formatCurrency(creator.monthlyRevenue)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { WithdrawalRequest } from '@open-factory/creator-dashboard';
import { formatDate, formatCurrency } from '@/lib/utils';

interface WithdrawalHistoryProps {
  withdrawals: WithdrawalRequest[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-warning bg-warning/10' },
  processing: { label: 'Processing', color: 'text-info bg-info/10' },
  completed: { label: 'Completed', color: 'text-success bg-success/10' },
  failed: { label: 'Failed', color: 'text-danger bg-danger/10' },
};

export function WithdrawalHistory({ withdrawals }: WithdrawalHistoryProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">Withdrawal History</h3>
      </div>
      <div className="divide-y divide-border-subtle">
        {withdrawals.length === 0 ? (
          <div className="px-5 py-8 text-center text-foreground-muted text-sm">No withdrawals yet</div>
        ) : (
          withdrawals.map((wd) => {
            const cfg = statusConfig[wd.status] ?? statusConfig.pending;
            return (
              <div key={wd.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatCurrency(wd.amount)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-foreground-muted mt-0.5">
                    {wd.method} &middot; {formatDate(wd.createdAt)}
                  </div>
                </div>
                <div className="text-xs text-foreground-muted font-mono">{wd.id}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

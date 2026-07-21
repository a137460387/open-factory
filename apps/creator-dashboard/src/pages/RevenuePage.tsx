import { useAnalytics } from '@/hooks/useAnalytics';
import { useRevenue } from '@/hooks/useRevenue';
import { KPICard } from '@/components/KPICard';
import { RevenueLineChart } from '@/components/RevenueLineChart';
import { TransactionTable } from '@/components/TransactionTable';
import { WithdrawalForm } from '@/components/WithdrawalForm';
import { WithdrawalHistory } from '@/components/WithdrawalHistory';

const CREATOR_ID = 'creator-001';

export function RevenuePage() {
  const { analytics, loading: analyticsLoading } = useAnalytics(CREATOR_ID);
  const { transactions, withdrawals, loading: revenueLoading, requestWithdrawal } = useRevenue(CREATOR_ID);

  const loading = analyticsLoading || revenueLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted text-sm">Loading revenue data...</div>
      </div>
    );
  }

  const revenue = analytics?.revenue;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Revenue</h1>
        <p className="text-sm text-foreground-muted mt-1">Manage your earnings and withdrawals</p>
      </div>

      {/* Revenue KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Today" value={revenue?.today ?? 0} prefix="CNY " />
        <KPICard title="This Month" value={revenue?.thisMonth ?? 0} prefix="CNY " trend={15.2} />
        <KPICard title="Total Revenue" value={revenue?.total ?? 0} prefix="CNY " />
        <KPICard title="Pending" value={revenue?.pending ?? 0} prefix="CNY " />
      </div>

      {/* Revenue trend chart */}
      {revenue && <RevenueLineChart data={revenue.trend} />}

      {/* Withdrawal section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WithdrawalForm
          availableBalance={revenue?.pending ?? 0}
          onSubmit={requestWithdrawal}
        />
        <WithdrawalHistory withdrawals={withdrawals} />
      </div>

      {/* Transaction table */}
      <TransactionTable transactions={transactions} />
    </div>
  );
}

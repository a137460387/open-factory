import { useAnalytics } from '@/hooks/useAnalytics';
import { KPICard } from '@/components/KPICard';
import { TrendChart } from '@/components/TrendChart';
import { SourcePieChart } from '@/components/SourcePieChart';
import { RatingBarChart } from '@/components/RatingBarChart';
import { RevenueLineChart } from '@/components/RevenueLineChart';

const CREATOR_ID = 'creator-001';

export function DashboardPage() {
  const { analytics, loading, error } = useAnalytics(CREATOR_ID);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground-muted text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-danger text-sm">{error ?? 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-foreground-muted mt-1">Overview of your creator performance</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Downloads"
          value={analytics.downloads.total}
          trend={analytics.downloads.growthRate}
          formatAsNumber
        />
        <KPICard
          title="Monthly Active Users"
          value={analytics.users.mau}
          trend={12.3}
          formatAsNumber
        />
        <KPICard
          title="Average Rating"
          value={analytics.ratings.overall}
          suffix="/5"
          trend={2.1}
        />
        <KPICard
          title="Monthly Revenue"
          value={analytics.revenue.thisMonth}
          prefix="CNY "
          trend={18.5}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart data={analytics.downloads.trend} title="Download Trend" color="#3b82f6" />
        <SourcePieChart data={analytics.users.sources} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RatingBarChart distribution={analytics.ratings.distribution} />
        <RevenueLineChart data={analytics.revenue.trend} />
      </div>
    </div>
  );
}

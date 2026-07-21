import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatPercent, getTrendColor } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  suffix?: string;
  prefix?: string;
  trend?: number;
  formatAsNumber?: boolean;
}

export function KPICard({ title, value, suffix = '', prefix = '', trend, formatAsNumber }: KPICardProps) {
  const displayValue = formatAsNumber ? formatNumber(value) : `${prefix}${value.toLocaleString()}${suffix}`;
  const trendColor = trend !== undefined ? getTrendColor(trend) : '';

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5 flex flex-col gap-2 transition-all duration-200 hover:border-accent/30">
      <span className="text-xs text-foreground-muted font-medium uppercase tracking-wider">{title}</span>
      <span className="text-2xl font-bold tracking-tight">{displayValue}</span>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
          <span>{formatPercent(trend)}</span>
          <span className="text-foreground-muted font-normal ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
}

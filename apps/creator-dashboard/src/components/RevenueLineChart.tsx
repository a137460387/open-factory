import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { RevenueTrend } from '@open-factory/creator-dashboard';

interface RevenueLineChartProps {
  data: RevenueTrend[];
}

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-foreground-muted mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()} CNY
        </p>
      ))}
    </div>
  );
}

export function RevenueLineChart({ data }: RevenueLineChartProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8b90a0', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2e3a' }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#8b90a0', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value: string) => <span style={{ color: '#8b90a0' }}>{value}</span>}
            />
            <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sales" />
            <Line type="monotone" dataKey="bonus" stroke="#10b981" strokeWidth={2} dot={false} name="Bonus" />
            <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

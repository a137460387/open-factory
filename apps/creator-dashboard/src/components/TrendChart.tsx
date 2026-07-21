import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyDataPoint } from '@open-factory/creator-dashboard';

interface TrendChartProps {
  data: DailyDataPoint[];
  title: string;
  color?: string;
}

export function TrendChart({ data, title, color = '#3b82f6' }: TrendChartProps) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8b90a0', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2e3a' }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#8b90a0', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e2230',
                border: '1px solid #2a2e3a',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${title.replace(/\s/g, '')})`}
              name="Downloads"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

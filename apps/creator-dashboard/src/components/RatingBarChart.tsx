import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { RatingDistribution } from '@open-factory/creator-dashboard';

interface RatingBarChartProps {
  distribution: RatingDistribution;
}

export function RatingBarChart({ distribution }: RatingBarChartProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const data = [1, 2, 3, 4, 5].map((star) => ({
    star: `${star} Star`,
    count: distribution[star as keyof RatingDistribution],
    percent: total > 0 ? Math.round((distribution[star as keyof RatingDistribution] / total) * 100) : 0,
  }));

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold mb-4">Rating Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
            <XAxis
              dataKey="star"
              tick={{ fill: '#8b90a0', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#2a2e3a' }}
            />
            <YAxis tick={{ fill: '#8b90a0', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e2230',
                border: '1px solid #2a2e3a',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'count') return [value.toLocaleString(), 'Count'];
                return [value, name];
              }}
            />
            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

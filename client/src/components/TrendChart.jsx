import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Empty, number } from './UI';
export default function TrendChart({ data, thresholds, dataKey = 'average', count = false }) {
  if (!data?.length)
    return (
      <Empty
        title="No readings in this period"
        message="Manually add demo readings to build the historical trend."
      />
    );
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#178a78" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#178a78" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e6eceb" />
          <XAxis
            dataKey="_id"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })
            }
            tick={{ fontSize: 11, fill: '#7c8b8c' }}
            tickLine={false}
            axisLine={false}
            minTickGap={42}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#7c8b8c' }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, 'auto']}
          />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString()}
            formatter={(v) => [number(v), count ? 'Records' : 'Average · uSv/h']}
            contentStyle={{ borderRadius: 8, borderColor: '#e0e8e6', fontSize: 12 }}
          />
          {thresholds && !count && (
            <>
              <ReferenceLine
                ifOverflow="extendDomain"
                y={thresholds.warning}
                stroke="#dca044"
                strokeDasharray="5 4"
              />
              <ReferenceLine
                ifOverflow="extendDomain"
                y={thresholds.critical}
                stroke="#d66969"
                strokeDasharray="5 4"
              />
            </>
          )}
          <Area
            type="linear"
            dataKey={dataKey}
            stroke="#168572"
            strokeWidth={2.5}
            fill="url(#trendFill)"
            dot={data.length < 3}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

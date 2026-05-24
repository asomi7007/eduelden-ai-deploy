import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MODEL_COLORS, MODEL_LABELS } from '../utils/constants';
import { formatNumber } from '../utils/format';

export default function UsageChart({ data, title = '일별 토큰 사용량', dataKey = 'tokens' }) {
  if (!data || data.length === 0) {
    return (
      <div className="card h-72 flex items-center justify-center text-gray-400">
        데이터가 없습니다
      </div>
    );
  }

  // Transform daily data to chart-friendly format
  const chartData = data.map((day) => {
    const row = { date: day.date.slice(5) }; // MM-DD
    if (day.models) {
      Object.entries(day.models).forEach(([model, stats]) => {
        if (dataKey === 'tokens') {
          row[model] = (stats.inputTokens || 0) + (stats.outputTokens || 0);
        } else if (dataKey === 'cost') {
          row[model] = stats.cost || 0;
        } else {
          row[model] = stats.requests || 0;
        }
      });
    }
    return row;
  });

  const models = Object.keys(MODEL_COLORS);

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={formatNumber} />
          <Tooltip
            formatter={(value, name) => [formatNumber(value), MODEL_LABELS[name] || name]}
            labelFormatter={(label) => `날짜: ${label}`}
          />
          <Legend formatter={(value) => MODEL_LABELS[value] || value} />
          {models.map((model) => (
            <Area
              key={model}
              type="monotone"
              dataKey={model}
              stackId="1"
              stroke={MODEL_COLORS[model]}
              fill={MODEL_COLORS[model]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

import { formatCurrency } from '../utils/format';
import { BUDGET_TOTAL } from '../utils/constants';

export default function BudgetGauge({ used, total = BUDGET_TOTAL }) {
  const percent = total > 0 ? (used / total) * 100 : 0;
  const clampedPercent = Math.min(percent, 100);

  let barColor = 'bg-green-500';
  if (percent >= 80) barColor = 'bg-red-500';
  else if (percent >= 50) barColor = 'bg-amber-500';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">예산 사용률</h3>
        <span className="text-sm font-bold text-gray-900">{percent.toFixed(1)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>사용: {formatCurrency(used)}</span>
        <span>잔여: {formatCurrency(total - used)}</span>
        <span>전체: {formatCurrency(total)}</span>
      </div>
      {/* threshold markers */}
      <div className="relative w-full h-1 mt-1">
        <div className="absolute left-[50%] w-px h-3 -top-1 bg-amber-400" title="50%" />
        <div className="absolute left-[80%] w-px h-3 -top-1 bg-red-400" title="80%" />
      </div>
    </div>
  );
}

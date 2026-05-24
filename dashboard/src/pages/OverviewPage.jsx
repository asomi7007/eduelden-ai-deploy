import { Coins, Activity, Users, TrendingUp } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { REFRESH_INTERVAL } from '../utils/constants';
import { formatNumber, formatCurrency } from '../utils/format';
import StatsCard from '../components/StatsCard';
import BudgetGauge from '../components/BudgetGauge';
import UsageChart from '../components/UsageChart';

export default function OverviewPage() {
  const { data: overview, loading: loadingOverview } = useApi('/overview', null, {
    refreshInterval: REFRESH_INTERVAL,
  });
  const { data: daily, loading: loadingDaily } = useApi('/daily', { days: 30 }, {
    refreshInterval: REFRESH_INTERVAL,
  });
  const { data: studentsData } = useApi('/students', { sort: 'tokens' }, {
    refreshInterval: REFRESH_INTERVAL,
  });

  if (loadingOverview && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">데이터를 불러오는 중...</div>
      </div>
    );
  }

  const tokens = overview?.tokens || {};
  const cost = overview?.cost || {};
  const students = overview?.students || {};
  const topStudents = (studentsData?.students || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">개요</h2>
        <span className="text-xs text-gray-400">5분마다 자동 갱신</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Coins}
          label="총 토큰 사용"
          value={formatNumber(tokens.total)}
          subtitle={`입력 ${formatNumber(tokens.input)} / 출력 ${formatNumber(tokens.output)}`}
          color="blue"
        />
        <StatsCard
          icon={TrendingUp}
          label="예상 비용"
          value={formatCurrency(cost.estimated)}
          subtitle={`잔여 ${formatCurrency(cost.remaining)}`}
          color="amber"
        />
        <StatsCard
          icon={Users}
          label="활성 학생"
          value={`${students.active || 0}명`}
          subtitle={`전체 ${students.total || 50}명 중`}
          color="green"
        />
        <StatsCard
          icon={Activity}
          label="총 요청 수"
          value={formatNumber(overview?.requests)}
          subtitle="최근 30일"
          color="purple"
        />
      </div>

      {/* Budget Gauge */}
      <BudgetGauge used={cost.estimated || 0} total={cost.budget || 800} />

      {/* Daily Chart */}
      {!loadingDaily && daily?.days && (
        <UsageChart data={daily.days} title="일별 토큰 사용량 (최근 30일)" dataKey="tokens" />
      )}

      {/* Top Students */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-4">상위 5명 사용자</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left py-2 pr-4">학생</th>
                <th className="text-right py-2 px-4">토큰</th>
                <th className="text-right py-2 px-4">비용</th>
                <th className="text-right py-2 pl-4">요청수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topStudents.map((s) => (
                <tr key={s.subscriptionId}>
                  <td className="py-2 pr-4 font-medium">#{s.studentNumber}</td>
                  <td className="py-2 px-4 text-right text-gray-600">{formatNumber(s.totalTokens)}</td>
                  <td className="py-2 px-4 text-right text-gray-600">{formatCurrency(s.estimatedCost)}</td>
                  <td className="py-2 pl-4 text-right text-gray-600">{s.requests}</td>
                </tr>
              ))}
              {topStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

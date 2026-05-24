import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useApi, useApiPost } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import QuotaControl from '../components/QuotaControl';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatNumber, formatCurrency, formatDate } from '../utils/format';
import { MODEL_COLORS, MODEL_LABELS } from '../utils/constants';
import { useState } from 'react';

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(`/students/${id}`);
  const { execute: postSuspend, loading: suspendLoading } = useApiPost();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/students')} className="btn-secondary text-sm flex items-center gap-2">
          <ArrowLeft size={16} /> 목록으로
        </button>
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      </div>
    );
  }

  const student = data;
  const sub = student?.subscription || {};
  const totals = student?.totals || {};
  const isActive = sub.state === 'active';

  // Daily chart data
  const dailyByDate = {};
  (student?.daily || []).forEach((entry) => {
    if (!dailyByDate[entry.date]) {
      dailyByDate[entry.date] = { date: entry.date.slice(5) };
    }
    const tokens = (entry.inputTokens || 0) + (entry.outputTokens || 0);
    dailyByDate[entry.date][entry.model] = (dailyByDate[entry.date][entry.model] || 0) + tokens;
  });
  const dailyChartData = Object.values(dailyByDate);

  // Model pie data
  const modelTotals = {};
  (student?.daily || []).forEach((entry) => {
    if (!modelTotals[entry.model]) modelTotals[entry.model] = 0;
    modelTotals[entry.model] += entry.requests || 0;
  });
  const pieData = Object.entries(modelTotals).map(([model, value]) => ({
    name: MODEL_LABELS[model] || model,
    value,
    color: MODEL_COLORS[model] || '#6b7280',
  }));

  const handleToggleState = async () => {
    const action = isActive ? 'suspend' : 'activate';
    try {
      await postSuspend('/control/suspend', {
        subscriptionId: student.subscriptionId,
        action,
      });
      refetch();
    } catch (e) {
      // error handled in hook
    }
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/students')}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} /> 학생 목록으로
      </button>

      {/* Info Card */}
      <div className="card flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={24} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">학생 #{id}</h2>
            <p className="text-sm text-gray-500">{student?.subscriptionId}</p>
          </div>
          <StatusBadge status={sub.state} />
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-gray-500">총 토큰</p>
            <p className="font-bold">{formatNumber((totals.inputTokens || 0) + (totals.outputTokens || 0))}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">비용</p>
            <p className="font-bold">{formatCurrency(totals.cost)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">요청수</p>
            <p className="font-bold">{totals.requests?.toLocaleString() || 0}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Line Chart */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-700 mb-4">일별 토큰 사용량</h3>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={formatNumber} />
                <Tooltip formatter={(v, name) => [formatNumber(v), MODEL_LABELS[name] || name]} />
                {Object.keys(MODEL_COLORS).map((model) => (
                  <Line
                    key={model}
                    type="monotone"
                    dataKey={model}
                    stroke={MODEL_COLORS[model]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400">데이터 없음</div>
          )}
        </div>

        {/* Model Pie */}
        <div className="card">
          <h3 className="text-sm font-medium text-gray-700 mb-4">모델별 사용 비율</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Legend formatter={(value) => value} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400">데이터 없음</div>
          )}
        </div>
      </div>

      {/* Controls Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quota */}
        <div className="card">
          <QuotaControl subscriptionId={student?.subscriptionId} onSuccess={refetch} />
        </div>

        {/* Suspend / Activate */}
        <div className="card flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">구독 상태 변경</h4>
            <p className="text-sm text-gray-500 mb-4">
              {isActive
                ? '이 학생의 API 접근을 일시 정지합니다.'
                : '이 학생의 API 접근을 다시 활성화합니다.'}
            </p>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={suspendLoading}
            className={isActive ? 'btn-danger text-sm' : 'btn-primary text-sm'}
          >
            {isActive ? '정지하기' : '활성화하기'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={isActive ? '학생 정지' : '학생 활성화'}
        message={
          isActive
            ? `학생 #${id}의 API 접근을 정지하시겠습니까?`
            : `학생 #${id}의 API 접근을 활성화하시겠습니까?`
        }
        confirmLabel={isActive ? '정지' : '활성화'}
        danger={isActive}
        onConfirm={handleToggleState}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

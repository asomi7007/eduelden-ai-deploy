import { useState } from 'react';
import { useApiPost } from '../hooks/useApi';

export default function QuotaControl({ subscriptionId, onSuccess }) {
  const [minuteLimit, setMinuteLimit] = useState(10);
  const [dailyLimit, setDailyLimit] = useState(200);
  const { execute, loading, error } = useApiPost();

  const handleApply = async () => {
    try {
      await execute('/control/quota', {
        subscriptionId,
        minuteLimit: Number(minuteLimit),
        dailyLimit: Number(dailyLimit),
      });
      onSuccess?.();
    } catch (e) {
      // error is already set in hook
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Quota 설정</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">분당 호출 제한</label>
          <input
            type="number"
            min={1}
            max={100}
            value={minuteLimit}
            onChange={(e) => setMinuteLimit(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">일일 호출 제한</label>
          <input
            type="number"
            min={1}
            max={10000}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={handleApply} disabled={loading} className="btn-primary text-sm">
        {loading ? '적용 중...' : 'Quota 적용'}
      </button>
    </div>
  );
}

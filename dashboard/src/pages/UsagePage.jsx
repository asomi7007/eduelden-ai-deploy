import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export default function UsagePage() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try { setData(await apiClient(`/admin/statistics/overview?days=${days}`)); }
    catch (e) { setMsg(e.message); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const models = data ? Object.entries(data.byModel || {}).sort((a, b) => b[1] - a[1]) : [];
  const max = models.length ? Math.max(...models.map(([, v]) => v)) : 1;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">사용량 통계</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded px-3 py-2">
          <option value={1}>오늘</option>
          <option value={7}>7일</option>
          <option value={30}>30일</option>
        </select>
      </div>
      {msg && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">총 요청</p>
          <p className="text-3xl font-bold">{data?.totalRequests ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">집계 모델 수</p>
          <p className="text-3xl font-bold">{models.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">기간</p>
          <p className="text-3xl font-bold">{data?.days ?? '-'}일</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-bold mb-3">모델별 요청 (Log Analytics)</h2>
        {models.length ? models.map(([m, v]) => (
          <div key={m} className="flex items-center gap-3 mb-2">
            <span className="w-40 text-xs font-mono truncate">{m}</span>
            <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-16 text-right text-sm font-bold">{v}</span>
          </div>
        )) : <p className="text-gray-400 text-sm">기간 내 데이터가 없습니다.</p>}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        ※ 상세 토큰/오류 통계는 Log Analytics (ApiManagementGatewayLogs) 기반 — 데이터가 쌓이면 표시됩니다.
      </p>
    </div>
  );
}

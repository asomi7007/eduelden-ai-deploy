import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [audit, h] = await Promise.all([
        apiClient('/admin/system/audit?limit=200'),
        apiClient('/admin/system/health'),
      ]);
      setLogs(audit);
      setHealth(h);
    } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">설정 및 감사 로그</h1>
      {msg && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {health && Object.entries(health).map(([name, v]) => (
          <div key={name} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">{name}</p>
            <p className={`text-lg font-bold ${v.ok ? 'text-green-600' : 'text-red-600'}`}>
              {v.ok ? '● 정상' : `● 오류: ${v.error || ''}`}
            </p>
            {v.models !== undefined && <p className="text-xs text-gray-400">모델 {v.models}개</p>}
            {v.service && <p className="text-xs text-gray-400 font-mono">{v.service}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr><th className="p-3">시간</th><th className="p-3">작업</th><th className="p-3">상세</th><th className="p-3">주체</th></tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="p-3 text-xs">{(l.timestamp || '').slice(0, 19)}</td>
                <td className="p-3 font-mono text-xs">{l.action}</td>
                <td className="p-3 text-xs max-w-md truncate">{l.detail}</td>
                <td className="p-3 text-xs">{l.actor}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan="4" className="p-8 text-center text-gray-400">감사 로그가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

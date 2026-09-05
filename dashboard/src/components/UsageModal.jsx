import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

/** 실습별 공용키 사용 내역 모달 */
export default function UsageModal({ workshopId, onClose }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try { setData(await apiClient(`/admin/usage/${workshopId}`)); }
    catch (e) { setMsg(e.message); }
  }, [workshopId]);
  useEffect(() => { load(); }, [load]);

  const badge = (s) => (
    <span className={`px-2 py-0.5 rounded text-xs ${
      s === 'ACTIVE' ? 'bg-green-100 text-green-700' :
      s === 'EXPIRED' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{s}</span>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📊 {workshopId} 사용 내역</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {msg && <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{msg}</div>}
        {!data && !msg && <p className="text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {data.logAnalytics && !data.logAnalytics.available && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">
                ⚠️ {data.note}
              </div>
            )}
            {data.logAnalytics && data.logAnalytics.available && (
              <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-sm text-green-800">
                ✅ Log Analytics 연결됨 — 상세 통계는 "사용량 통계" 메뉴 참조
              </div>
            )}

            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">키</th><th className="p-2">참가자</th>
                  <th className="p-2">상태</th><th className="p-2">발급</th>
                  <th className="p-2">만료</th><th className="p-2">마지막 재생성</th>
                </tr>
              </thead>
              <tbody>
                {data.keys.map((k) => (
                  <tr key={k.keyId} className="border-t">
                    <td className="p-2 font-mono text-xs">{k.keyId}</td>
                    <td className="p-2">{k.owner}</td>
                    <td className="p-2">{badge(k.status)}</td>
                    <td className="p-2 text-xs">{(k.issuedAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-2 text-xs">{(k.expiresAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-2 text-xs">{k.lastRotatedAt ? k.lastRotatedAt.slice(0, 16).replace('T', ' ') : '-'}</td>
                  </tr>
                ))}
                {!data.keys.length && (
                  <tr><td colSpan="6" className="p-6 text-center text-gray-400">발급된 키가 없습니다</td></tr>
                )}
              </tbody>
            </table>
            <button onClick={load} className="mt-4 px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200">새로고침</button>
          </>
        )}
      </div>
    </div>
  );
}

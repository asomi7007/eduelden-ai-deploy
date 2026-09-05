import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import KeyExampleModal from '../components/KeyExampleModal';

export default function AccessKeysPage() {
  const [keys, setKeys] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // 발급 직후 키 표시 (한 번만)
  const [reveal, setReveal] = useState(null);
  const [exampleKey, setExampleKey] = useState(null);
  // CSV 벌크
  const [bulkWorkshop, setBulkWorkshop] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const [ks, ws] = await Promise.all([
        apiClient('/admin/keys'),
        apiClient('/admin/workshops'),
      ]);
      setKeys(ks);
      setWorkshops(ws.filter((w) => w.status !== 'CLOSED'));
      if (!bulkWorkshop && ws.length) setBulkWorkshop(ws[0].workshopId);
    } catch (e) { setMsg(e.message); }
  }, [bulkWorkshop]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const issueKey = async (workshopId) => {
    const owner = prompt('참가자 이름 또는 팀명', '');
    if (owner === null) return;
    setBusy(true);
    try {
      const r = await apiClient('/admin/keys', { method: 'POST', body: { workshopId, owner } });
      setReveal({ keyId: r.keyId, owner, key: r.primaryKey, expiresAt: r.expiresAt });
      load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const bulkIssue = async () => {
    const owners = bulkNames.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!owners.length) { setMsg('이름 목록을 입력하세요'); return; }
    setBusy(true); setBulkResult(null);
    try {
      const r = await apiClient('/admin/keys?bulk=1', { method: 'POST', body: { workshopId: bulkWorkshop, owners } });
      setBulkResult(r.issued);
      load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const action = async (keyId, act) => {
    setBusy(true);
    try {
      if (act === 'delete') {
        if (!confirm(`${keyId} 키를 완전 폐기할까요? (APIM 구독 삭제)`)) { setBusy(false); return; }
        await apiClient(`/admin/keys/${keyId}`, { method: 'DELETE' });
      } else if (act === 'regenerate') {
        if (!confirm(`${keyId} Primary Key를 재생성할까요? 기존 키는 즉시 무효화됩니다.`)) { setBusy(false); return; }
        const r = await apiClient(`/admin/keys/${keyId}/regenerate`, { method: 'POST' });
        setReveal({ keyId, owner: '(재생성)', key: r.primaryKey, expiresAt: '' });
      } else {
        await apiClient(`/admin/keys/${keyId}/${act}`, { method: 'POST' });
      }
      load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const copy = (text) => { navigator.clipboard.writeText(text); setMsg('복사됨'); };

  const filtered = keys.filter((k) =>
    !filter || k.keyId.includes(filter) || (k.owner || '').includes(filter) || k.workshopId.includes(filter));

  const badge = (s) => (
    <span className={`px-2 py-0.5 rounded text-xs ${
      s === 'ACTIVE' ? 'bg-green-100 text-green-700' :
      s === 'SUSPENDED' ? 'bg-amber-100 text-amber-700' :
      s === 'EXPIRED' ? 'bg-gray-200 text-gray-600' :
      'bg-red-100 text-red-700'}`}>{s}</span>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">API 키 관리</h1>
      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded">{msg}</div>}

      {reveal && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <p className="font-bold text-yellow-800 mb-2">
            🔑 {reveal.owner} 키 — 지금 한 번만 표시됩니다. 복사해서 전달하세요.
          </p>
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 p-2 bg-white rounded font-mono text-xs break-all">{reveal.key}</code>
            <button onClick={() => copy(reveal.key)} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">복사</button>
          </div>
          {reveal.expiresAt && <p className="text-xs text-yellow-700">만료: {reveal.expiresAt}</p>}
          <div className="mt-2 flex gap-2">
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reveal.key)}`}
               target="_blank" rel="noreferrer" className="text-xs underline text-blue-600">QR 코드 열기</a>
            <button onClick={() => setReveal(null)} className="text-xs underline text-gray-500">닫기</button>
          </div>
        </div>
      )}

      {/* 발급 패널 */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm">실습 선택</label>
            <select value={bulkWorkshop} onChange={(e) => setBulkWorkshop(e.target.value)}
              className="border rounded px-3 py-2 w-full">
              {workshops.map((w) => <option key={w.workshopId} value={w.workshopId}>{w.workshopId} — {w.name}</option>)}
            </select>
          </div>
          <button disabled={busy || !bulkWorkshop} onClick={() => issueKey(bulkWorkshop)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            키 1개 발급
          </button>
        </div>
        <div className="border-t pt-3">
          <label className="text-sm">참가자/팀 CSV 일괄 발급 (쉼표 또는 줄바꿈 구분)</label>
          <textarea rows="2" value={bulkNames} onChange={(e) => setBulkNames(e.target.value)}
            placeholder="김철수, 이영희, 팀A, 팀B"
            className="border rounded px-3 py-2 w-full font-mono text-sm" />
          <button disabled={busy || !bulkWorkshop} onClick={bulkIssue}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {busy ? '발급 중…' : '일괄 발급'}
          </button>
          {bulkResult && (
            <div className="mt-3 p-3 bg-gray-50 rounded max-h-64 overflow-auto">
              <p className="text-xs font-bold mb-1">{bulkResult.length}개 발급 완료 — 아래 키는 이 화면에서만 보입니다</p>
              {bulkResult.map((r) => (
                <div key={r.keyId} className="flex gap-2 items-center text-xs mb-1">
                  <span className="w-24 truncate">{r.owner}</span>
                  <code className="flex-1 font-mono break-all">{r.primaryKey}</code>
                  <button onClick={() => copy(r.primaryKey)} className="px-2 py-0.5 bg-gray-200 rounded">복사</button>
                </div>
              ))}
              <button onClick={() => copy(bulkResult.map((r) => `${r.owner},${r.primaryKey}`).join('\n'))}
                className="mt-1 px-2 py-1 bg-gray-800 text-white rounded text-xs">전체 CSV 복사</button>
            </div>
          )}
        </div>
      </div>

      <input placeholder="키/이름/실습 검색" value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-3 border rounded px-3 py-2 w-64" />

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">이름</th><th className="p-3">참가자</th><th className="p-3">실습</th>
              <th className="p-3">키</th><th className="p-3">만료</th><th className="p-3">상태</th>
              <th className="p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.keyId} className="border-t">
                <td className="p-3 font-mono text-xs">{k.keyId}</td>
                <td className="p-3">{k.owner || '-'}</td>
                <td className="p-3 text-xs">{k.workshopId}</td>
                <td className="p-3 font-mono text-xs">{k.maskedKey}</td>
                <td className="p-3 text-xs">{(k.expiresAt || '').slice(0, 16)}</td>
                <td className="p-3">{badge(k.status)}</td>
                <td className="p-3 space-x-1 whitespace-nowrap">
                  <button onClick={() => action(k.keyId, 'regenerate')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">재생성</button>
                  {k.status === 'ACTIVE' ? (
                    <button onClick={() => action(k.keyId, 'suspend')} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">정지</button>
                  ) : k.status !== 'DELETED' && (
                    <button onClick={() => action(k.keyId, 'activate')} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">활성화</button>
                  )}
                  <button onClick={() => setExampleKey(k.keyId)} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">📝 예제</button>
                  <button onClick={() => action(k.keyId, 'delete')} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">폐기</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">발급된 키가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    
      {exampleKey && <KeyExampleModal keyId={exampleKey} onClose={() => setExampleKey(null)} />}
</div>
  );
}
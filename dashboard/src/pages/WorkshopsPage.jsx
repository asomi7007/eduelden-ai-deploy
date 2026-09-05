import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState([]);
  const [models, setModels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    workshopId: '', name: '',
    validFrom: '', expiresAt: '',
    allowedModels: ['model-router'],
    requestsPerMinute: 10, dailyRequestLimit: 200,
    org: '', tokenLimitPerKey: 0,
  });

  const load = useCallback(async () => {
    try {
      const [ws, ms] = await Promise.all([
        apiClient('/admin/workshops'),
        apiClient('/admin/models'),
      ]);
      setWorkshops(ws);
      setModels(ms);
    } catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleModel = (id) => {
    setForm((f) => ({
      ...f,
      allowedModels: f.allowedModels.includes(id)
        ? f.allowedModels.filter((m) => m !== id)
        : [...f.allowedModels, id],
    }));
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await apiClient('/admin/workshops', { method: 'POST', body: form });
      setMsg(`실습 생성 완료: ${form.workshopId}`);
      setShowForm(false);
      load();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };

  const closeWorkshop = async (id) => {
    if (!confirm(`${id} 실습을 종료하고 소속 키를 전부 정지할까요?`)) return;
    setBusy(true);
    try {
      const r = await apiClient(`/admin/workshops/${id}/close`, { method: 'POST' });
      setMsg(`${id} 종료 — 키 ${r.suspended}개 정지됨`);
      load();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };

  const cloneWorkshop = (w) => {
    setForm({
      workshopId: `${w.workshopId}-copy-${Date.now().toString(36).slice(-4)}`,
      name: `${w.name} (복제)`,
      validFrom: '', expiresAt: '',
      allowedModels: [...w.allowedModels],
      requestsPerMinute: w.requestsPerMinute,
      dailyRequestLimit: w.dailyRequestLimit,
      org: w.org, tokenLimitPerKey: w.tokenLimitPerKey,
    });
    setShowForm(true);
  };

  const extend = async (w) => {
    const hours = prompt('연장 시간(시간)', '2');
    if (!hours) return;
    const newExp = new Date(new Date(w.expiresAt).getTime() + Number(hours) * 3600000).toISOString();
    setBusy(true);
    try {
      await apiClient(`/admin/workshops/${w.workshopId}`, {
        method: 'PATCH', body: { expiresAt: newExp },
      });
      setMsg(`${w.workshopId} 만료 ${hours}시간 연장`);
      load();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };

  const badge = (s) => (
    <span className={`px-2 py-0.5 rounded text-xs ${
      s === 'ACTIVE' ? 'bg-green-100 text-green-700' :
      s === 'CLOSED' || s === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
      'bg-gray-100 text-gray-600'}`}>{s}</span>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">실습 관리</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showForm ? '취소' : '+ 새 실습'}
        </button>
      </div>
      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded">{msg}</div>}

      {showForm && (
        <form onSubmit={create} className="mb-6 p-4 bg-white rounded-lg shadow space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="실습ID (예: lab-20260910)" value={form.workshopId}
              onChange={(e) => setForm({ ...form, workshopId: e.target.value })}
              className="border rounded px-3 py-2" />
            <input required placeholder="실습명" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded px-3 py-2" />
            <label className="text-sm">시작일시
              <input type="datetime-local" required value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="border rounded px-3 py-2 w-full" /></label>
            <label className="text-sm">종료일시 (자동 만료)
              <input type="datetime-local" required value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="border rounded px-3 py-2 w-full" /></label>
            <label className="text-sm">분당 요청 (기본 10)
              <input type="number" value={form.requestsPerMinute}
                onChange={(e) => setForm({ ...form, requestsPerMinute: Number(e.target.value) })}
                className="border rounded px-3 py-2 w-full" /></label>
            <label className="text-sm">일일 요청 (기본 200)
              <input type="number" value={form.dailyRequestLimit}
                onChange={(e) => setForm({ ...form, dailyRequestLimit: Number(e.target.value) })}
                className="border rounded px-3 py-2 w-full" /></label>
            <label className="text-sm">교육기관 (선택)
              <input placeholder="예: eduelden" value={form.org}
                onChange={(e) => setForm({ ...form, org: e.target.value })}
                className="border rounded px-3 py-2 w-full" /></label>
            <label className="text-sm">키별 토큰 한도 (0=무제한)
              <input type="number" value={form.tokenLimitPerKey}
                onChange={(e) => setForm({ ...form, tokenLimitPerKey: Number(e.target.value) })}
                className="border rounded px-3 py-2 w-full" /></label>
          </div>
          <div>
            <p className="text-sm mb-1">허용 모델</p>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <label key={m.modelId} className={`px-3 py-1 rounded-full border cursor-pointer text-sm ${
                  form.allowedModels.includes(m.modelId)
                    ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>
                  <input type="checkbox" className="hidden"
                    checked={form.allowedModels.includes(m.modelId)}
                    onChange={() => toggleModel(m.modelId)} />
                  {m.displayName}
                </label>
              ))}
            </div>
          </div>
          <button disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            {busy ? '생성 중…' : '실습 생성'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">실습ID</th><th className="p-3">이름</th>
              <th className="p-3">기간</th><th className="p-3">키</th>
              <th className="p-3">모델</th><th className="p-3">기관</th>
              <th className="p-3">상태</th><th className="p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {workshops.map((w) => (
              <tr key={w.workshopId} className="border-t">
                <td className="p-3 font-mono text-xs">{w.workshopId}</td>
                <td className="p-3">{w.name}</td>
                <td className="p-3 text-xs">{(w.validFrom || '').slice(0, 16)} ~ {(w.expiresAt || '').slice(0, 16)}</td>
                <td className="p-3">{w.keyCount || 0}</td>
                <td className="p-3 text-xs">{(w.allowedModels || []).length}개</td>
                <td className="p-3 text-xs">{w.org || '-'}</td>
                <td className="p-3">{badge(w.status)}</td>
                <td className="p-3 space-x-1 whitespace-nowrap">
                  <button onClick={() => extend(w)} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs hover:bg-amber-200">연장</button>
                  <button onClick={() => cloneWorkshop(w)} className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">복제</button>
                  {w.status !== 'CLOSED' && (
                    <button onClick={() => closeWorkshop(w.workshopId)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">종료</button>
                  )}
                </td>
              </tr>
            ))}
            {!workshops.length && (
              <tr><td colSpan="8" className="p-8 text-center text-gray-400">아직 실습이 없습니다. '+ 새 실습'로 만드세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

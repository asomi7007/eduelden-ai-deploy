import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export default function ModelsPage() {
  const [models, setModels] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ modelId: '', displayName: '', modelType: 'text', deploymentName: '' });

  const load = useCallback(async () => {
    try { setModels(await apiClient('/admin/models')); }
    catch (e) { setMsg(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (modelId, body) => {
    setBusy(true);
    try {
      await apiClient(`/admin/models/${modelId}`, { method: 'PATCH', body });
      load();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient('/admin/models', { method: 'POST', body: form });
      setMsg(`모델 추가: ${form.modelId}`);
      setShowAdd(false);
      setForm({ modelId: '', displayName: '', modelType: 'text', deploymentName: '' });
      load();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };

  const setDefault = async (modelId) => {
    if (!confirm(`${modelId}를 기본 모델로 지정?`)) return;
    await patch(modelId, { isDefault: true });
    // 서버에서 다른 모델 기본 해제 처리 필요 — 목록 새로고침
    load();
  };

  const typeBadge = (t) => (
    <span className={`px-2 py-0.5 rounded text-xs ${
      t === 'router' ? 'bg-purple-100 text-purple-700' :
      t === 'image' ? 'bg-pink-100 text-pink-700' :
      'bg-blue-100 text-blue-700'}`}>{t}</span>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">모델 관리</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showAdd ? '취소' : '+ 모델 추가'}
        </button>
      </div>
      {msg && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded">{msg}</div>}

      {showAdd && (
        <form onSubmit={add} className="mb-6 p-4 bg-white rounded-lg shadow grid grid-cols-4 gap-3">
          <input required placeholder="modelId (Foundry 배포명)" value={form.modelId}
            onChange={(e) => setForm({ ...form, modelId: e.target.value })} className="border rounded px-3 py-2" />
          <input placeholder="표시명" value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="border rounded px-3 py-2" />
          <input placeholder="배포명 (기본=modelId)" value={form.deploymentName}
            onChange={(e) => setForm({ ...form, deploymentName: e.target.value })} className="border rounded px-3 py-2" />
          <select value={form.modelType} onChange={(e) => setForm({ ...form, modelType: e.target.value })}
            className="border rounded px-3 py-2">
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="router">router</option>
          </select>
          <button disabled={busy} className="px-4 py-2 bg-green-600 text-white rounded col-span-4">추가</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">순서</th><th className="p-3">모델 ID</th><th className="p-3">표시명</th>
              <th className="p-3">유형</th><th className="p-3">상태</th><th className="p-3">기본</th><th className="p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.modelId} className="border-t">
                <td className="p-3">{m.displayOrder}</td>
                <td className="p-3 font-mono text-xs">{m.modelId}</td>
                <td className="p-3">{m.displayName}</td>
                <td className="p-3">{typeBadge(m.modelType)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${m.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {m.enabled ? '사용' : '차단'}
                  </span>
                </td>
                <td className="p-3">{m.isDefault && <span className="text-amber-600 font-bold">★</span>}</td>
                <td className="p-3 space-x-1 whitespace-nowrap">
                  <button disabled={busy} onClick={() => patch(m.modelId, { enabled: !m.enabled })}
                    className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {m.enabled ? '비활성화' : '활성화'}
                  </button>
                  {!m.isDefault && (
                    <button disabled={busy} onClick={() => setDefault(m.modelId)}
                      className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">기본으로</button>
                  )}
                  <button disabled={busy} onClick={() => patch(m.modelId, { displayOrder: Math.max(1, (m.displayOrder || 1) - 1) })}
                    className="px-2 py-1 bg-gray-100 rounded text-xs">↑</button>
                  <button disabled={busy} onClick={() => patch(m.modelId, { displayOrder: (m.displayOrder || 1) + 1 })}
                    className="px-2 py-1 bg-gray-100 rounded text-xs">↓</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        ※ 모델 비활성화는 Foundry 배포를 삭제하지 않고 관리 지표에서 제외·실습 생성 시 선택 못 하게 하는 기능입니다.
      </p>
    </div>
  );
}

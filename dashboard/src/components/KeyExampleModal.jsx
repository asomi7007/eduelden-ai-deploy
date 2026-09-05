import { useState } from 'react';
import { apiClient } from '../api/client';

export default function KeyExampleModal({ keyId, onClose }) {
  const [data, setData] = useState(null);
  const [model, setModel] = useState('model-router');
  const [models, setModels] = useState(['model-router']);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('python');
  const [loaded, setLoaded] = useState(false);

  const load = async (m) => {
    setMsg('');
    try {
      const [d, ms] = await Promise.all([
        apiClient(`/admin/keys/${keyId}/example?model=${m}`),
        apiClient('/admin/models').catch(() => []),
      ]);
      setData(d);
      if (ms.length) setModels(ms.filter(x => x.enabled !== false).map(x => x.modelId));
      setLoaded(true);
    } catch (e) { setMsg(e.message); }
  };

  if (!loaded && !msg) { load(model); setLoaded(true); }

  const copy = (text) => { navigator.clipboard.writeText(text); setMsg('복사됨!'); setTimeout(()=>setMsg(''), 1500); };

  const qrUrl = data ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data.shareUrl)}` : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔑 {keyId} 사용 예제</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {msg && <div className="mb-3 p-2 bg-blue-50 text-blue-700 rounded text-sm">{msg}</div>}

        {!data && !msg && <p className="text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {/* 모델 선택 */}
            <div className="mb-4 flex items-center gap-2">
              <label className="text-sm text-gray-600">모델:</label>
              <select value={model} onChange={(e) => { setModel(e.target.value); setData(null); load(e.target.value); }}
                className="border rounded px-2 py-1 text-sm">
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="text-xs text-gray-400">만료: {data.expiresAt?.slice(0, 16)}</span>
            </div>

            {/* QR + 공유 URL */}
            <div className="mb-5 flex gap-4 items-center bg-gray-50 p-4 rounded-lg">
              {qrUrl && <img src={qrUrl} alt="QR" className="w-32 h-32 border rounded bg-white" />}
              <div className="flex-1">
                <p className="text-sm font-bold mb-1">📱 참가자 공유 QR</p>
                <p className="text-xs text-gray-500 mb-2">찍으면 로그인 없이 설정값을 볼 수 있는 페이지가 열립니다</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-[11px] bg-white border rounded px-2 py-1 truncate">{data.shareUrl}</code>
                  <button onClick={() => copy(data.shareUrl)} className="px-2 py-1 bg-gray-800 text-white rounded text-xs">URL 복사</button>
                </div>
                <a href={qrUrl.replace('size=280x280', 'size=600x600')} target="_blank" rel="noreferrer"
                   className="text-xs underline text-blue-600 mt-1 inline-block">큰 QR 이미지 열기</a>
              </div>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 mb-2">
              {['python', 'curl', 'vscode', 'header'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-t text-sm font-mono ${tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>
                  {t === 'vscode' ? 'VS Code' : t}
                </button>
              ))}
            </div>
            <div className="relative">
              <pre className="bg-gray-900 text-green-300 rounded-b-lg p-4 text-xs overflow-x-auto whitespace-pre">{data[tab]}</pre>
              <button onClick={() => copy(data[tab])}
                className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30">복사</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

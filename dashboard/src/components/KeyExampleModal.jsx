import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

const CopyField = ({ label, value, mono = true }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="mb-2">
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="flex gap-2">
        <code className={`flex-1 text-xs bg-gray-50 border rounded px-2 py-2 break-all ${mono ? 'font-mono' : ''}`}>{value}</code>
        <button onClick={copy} className="px-3 bg-slate-700 text-white rounded text-xs whitespace-nowrap">
          {copied ? '✓' : '복사'}
        </button>
      </div>
    </div>
  );
};

export default function KeyExampleModal({ keyId, onClose }) {
  const [data, setData] = useState(null);
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('python');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (m) => {
    setLoading(true);
    setMsg('');
    try {
      const d = await apiClient(`/admin/keys/${keyId}/example${m ? `?model=${m}` : ''}`);
      if (d.shareUrl) d.shareUrl = d.shareUrl.replace(/^https?:\/\/[^/]+/, window.location.origin);
      setData(d);
      if (!m) setModel(d.model || (d.allowedModels || ['model-router'])[0]);
    } catch (e) {
      setMsg('오류: ' + (e.message || e));
    }
    setLoading(false);
  }, [keyId]);

  useEffect(() => { load(''); }, [load]);

  const copy = (text) => { navigator.clipboard.writeText(text); setMsg('복사됨!'); setTimeout(() => setMsg(''), 1500); };
  const qrUrl = data ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data.shareUrl)}` : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔑 {keyId} 접속 정보 · 사용 예제</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {msg && <div className="mb-3 p-2 bg-blue-50 text-blue-700 rounded text-sm">{msg}</div>}
        {loading && !data && <p className="text-gray-400">불러오는 중…</p>}
        {!loading && !data && !msg && <p className="text-gray-400">데이터 없음</p>}

        {data && (
          <>
            {/* 접속 정보 — 2칸만 (URL + 키) */}
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
              <p className="text-xs font-bold text-slate-600 mb-2">접속 정보 — 각 항목 복사해서 입력하세요</p>
              <CopyField label="Wire API (Base URL)" value={`https://apim-eduelden-ai.azure-api.net/openai/v1`} />
              <CopyField label="API 키 (API Key 칸에 이 값만)" value={data.header ? data.header.replace('Ocp-Apim-Subscription-Key: ', '') : ''} />
            </div>

            {/* 모델 목록 — 표시명 + 한줄 설명 + 복사 */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-600 mb-1">Model — 클릭하면 예제에 적용, ID 복사로 복사</p>
              <div className="space-y-1">
                {(data.allowedModels || ['model-router']).map((m) => {
                  const selected = model === m;
                  return (
                  <div key={m} className={`flex gap-2 items-center rounded border px-2 py-1.5 ${selected ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                    <button onClick={() => { setModel(m); load(m); }} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{(data.displayNames || {})[m] || m}</p>
                      <p className="text-[11px] text-gray-500 truncate">{(data.modelDescriptions || {})[m] || m}</p>
                      <code className="text-[10px] text-gray-400 font-mono">{m}</code>
                    </button>
                    <button onClick={() => copy(m)}
                      className="px-2 py-1 bg-green-700 text-white rounded text-xs whitespace-nowrap">{msg === '복사됨!' && selected ? '✓' : 'ID 복사'}</button>
                  </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">만료: {data.expiresAt?.slice(0, 16)} · 이미지 모델은 Copilot 앱 미지원으로 제외</p>
            </div>

            {/* QR — 컴팩트 */}
            <div className="mb-5 bg-gray-50 p-3 rounded-lg flex gap-3 items-center">
              <img src={qrUrl} alt="QR" className="w-24 h-24 border rounded bg-white shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold mb-0.5">📱 참가자 공유 QR</p>
                <p className="text-[11px] text-gray-500 mb-1.5">찍으면 로그인 없이 접속 정보가 보입니다</p>
                <div className="flex gap-1.5">
                  <code className="flex-1 text-[10px] bg-white border rounded px-1.5 py-1 truncate min-w-0">{data.shareUrl}</code>
                  <button onClick={() => copy(data.shareUrl)} className="px-2 py-1 bg-gray-800 text-white rounded text-[11px] whitespace-nowrap shrink-0">복사</button>
                </div>
              </div>
            </div>

            {/* 코드 예제 — python/curl만 */}
            <div className="flex gap-1 mb-2">
              {['python', 'curl'].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-t text-sm font-mono ${tab === t ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>{t}</button>
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

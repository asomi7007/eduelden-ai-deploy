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
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
              <p className="text-xs font-bold text-slate-600 mb-2">접속 정보 — 각 항목 복사해서 입력하세요</p>
              <CopyField label="Display name (표시 이름)" value={data.owner || keyId} mono={false} />
              <CopyField label="Wire API (Base URL)" value={`https://apim-eduelden-ai.azure-api.net/openai/v1`} />
              <CopyField label="API 키 (Custom headers — Ocp-Apim-Subscription-Key 값)" value={data.header ? data.header.replace('Ocp-Apim-Subscription-Key: ', '') : ''} />
              <CopyField label="Custom header 전체" value={data.header || ''} />
              {data.shareUrl && <CopyField label="공유 링크 (QR 대상)" value={data.shareUrl} />}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <label className="text-sm text-gray-600">모델:</label>
              <select
                value={model}
                onChange={(e) => { const m = e.target.value; setModel(m); load(m); }}
                className="border rounded px-2 py-1 text-sm">
                {(data.allowedModels || ['model-router']).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">이 실습에 배정된 모델만 표시 · 만료: {data.expiresAt?.slice(0, 16)}</span>
            </div>

            <div className="mb-5 flex gap-4 items-center bg-gray-50 p-4 rounded-lg">
              {qrUrl && <img src={qrUrl} alt="QR" className="w-32 h-32 border rounded bg-white" />}
              <div className="flex-1">
                <p className="text-sm font-bold mb-1">📱 참가자 공유 QR</p>
                <p className="text-xs text-gray-500 mb-2">찍으면 로그인 없이 위와 동일한 접속 정보 + 모델 선택이 보입니다</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-[11px] bg-white border rounded px-2 py-1 truncate">{data.shareUrl}</code>
                  <button onClick={() => copy(data.shareUrl)} className="px-2 py-1 bg-gray-800 text-white rounded text-xs">URL 복사</button>
                </div>
                <a href={qrUrl.replace('size=280x280', 'size=600x600')} target="_blank" rel="noreferrer"
                   className="text-xs underline text-blue-600 mt-1 inline-block">큰 QR 이미지 열기</a>
              </div>
            </div>

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

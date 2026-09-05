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

const EFFORTS = ['low', 'medium', 'high'];

/** 모델 설정 블록 — Copilot 2차 설정 화면과 동일 순서 */
const ModelSetup = ({ m, d, selected, onSelect, onCopy, copiedKey, onCopyValue }) => {
  const caps = (d.modelCapabilities || {})[m] || {};
  const efforts = caps.reasoningEfforts || [];
  return (
    <div className={`rounded border px-3 py-2 ${selected ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <button onClick={onSelect} className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-gray-800">{(d.displayNames || {})[m] || m}</p>
          <p className="text-[11px] text-gray-500 truncate">{(d.modelDescriptions || {})[m] || ''}</p>
        </button>
        <button onClick={onCopy} className="px-2 py-1 bg-green-700 text-white rounded text-xs whitespace-nowrap shrink-0">
          {copiedKey ? '✓' : 'ID 복사'}
        </button>
      </div>
      {/* Wire model 값 */}
      <div className="mt-1.5 flex items-center gap-2">
        <p className="text-[11px] text-gray-400 w-20 shrink-0">Wire model</p>
        <code className="text-[11px] text-gray-700 font-mono bg-gray-100 rounded px-1.5 py-0.5">{m}</code>
      </div>
      {/* max prompt/output tokens */}
      {(() => {
        const tl = (d.modelTokenLimits || {})[m] || {};
        return (tl.maxPromptTokens != null) ? (
          <div className="mt-0.5 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-400 w-20 shrink-0">Max prompt tokens</p>
              <code className="text-[11px] text-gray-700 font-mono bg-gray-100 rounded px-1.5 py-0.5">{tl.maxPromptTokens.toLocaleString()}</code>
              <button onClick={() => onCopyValue('maxp-' + m, String(tl.maxPromptTokens))}
                className="text-[10px] px-1.5 py-0.5 bg-slate-200 rounded hover:bg-slate-300">복사</button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-400 w-20 shrink-0">Max output tokens</p>
              <code className="text-[11px] text-gray-700 font-mono bg-gray-100 rounded px-1.5 py-0.5">{tl.maxOutputTokens.toLocaleString()}</code>
              <button onClick={() => onCopyValue('maxo-' + m, String(tl.maxOutputTokens))}
                className="text-[10px] px-1.5 py-0.5 bg-slate-200 rounded hover:bg-slate-300">복사</button>
            </div>
          </div>
        ) : null;
      })()}
      {/* Reasoning effort — 실제 지원하는 값만 체크 */}
      {efforts.length > 0 && (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-gray-400 w-20 shrink-0">Reasoning effort</p>
          {EFFORTS.map((e) => (
            <label key={e} className={`flex items-center gap-1 text-[11px] ${efforts.includes(e) ? 'text-gray-700' : 'text-gray-300'}`}>
              <input type="checkbox" checked={efforts.includes(e)} readOnly disabled={!efforts.includes(e)}
                className="accent-green-600 w-3 h-3" />
              {e}
            </label>
          ))}
        </div>
      )}
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
              <CopyField label="Display name" value="Elden-Azure-AI" mono={false} />
              <CopyField label="Wire API (Base URL)" value={`https://apim-eduelden-ai.azure-api.net/openai/v1`} />
              <CopyField label="API 키 (API Key 칸에 이 값만)" value={data.header ? data.header.replace('Ocp-Apim-Subscription-Key: ', '') : ''} />
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-gray-600 mb-1">Model — Wire model 값 복사, 지원하는 Reasoning effort만 체크 표시</p>
              <div className="space-y-1.5">
                {(data.allowedModels || ['model-router']).map((m) => (
                  <ModelSetup key={m} m={m} d={data} selected={model === m}
                    onSelect={() => { setModel(m); load(m); }}
                    onCopy={() => copy(m)} copiedKey={msg === '복사됨!'}
                    onCopyValue={(k, v) => copy(v)} />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">만료: {data.expiresAt?.slice(0, 16)} · 이미지 모델은 Copilot 앱 미지원으로 제외</p>
            </div>

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

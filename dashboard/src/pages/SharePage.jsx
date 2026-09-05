import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const CopyField = ({ label, value, accent = false }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="mb-3">
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="flex gap-2">
        <code className={`flex-1 text-sm border rounded px-2 py-2 break-all font-mono ${
          accent ? 'bg-amber-50 border-amber-300' : 'bg-gray-50'}`}>{value}</code>
        <button onClick={copy}
          className={`px-3 text-white rounded text-xs whitespace-nowrap ${accent ? 'bg-amber-600' : 'bg-blue-600'}`}>
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
    </div>
  );
};

/** 비로그인 공유 페이지 — 관리자 예제 모달과 동일한 수준의 정보 */
export default function SharePage() {
  const { keyId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const [tab, setTab] = useState('python');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch(`/api/share/${keyId}?t=${t}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
          setModel((j.data.allowedModels || ['model-router'])[0]);
        } else setError(j.error || '링크가 유효하지 않습니다');
      })
      .catch(() => setError('서버에 연결할 수 없습니다'));
  }, [keyId, t]);

  const KEY = data?.apiKey || '';
  const URL_ = data?.baseUrl || '';

  const genSnippets = (m) => ({
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${URL_}",
    api_key="${KEY}"
)

response = client.chat.completions.create(
    model="${m}",
    messages=[{"role": "user", "content": "안녕하세요!"}]
)
print(response.choices[0].message.content)`,
    curl: `curl -X POST "${URL_}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${KEY}" \\
  -d '{"model":"${m}","messages":[{"role":"user","content":"안녕하세요!"}]}'`,
  });

  const current = model ? genSnippets(model) : null;
  const copy = (label, text) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 1500); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-gray-800">실습 API 접속 정보</h1>
          {data && <p className="text-sm text-gray-500 mt-1">{data.owner || data.keyId} · {data.workshopId}</p>}
          <p className="text-xs text-gray-400 mt-1">아래 값을 복사해서 GitHub Copilot 앱에 입력하세요</p>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">⚠️ {error}</div>}
        {!data && !error && <p className="text-center text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {/* 접속 정보 — 관리자 모달과 동일 구성 (URL + 키) */}
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
              <p className="text-xs font-bold text-slate-600 mb-2">접속 정보 — 각 항목 복사해서 입력하세요</p>
              <CopyField label="Wire API (Base URL)" value={URL_} />
              <CopyField label="API 키 (API Key 칸에 이 값만)" value={KEY || '(키 없음)'} accent />
            </div>

            {/* 모델 목록 — 표시명 + 한줄 설명 + ID + 복사 */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-600 mb-1">Model — 원하는 모델의 ID를 복사</p>
              <div className="space-y-1">
                {(data.allowedModels || ['model-router']).map((m) => (
                  <div key={m} className={`flex gap-2 items-center rounded border px-2 py-1.5 ${model === m ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
                    <button onClick={() => setModel(m)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{(data.displayNames || {})[m] || m}</p>
                      <p className="text-[11px] text-gray-500 truncate">{(data.modelDescriptions || {})[m] || m}</p>
                      <code className="text-[10px] text-gray-400 font-mono">{m}</code>
                    </button>
                    <button onClick={() => copy('model-' + m, m)}
                      className="px-2 py-1 bg-green-700 text-white rounded text-xs whitespace-nowrap shrink-0">
                      {copied === 'model-' + m ? '✓' : 'ID 복사'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">만료: {data.expiresAt?.slice(0, 16).replace('T', ' ')} · 분당 10회 / 일 200회 · 이미지 모델은 미지원</p>
            </div>

            {/* 코드 예제 — python/curl만, 탭 */}
            {current && (
              <div className="mb-2">
                <div className="flex gap-1 mb-2">
                  {['python', 'curl'].map((k) => (
                    <button key={k} onClick={() => setTab(k)}
                      className={`px-3 py-1.5 rounded-t text-sm font-mono ${tab === k ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>{k}</button>
                  ))}
                </div>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{current[tab]}</pre>
                  <button onClick={() => copy(tab, current[tab])}
                    className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === tab ? '✓' : '복사'}</button>
                </div>
              </div>
            )}

            <div className="mt-4 border-t pt-3 text-xs text-gray-400 text-center">
              이 링크는 키가 만료·정지되면 자동으로 비활성화됩니다
            </div>
          </>
        )}
      </div>
    </div>
  );
}

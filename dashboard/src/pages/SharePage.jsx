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
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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

/** 비로그인 공유 페이지 — QR 찍은 참가자용 (실제 키 + 복사 칸 + 배정 모델 드롭다운) */
export default function SharePage() {
  const { keyId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const [snip, setSnip] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch(`/api/share/${keyId}?t=${t}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
          const models = j.data.allowedModels || ['model-router'];
          setModel(j.data.snippets ? (j.data.allowedModels?.[0] || 'model-router') : models[0]);
          setSnip(j.data.snippets || null);
        } else setError(j.error || '링크가 유효하지 않습니다');
      })
      .catch(() => setError('서버에 연결할 수 없습니다'));
  }, [keyId, t]);

  const KEY = data?.apiKey || '';
  const URL_ = data?.baseUrl || '';

  // 모델 변경 시 로컬에서 예제 재생성 (API 재호출 없이)
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
  -H "Ocp-Apim-Subscription-Key: ${KEY}" \\
  -d '{"model":"${m}","messages":[{"role":"user","content":"안녕하세요!"}]}'`,
    header: `Ocp-Apim-Subscription-Key: ${KEY}`,
  });

  const current = model ? genSnippets(model) : null;
  const copy = (label, text) => { navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 1500); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-gray-800">실습 API 접속 정보</h1>
          {data && <p className="text-sm text-gray-500 mt-1">{data.owner || data.keyId} 님 · {data.workshopId}</p>}
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">⚠️ {error}</div>}
        {!data && !error && <p className="text-center text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {/* 복사 칸들 */}
            <CopyField label="Display name (표시 이름)" value={data.owner || data.keyId} />
            <CopyField label="Wire API (Base URL)" value={URL_} />
            <CopyField label="API 키 — 이 값을 그대로 입력하세요" value={KEY || '(키 없음)'} accent />

            {/* 모델 드롭다운 — 실습 배정 모델만 */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">모델 (이 실습에 배정된 모델만 선택 가능)</p>
              <select value={model} onChange={(e) => setModel(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm bg-gray-50">
                {(data.allowedModels || ['model-router']).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-sm mb-4">
              <p className="text-xs text-gray-500">만료: {data.expiresAt?.slice(0, 16).replace('T', ' ')} 까지 · 분당 10회 / 일 200회 제한</p>
            </div>

            {/* Python / curl / header 탭 */}
            {current && (
              <div className="mb-2">
                {/* python */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Python 예제 (model={model})</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{current.python}</pre>
                    <button onClick={() => copy('py', current.python)}
                      className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'py' ? '✓' : '복사'}</button>
                  </div>
                </div>
                {/* curl */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">curl 예제</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{current.curl}</pre>
                    <button onClick={() => copy('curl', current.curl)}
                      className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'curl' ? '✓' : '복사'}</button>
                  </div>
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

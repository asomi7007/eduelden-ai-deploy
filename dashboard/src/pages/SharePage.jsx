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

/** 비로그인 공유 페이지 — GitHub Copilot 앱 입력란 1:1 대응 */
export default function SharePage() {
  const { keyId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
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
          {data && <p className="text-sm text-gray-500 mt-1">{data.owner || data.keyId} 님 · {data.workshopId}</p>}
          <p className="text-xs text-gray-400 mt-1">아래 3개 값을 GitHub Copilot 앱에 순서대로 붙여넣으세요</p>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">⚠️ {error}</div>}
        {!data && !error && <p className="text-center text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {/* STEP 1: Base URL */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                <p className="text-xs font-bold text-gray-600">Base URL — 앱의 Base URL 칸에 붙여넣기</p>
              </div>
              <CopyField label="" value={URL_} />
            </div>

            {/* STEP 2: API 키 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-amber-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                <p className="text-xs font-bold text-gray-600">API Key — 앱의 API Key 칸에 붙여넣기 (이 값만)</p>
              </div>
              <CopyField label="" value={KEY || '(키 없음)'} accent />
            </div>

            {/* STEP 3: 모델 — 개별 복사 버튼 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                <p className="text-xs font-bold text-gray-600">Model ID — 사용할 모델 하나를 골라 복사</p>
              </div>
              <div className="space-y-1">
                {(data.allowedModels || ['model-router']).map((m) => {
                  const disp = (data.displayNames || {})[m] || m;
                  return (
                  <div key={m} className="flex gap-2 items-center">
                    <div className="flex-1 bg-gray-50 border rounded px-2 py-2">
                      <p className="text-sm font-semibold text-gray-800">{disp}</p>
                      <code className="text-[11px] text-gray-400 font-mono">{m}</code>
                    </div>
                    <button onClick={() => copy('model-' + m, m)}
                      className="px-3 py-2 bg-green-700 text-white rounded text-xs whitespace-nowrap">
                      {copied === 'model-' + m ? '✓ 복사됨' : 'ID 복사'}
                    </button>
                  </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">※ model-router를 쓰면 질문에 맞춰 자동으로 최적 모델이 선택됩니다</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-sm mb-4">
              <p className="text-xs text-gray-500">만료: {data.expiresAt?.slice(0, 16).replace('T', ' ')} 까지 · 분당 10회 / 일 200회 제한</p>
              <p className="text-[11px] text-gray-400 mt-1">이미지 생성 모델(gpt-image-2)은 GitHub Copilot 앱에서 사용할 수 없습니다 (텍스트 전용)</p>
            </div>

            {/* 예제 (모델 선택 반영) */}
            {current && (
              <details className="mb-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">▼ 코드 예제 보기 (model={model})</summary>
                <div className="mt-2">
                  <div className="relative mb-2">
                    <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{current.python}</pre>
                    <button onClick={() => copy('py', current.python)}
                      className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'py' ? '✓' : '복사'}</button>
                  </div>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{current.curl}</pre>
                    <button onClick={() => copy('curl', current.curl)}
                      className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'curl' ? '✓' : '복사'}</button>
                  </div>
                </div>
              </details>
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

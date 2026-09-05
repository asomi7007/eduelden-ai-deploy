import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/** 비로그인 공유 페이지 — QR 찍은 참가자용 설정값 안내 (실제 키 직접 표시) */
export default function SharePage() {
  const { keyId } = useParams();
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch(`/api/share/${keyId}?t=${t}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else setError(j.error || '링크가 유효하지 않습니다');
      })
      .catch(() => setError('서버에 연결할 수 없습니다'));
  }, [keyId, t]);

  const copy = (label, text) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  const KEY = data?.apiKey || '';
  const URL_ = data?.baseUrl || '';

  const pythonEx = `from openai import OpenAI

client = OpenAI(
    base_url="${URL_}",
    api_key="${KEY}"
)

response = client.chat.completions.create(
    model="model-router",
    messages=[{"role": "user", "content": "안녕하세요!"}]
)
print(response.choices[0].message.content)`;

  const curlEx = `curl -X POST "${URL_}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Ocp-Apim-Subscription-Key: ${KEY}" \\
  -d '{"model":"model-router","messages":[{"role":"user","content":"안녕하세요!"}]}'`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-gray-800">실습 API 접속 정보</h1>
          {data && <p className="text-sm text-gray-500 mt-1">{data.owner || data.keyId} 님 · {data.workshopId}</p>}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">⚠️ {error}</div>
        )}

        {!data && !error && <p className="text-center text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            {/* Base URL */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Base URL — 여기에 입력할 값</p>
              <div className="flex gap-2">
                <code className="flex-1 text-sm bg-gray-50 border rounded px-2 py-2 break-all">{URL_}</code>
                <button onClick={() => copy('url', URL_)}
                  className="px-3 bg-blue-600 text-white rounded text-xs whitespace-nowrap">{copied === 'url' ? '✓ 복사됨' : '복사'}</button>
              </div>
            </div>

            {/* API 키 — 실제 값 직접 표시 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">API 키 — 여기에 입력할 값 (실제 값)</p>
              <div className="flex gap-2">
                <code className="flex-1 text-sm bg-amber-50 border border-amber-300 rounded px-2 py-2 break-all font-mono">{KEY || '(키를 불러올 수 없습니다 — 관리자에게 재발급 요청)'}</code>
                <button onClick={() => copy('key', KEY)}
                  className="px-3 bg-amber-600 text-white rounded text-xs whitespace-nowrap">{copied === 'key' ? '✓ 복사됨' : '복사'}</button>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-sm mb-4">
              <p>모델(기본): <code className="font-mono">model-router</code></p>
              <p className="text-xs text-gray-500 mt-1">만료: {data.expiresAt?.slice(0, 16).replace('T', ' ')} 까지</p>
              <p className="text-xs text-gray-500">분당 10회 / 일 200회 제한</p>
            </div>

            {/* Python 예제 — 실제 키 박힌 채 */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Python 사용 예제 (복사해서 바로 실행 가능)</p>
              <div className="relative">
                <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{pythonEx}</pre>
                <button onClick={() => copy('py', pythonEx)}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'py' ? '✓' : '복사'}</button>
              </div>
            </div>

            {/* curl 예제 */}
            <div>
              <p className="text-xs text-gray-400 mb-1">curl 예제</p>
              <div className="relative">
                <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto whitespace-pre">{curlEx}</pre>
                <button onClick={() => copy('curl', curlEx)}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'curl' ? '✓' : '복사'}</button>
              </div>
            </div>

            <div className="mt-5 border-t pt-4 text-xs text-gray-400 text-center">
              이 링크는 키가 만료·정지되면 자동으로 비활성화됩니다
            </div>
          </>
        )}
      </div>
    </div>
  );
}

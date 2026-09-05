import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/** 비로그인 공유 페이지 — QR 찍은 참가자용 설정값 안내 */
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

  const example = (apiKeyPlaceholder) => `from openai import OpenAI

client = OpenAI(
    base_url="${data?.baseUrl || ''}",
    api_key="${apiKeyPlaceholder}"
)

response = client.chat.completions.create(
    model="model-router",
    messages=[{"role": "user", "content": "안녕하세요!"}]
)
print(response.choices[0].message.content)`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-gray-800">실습 API 설정 안내</h1>
          {data && <p className="text-sm text-gray-500 mt-1">{data.owner || data.keyId} 님의 접속 정보</p>}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
            ⚠️ {error}
          </div>
        )}

        {!data && !error && <p className="text-center text-gray-400">불러오는 중…</p>}

        {data && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Base URL</p>
                  <code className="text-sm bg-gray-50 border rounded px-2 py-1 block truncate">{data.baseUrl}</code>
                </div>
                <button onClick={() => copy('url', data.baseUrl)}
                  className="mt-4 px-3 py-1 bg-blue-600 text-white rounded text-xs">{copied === 'url' ? '✓' : '복사'}</button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-400">API 키 (발급 시 받은 값)</p>
                  <code className="text-sm bg-gray-50 border rounded px-2 py-1 block">{data.maskedKey}</code>
                  <p className="text-[11px] text-amber-600 mt-1">※ 실제 키 전체는 관리자가 발급 시 전달한 값(예: 이메일/쪽지)을 입력하세요</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>모델(기본): <code className="font-mono">model-router</code></p>
                <p className="text-xs text-gray-500 mt-1">만료: {data.expiresAt?.slice(0, 16).replace('T', ' ')} 까지</p>
                <p className="text-xs text-gray-500">실습: {data.workshopId}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs text-gray-400 mb-1">Python 사용 예제 (api_key에 받은 키를 넣으세요)</p>
              <div className="relative">
                <pre className="bg-gray-900 text-green-300 rounded-lg p-3 text-[11px] overflow-x-auto">{example('<여기에_받은_API키_입력>')}</pre>
                <button onClick={() => copy('py', example('<여기에_받은_API키_입력>'))}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/20 text-white rounded text-xs">{copied === 'py' ? '✓' : '복사'}</button>
              </div>
            </div>

            <div className="mt-5 border-t pt-4 text-xs text-gray-400 text-center">
              분당 10회 / 일 200회 제한 · 만료 시 자동 정지
            </div>
          </>
        )}
      </div>
    </div>
  );
}

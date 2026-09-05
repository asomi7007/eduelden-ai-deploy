'use strict';

/** 참가자용 설정 스니펫 생성 (관리페이지 예제 + 공유 페이지 공용) */

function baseUrl() {
  const svc = process.env.APIM_SERVICE_NAME || 'apim-eduelden-ai';
  return `https://${svc}.azure-api.net/openai/v1`;
}

function buildSnippets(apiKey, model) {
  const base = baseUrl();
  const m = model || 'model-router';
  return {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${base}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${m}",
    messages=[{"role": "user", "content": "안녕하세요!"}]
)
print(response.choices[0].message.content)`,
    curl: `curl -X POST "${base}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Ocp-Apim-Subscription-Key: ${apiKey}" \\
  -d '{"model":"${m}","messages":[{"role":"user","content":"안녕하세요!"}]}'`,
    vscode: `// VS Code settings.json (Cline 등 OpenAI 호환 확장)
{
  "openai.apiBaseUrl": "${base}",
  "openai.apiKey": "${apiKey}",
  "openai.model": "${m}"
}`,
    header: `Ocp-Apim-Subscription-Key: ${apiKey}`,
  };
}

module.exports = { buildSnippets, baseUrl };

/** 모델 기능 메타 — 실측 기준 (2026-09-05)
 * reasoningEfforts: reasoning_effort 파라미터로 실제 동작 확인된 값만
 * maxCompletionTokens: max_tokens 미지원 → max_completion_tokens 필수 여부
 */
const MODEL_CAPABILITIES = {
  'model-router':      { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: false },
  'gpt-5.6-sol':       { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: true },
  'gpt-5.6-terra':     { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: true },
  'gpt-5.6-luna':      { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: true },
  'gpt-chat-latest':   { reasoningEfforts: ['medium','high'],       maxCompletionTokens: true },
  'DeepSeek-V4-Flash': { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: false },
  'grok-4.6':          { reasoningEfforts: ['low','medium','high'], maxCompletionTokens: false },
  'gpt-image-2':       { reasoningEfforts: [],                      maxCompletionTokens: false },
};

/** 모델별 한줄 설명 (특징 + 단가) */
const MODEL_DESCRIPTIONS = {
  'model-router':      '자동 라우팅 — 질문에 맞춰 최적 모델 선택, 기본 추천',
  'gpt-5.6-luna':      '초경량 초속 — 간단한 질문·대량 처리용, 가장 저렴 ($0.20/$1.20 per 1M)',
  'gpt-5.6-sol':       '최고 성능 — 복잡한 추론·코딩, 프리미엄 ($5/$30 per 1M)',
  'gpt-5.6-terra':     '균형형 — 품질과 속도의 중간, 범용 업무 ($2/$12 per 1M)',
  'gpt-chat-latest':   'OpenAI 최신 범용 챗 모델 ($5/$30 per 1M)',
  'DeepSeek-V4-Flash': '경제적 코드·수학 특화, 빠른 응답 ($0.19/$0.51 per 1M)',
  'grok-4.6':          'xAI 실시간 지식 + 강한 추론 ($1.25/$2.50 per 1M)',
  'gpt-image-2':       '이미지 생성 전용 — Copilot 앱 미지원',
};

module.exports.MODEL_DESCRIPTIONS = MODEL_DESCRIPTIONS;
module.exports.MODEL_CAPABILITIES = MODEL_CAPABILITIES;

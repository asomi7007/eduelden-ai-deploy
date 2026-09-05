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

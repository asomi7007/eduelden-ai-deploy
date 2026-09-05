'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');

/**
 * GET /api/dashboard/admin/snippets?key=<apiKey>&model=<modelId>&lang=<py|js|ps1|vscode|qr>
 * 참가자용 설정 스니펫 자동 생성 (발급 직후 화면/QR에 사용).
 * ⚠️ 실제 키는 응답에 포함되지 않음 — 프론트에서 발급 응답의 키를 조합해 사용.
 *    여기서는 key 파라미터를 받아 스니펫 문자열만 만들어 돌려준다 (로깅 없음).
 */
function buildSnippets(apiKey, model, baseUrl) {
  const base = baseUrl || 'https://apim-eduelden-ai.azure-api.net/openai/v1';
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
    javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}",
  apiKey: "${apiKey}",
});

const response = await client.chat.completions.create({
  model: "${m}",
  messages: [{ role: "user", content: "안녕하세요!" }],
});
console.log(response.choices[0].message.content);`,
    powershell: `$body = @'
{
  "model": "${m}",
  "messages": [{"role": "user", "content": "안녕하세요!"}]
}
'@

Invoke-RestMethod -Uri "${base}/chat/completions" \\
  -Method Post \\
  -ContentType "application/json" \\
  -Headers @{ "Ocp-Apim-Subscription-Key" = "${apiKey}" } \\
  -Body $body | ConvertTo-Json -Depth 10`,
    vscode: `// VS Code settings.json — Cline 등 OpenAI 호환 확장용
{
  "openai.apiBaseUrl": "${base}",
  "openai.apiKey": "${apiKey}",
  "openai.model": "${m}"
}`,
    curl: `curl -X POST "${base}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Ocp-Apim-Subscription-Key: ${apiKey}" \\
  -d '{"model":"${m}","messages":[{"role":"user","content":"hi"}]}'`,
  };
}

app.http('adminSnippets', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/snippets',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      let apiKey, model;
      if (request.method === 'GET') {
        apiKey = request.query.get('key') || '';
        model = request.query.get('model') || 'model-router';
      } else {
        const body = await request.json();
        apiKey = body.key || '';
        model = body.model || 'model-router';
      }
      if (!apiKey) return errorResponse('key required', 400);
      const snippets = buildSnippets(apiKey, model);
      // QR: qrserver.io 공개 API — 설정 페이지 URL 파라미터 방식이면 key 노출 없이
      // 참가자 페이지로 전달 가능. 여기선 vscode settings 스니펫을 data URL로.
      const qrPayload = encodeURIComponent(snippets.vscode);
      snippets.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrPayload}`;
      return successResponse(snippets);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

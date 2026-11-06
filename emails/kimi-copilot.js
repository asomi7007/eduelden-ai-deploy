// Techive 행사 이메일 템플릿 — VS Code + GitHub Copilot BYOK(Custom Endpoint)
const { tbl, code, stepCircle } = require('./helpers');

const MODEL_ID = 'Kimi-K3.1-Pro';
const MODEL_NAME = 'Kimi K3.1 Pro';
const EVENT_NAME = 'Techive의 여덟 번째 발표  with 광주과학기술원';
const PRACTICE_URL = 'https://power-platform-users-korea.github.io/copilot-dev-days-seoul-2026/powerbi-agent/';

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pre = (t) =>
  `<pre style="background:#1e293b;color:#e2e8f0;border-radius:8px;padding:14px;margin:8px 0;overflow-x:auto;white-space:pre-wrap;word-break:break-all;font-family:'Cascadia Code',Consolas,monospace;font-size:13px;line-height:1.6">${t}</pre>`;

const h2 = (t, color) =>
  `<h2 style="color:${color};border-bottom:2px solid ${color};padding-bottom:6px;font-size:18px;margin-top:28px">${t}</h2>`;

function generate({ studentId, apiKey, apimUrl }) {
  const baseUrl = String(apimUrl).replace(/\/+$/, '');
  const chatUrl = `${baseUrl}/chat/completions`;

  const subject = `[${EVENT_NAME}] ${studentId}번 — 접속 정보 및 설치 안내`;

  const modelJson = JSON.stringify([{
    name: 'Eduelden',
    vendor: 'customendpoint',
    apiKey,
    apiType: 'chat-completions',
    models: [{
      id: MODEL_ID,
      name: MODEL_NAME,
      url: chatUrl,
      requestHeaders: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      toolCalling: true,
      vision: false,
      maxInputTokens: 120000,
      maxOutputTokens: 4096,
    }],
  }], null, 2);

  const html = `<div style="font-family:'Segoe UI',Pretendard,'Malgun Gothic',sans-serif;max-width:680px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(135deg,#1a56db,#7c3aed);padding:26px 24px;border-radius:12px 12px 0 0;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:22px">${EVENT_NAME}</h1>
  <p style="color:#e0e7ff;margin:8px 0 0;font-size:14px">VS Code + GitHub Copilot | 2026년 11월 7일 (토)</p>
</div>
<div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">

<p>안녕하세요, <b>${escapeHtml(studentId)}번</b> 참가자님! 신청이 완료되었습니다.</p>
<p style="color:#555;font-size:14px">아래 안내에 따라 <b>수업 전까지</b> 설치와 모델 등록을 완료해 주세요.</p>

${h2('1. 내 접속 정보', '#1a56db')}
<table ${tbl}>
  <tr style="background:#f0f7ff"><td style="width:130px"><b>엔드포인트 URL</b></td><td style="word-break:break-all">${code(escapeHtml(baseUrl))}</td></tr>
  <tr><td><b>모델 ID</b></td><td>${code(MODEL_ID)}</td></tr>
</table>
<p style="margin:12px 0 4px"><b>API 키</b> <span style="color:#dc2626;font-size:13px">(다른 사람에게 공유하지 마세요)</span></p>
${pre(escapeHtml(apiKey))}

${h2('2. 설치 (수업 전 완료)', '#16a34a')}
<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <tr><td style="padding:10px 0;vertical-align:top;width:38px">${stepCircle('1', '#bbf7d0')}</td>
  <td style="padding:10px 0 10px 10px"><b>VS Code 설치</b><br/>
    <a href="https://code.visualstudio.com/download" style="color:#1a56db">https://code.visualstudio.com/download</a></td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('2', '#bbf7d0')}</td>
  <td style="padding:10px 0 10px 10px"><b>Power BI Desktop 설치</b> (Windows 전용)<br/>
    <a href="https://aka.ms/pbidesktopstore" style="color:#1a56db">https://aka.ms/pbidesktopstore</a><br/>
    <span style="font-size:13px;color:#555">Microsoft Store로 설치하는 것을 권장합니다.</span></td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('3', '#bbf7d0')}</td>
  <td style="padding:10px 0 10px 10px"><b>GitHub 계정 준비 + GitHub Copilot 확장 설치·로그인</b><br/>
    <span style="font-size:13px;color:#555">GitHub 계정이 없으면 먼저 가입하세요. VS Code에서 GitHub Copilot 확장을 설치하고 GitHub 계정으로 로그인합니다. Copilot Free 플랜으로도 가능합니다.</span></td></tr>
</table>

${h2('3. VS Code에 모델 등록', '#7c3aed')}
<ol style="line-height:1.9;padding-left:20px">
  <li>VS Code의 <b>Copilot Chat</b> 창을 엽니다.</li>
  <li>모델 선택 드롭다운 &gt; <b>Manage Language Models...</b> 를 클릭합니다.</li>
  <li><b>Add Model</b> &gt; <b>Custom Endpoint</b> 를 선택합니다.</li>
  <li>열리는 ${code('chatLanguageModels.json')} 에 아래 JSON을 <b>그대로 붙여넣고</b> 저장합니다. (API 키는 이미 들어 있습니다)</li>
</ol>
${pre(escapeHtml(modelJson))}
<p style="font-size:14px">저장 후 모델 선택 드롭다운에서 <b>"${MODEL_NAME}"</b> 을 선택하세요.</p>
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin:12px 0;font-size:13px">
  <b>주의</b>: API type은 반드시 <b>Chat Completions</b> 여야 합니다. <b>Azure</b> 공급자(Azure OpenAI)를 선택하면 동작하지 않습니다.
</div>

${h2('4. 확인 테스트', '#0891b2')}
<p>Copilot Chat 창에서 <b>${MODEL_NAME}</b> 모델을 선택한 뒤 아래 문장을 입력하세요.</p>
${pre('안녕하세요라고 답해줘')}
<p style="font-size:14px">AI가 "안녕하세요"라고 응답하면 설정이 완료된 것입니다.</p>

${h2('5. Power BI AI 에이전트 실습', '#0891b2')}
<p>이번 실습에서는 한결전자(K-Retail)의 교육용 가상 데이터로 Power BI 모델을 연결하고, AI 에이전트와 함께 DAX 측정값 생성·검증부터 보고서 화면 작성과 검수까지 진행합니다.</p>
<p><a href="${PRACTICE_URL}" style="color:#1a56db">PBI_AGENT_QUEST · 한결전자(K-Retail) Power BI AI 에이전트 완전 자동화 매뉴얼</a><br/>
  <span style="word-break:break-all;font-size:13px">${PRACTICE_URL}</span></p>
<p>설치와 모델 연결 테스트를 마치신 뒤 실습 페이지를 열어주세요. 페이지의 실습 패키지 ZIP을 내려받고 실습 데이터와 PBIP 준비, MCP 연결 안내부터 강사와 함께 진행합니다.</p>
<p style="font-size:13px;color:#555">매뉴얼에는 여러 에이전트 도구의 예시가 있습니다. 이번 행사에서는 위에서 설정한 VS Code + GitHub Copilot과 ${MODEL_ID}를 사용합니다. 실습 페이지의 MCP·도구 설정도 별도로 따라주세요.</p>

${h2('6. 문제 해결', '#dc2626')}
<table ${tbl}>
  <tr style="background:#f8fafc"><th style="width:180px;text-align:left">증상</th><th style="text-align:left">해결 방법</th></tr>
  <tr><td><b>429 응답</b></td><td>분당 30회 제한입니다. 잠시(약 1분) 기다린 뒤 다시 시도하세요.</td></tr>
  <tr style="background:#f8fafc"><td><b>400 model_not_allowed</b></td><td>모델 ID를 ${code(MODEL_ID)} 로 정확히 입력했는지 확인하세요.</td></tr>
  <tr><td><b>401 (키 관련 오류)</b></td><td>이 메일의 JSON에서 ${code('apiKey')}와 ${code('requestHeaders.Ocp-Apim-Subscription-Key')} 값이 같은지 확인하고, 키를 바꾸지 않았는지 확인하세요.</td></tr>
</table>

<p style="color:#6b7280;font-size:13px;margin-top:28px;border-top:1px solid #e2e8f0;padding-top:12px">
  문의: <a href="mailto:admin@eldensolution.kr" style="color:#1a56db">admin@eldensolution.kr</a> 또는 현장 강사에게 문의하세요.
</p>

</div></div>`;

  return { subject, html };
}

module.exports = { generate };

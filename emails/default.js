// Default (Azure AI Foundry) email template
const { tbl, code, codeBox } = require('./helpers');

function generate({ studentId, apiKey, apimUrl, azAccount, azPassword }) {
  const scriptUrl = 'https://raw.githubusercontent.com/asomi7007/eduelden-ai-deploy/main/scripts/setup-student.ps1';

  const subject = `[AI 실습] 학생 ${studentId}번 환경 설정 안내`;

  const html = `<div style="font-family:'Segoe UI',Pretendard,sans-serif;max-width:680px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(135deg,#1a56db,#7c3aed);padding:24px;border-radius:12px 12px 0 0;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:22px">Azure AI Foundry 바이브코딩 실습</h1>
  <p style="color:#e0e7ff;margin:8px 0 0;font-size:14px">VS Code + Cline으로 AI 바이브코딩을 시작하세요!</p>
</div>
<div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">

<p>안녕하세요, <b>${studentId}번</b> 학생! 실습 환경 설정에 필요한 모든 정보입니다.</p>

<h2 style="color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:6px">내 정보</h2>
<table ${tbl}>
  <tr style="background:#f0f7ff"><td style="width:140px"><b>Azure 계정</b></td><td>${code(azAccount)}</td></tr>
  <tr><td><b>초기 비밀번호</b></td><td>${code(azPassword)}</td></tr>
  <tr style="background:#f0fdf4"><td><b>API Base URL</b></td><td>${code(apimUrl + '/openai/v1')}</td></tr>
  <tr><td><b>API Key</b></td><td>${code(apiKey)}</td></tr>
  <tr style="background:#f0f7ff"><td><b>기본 모델</b></td><td>${code('gpt-54-mini')}</td></tr>
</table>
<p style="color:#dc2626;font-size:0.9em">Azure 첫 로그인 시 비밀번호를 반드시 변경해야 합니다.</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:6px">방법 1: 자동 설정 (권장)</h2>
<p>아래 스크립트가 <b>VS Code 설치 - Cline 확장 설치 - API 설정 - 연결 테스트</b>까지 한번에 처리합니다.</p>

<p><b>Step 1.</b> 설정 스크립트 다운로드</p>
${codeBox('Invoke-WebRequest -Uri "' + scriptUrl + '" -OutFile setup-student.ps1')}
<p style="color:#6b7280;font-size:0.85em">또는 <a href="${scriptUrl}" style="color:#1a56db">이 링크</a>를 우클릭 - "다른 이름으로 링크 저장"</p>

<p><b>Step 2.</b> PowerShell을 <b style="color:#dc2626">관리자 모드</b>로 열고 실행</p>
${codeBox('Set-ExecutionPolicy Bypass -Scope Process -Force<br>.\\setup-student.ps1 -StudentId ' + studentId + ' -ApiKey "' + apiKey + '"')}

<p><b>자동 설정이 하는 일:</b></p>
<ul style="line-height:1.8">
  <li>VS Code가 없으면 자동 설치</li>
  <li>Cline 확장(saoudrizwan.claude-dev) 자동 설치</li>
  <li>Cline에 API Base URL, Key, 기본 모델 자동 구성</li>
  <li>3개 모델 설정 파일 생성</li>
  <li>API 연결 테스트</li>
</ul>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:6px">방법 2: 수동 설정</h2>
<p>자동 설정이 안 될 경우 아래 순서로 직접 설정하세요.</p>

<h3>1. VS Code 설치</h3>
<p><a href="https://code.visualstudio.com/download" style="color:#1a56db">https://code.visualstudio.com/download</a> 에서 Windows 64bit 버전 다운로드 후 설치</p>

<h3>2. Cline 확장 설치</h3>
<ol style="line-height:1.8">
  <li>VS Code 실행 - 확장(Extensions) - ${code('Cline')} 검색 - 설치</li>
</ol>

<h3>3. Cline API 설정</h3>
<ol style="line-height:1.8">
  <li>Cline 사이드바 - 설정</li>
  <li>API Provider: ${code('OpenAI Compatible')}</li>
  <li>Base URL: ${code(apimUrl + '/openai/v1')}</li>
  <li>API Key: ${code(apiKey)}</li>
  <li>Model ID: ${code('gpt-54-mini')}</li>
</ol>

<h3>4. 테스트</h3>
<p>Cline 채팅창에 <b>"안녕하세요"</b> 입력 - AI 응답이 오면 설정 완료!</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#0891b2;border-bottom:2px solid #0891b2;padding-bottom:6px">사용 가능한 모델</h2>
<p>Cline 설정에서 <b>Model ID</b>만 바꾸면 모델 전환 가능 (API Key는 동일)</p>
<table ${tbl}>
  <tr style="background:#f8fafc"><th>모델</th><th>Base URL</th><th>Model ID</th></tr>
  <tr style="background:#f0fdf4"><td><b>GPT-5.4-mini</b> (기본)</td><td>${code(apimUrl + '/openai/v1')}</td><td>${code('gpt-54-mini')}</td></tr>
  <tr><td><b>GPT-5.5</b> (고품질)</td><td>${code(apimUrl + '/openai/v1')}</td><td>${code('gpt-55')}</td></tr>
  <tr style="background:#f0f7ff"><td><b>DeepSeek V4</b></td><td>${code(apimUrl + '/deepseek/v1')}</td><td>${code('deepseek-v4-flash')}</td></tr>
</table>
<p style="color:#6b7280;font-size:0.85em">GPT와 DeepSeek는 <b>Base URL이 다릅니다</b> (/openai vs /deepseek)</p>

<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;margin-top:20px">
  <b>문제가 있나요?</b><br/>
  강사에게 문의하거나 온보딩 페이지에서 취소/재신청할 수 있습니다.
</div>

</div></div>`;

  return { subject, html };
}

module.exports = { generate };

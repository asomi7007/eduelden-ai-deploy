// Power BI MCP Workshop email template
const { code, codeBox, stepCircle } = require('./helpers');

function generate({ studentId, apiKey, apimUrl, azAccount, azPassword }) {
  const scriptUrl = 'https://raw.githubusercontent.com/asomi7007/eduelden-ai-deploy/main/events/powerbi-mcp-20260530/setup-powerbi-mcp.ps1';
  const pbixUrl = 'https://github.com/asomi7007/eduelden-ai-deploy/raw/main/events/powerbi-mcp-20260530/files/%EC%8B%A4%EC%8A%B5%ED%8C%8C%EC%9D%BC.pbix';

  const subject = `[Power BI Workshop] ${studentId}번 환경 설정 안내`;

  const html = `<div style="font-family:'Segoe UI',Pretendard,sans-serif;max-width:680px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(135deg,#F2C811,#E8A500);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
  <h1 style="color:#1a1a1a;margin:0;font-size:22px">AI-Driven Power BI Workshop</h1>
  <p style="color:#333;margin:8px 0 0;font-size:14px">MCP로 쉽게 만드는 대시보드 | 2026년 5월 30일 (토)</p>
</div>
<div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">

<p>안녕하세요, <b>${studentId}번</b> 학생! 워크샵 참가 신청이 완료되었습니다.</p>
<p style="color:#555;font-size:14px">아래 안내에 따라 <b>실습 전까지</b> 환경 설정을 완료해 주세요.</p>

<div style="background:#FEF2F2;border:1px solid #EF4444;border-radius:8px;padding:12px 16px;margin:16px 0">
  <b style="color:#DC2626">Windows 전용</b>
  <p style="color:#7F1D1D;font-size:13px;margin:6px 0 0">Power BI Desktop은 Windows 전용입니다. macOS/Linux 불가. Windows 10/11(64bit) 노트북을 준비하세요.</p>
</div>

<h2 style="color:#B8860B;border-bottom:2px solid #F2C811;padding-bottom:6px">왜 이걸 설치하나요?</h2>
<p style="font-size:13px;color:#555">AI(LLM)가 MCP를 통해 Power BI를 직접 제어하는 실습입니다.</p>
<ul style="font-size:13px;color:#555;margin:8px 0 16px;padding-left:20px;line-height:1.8">
  <li><b>VS Code + Cline</b> : AI 에이전트가 LLM을 호출하고 MCP로 도구를 제어</li>
  <li><b>Power BI Desktop</b> : AI가 제어할 대상 (.pbix 데이터 모델/DAX/시각화)</li>
  <li><b>Node.js 22+</b> : MCP 서버 실행 런타임</li>
  <li><b>MCP 서버 3종</b> : Power BI 제어, 브라우저 자동화, 파일 접근</li>
</ul>

<h2 style="color:#B8860B;border-bottom:2px solid #F2C811;padding-bottom:6px">내 정보</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <tr style="background:#FFF8E1"><td style="padding:8px 12px;border:1px solid #e5e7eb;width:130px;font-weight:600">학생 번호</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${studentId}번</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">Azure 계정</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${code(azAccount)}</td></tr>
  <tr style="background:#FFF8E1"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">초기 비밀번호</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${code(azPassword)}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">API Base URL</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${code(apimUrl + '/openai/v1')}</td></tr>
  <tr style="background:#FFF8E1"><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">API Key</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:13px;word-break:break-all">${apiKey}</td></tr>
</table>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:6px">방법 1: 자동 설치 (권장, 약 5분)</h2>
<p style="font-size:14px;color:#555">아래 과정을 따르면 필요한 소프트웨어가 <b>모두 자동 설치</b>됩니다.</p>

<table style="width:100%;border-collapse:collapse;margin:12px 0">
  <tr><td style="padding:10px 0;vertical-align:top;width:38px">${stepCircle('1','#F2C811')}</td>
  <td style="padding:10px 0 10px 10px">
    <b>PowerShell을 <span style="color:#dc2626">관리자 모드</span>로 실행</b><br/>
    <span style="font-size:13px;color:#555">시작 메뉴 > "PowerShell" 검색 > 관리자 권한으로 실행</span>
  </td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('2','#F2C811')}</td>
  <td style="padding:10px 0 10px 10px">
    <b>Downloads 폴더로 이동</b>
    ${codeBox('cd ~\\Downloads')}
  </td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('3','#F2C811')}</td>
  <td style="padding:10px 0 10px 10px">
    <b>스크립트 다운로드</b>
    ${codeBox('Invoke-WebRequest -Uri "' + scriptUrl + '" -OutFile setup-powerbi-mcp.ps1')}
    <p style="color:#6b7280;font-size:0.85em;margin:4px 0 0">또는 <a href="${scriptUrl}" style="color:#1a56db;font-weight:600">이 링크</a>를 우클릭 > Downloads 폴더에 저장</p>
  </td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('4','#F2C811')}</td>
  <td style="padding:10px 0 10px 10px">
    <b>실행 정책 허용 (최초 1회)</b>
    ${codeBox('Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned')}
    <span style="font-size:12px;color:#888">"Y" 입력 후 Enter</span>
  </td></tr>
  <tr><td style="padding:10px 0;vertical-align:top">${stepCircle('5','#F2C811')}</td>
  <td style="padding:10px 0 10px 10px">
    <b>설치 스크립트 실행</b>
    ${codeBox('.\\setup-powerbi-mcp.ps1 -StudentId "' + studentId + '" -ApiKey "' + apiKey + '"')}
    <span style="font-size:12px;color:#888">약 3~5분 소요. "Setup Complete!" 메시지가 나오면 완료!</span>
  </td></tr>
</table>

<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0">
  <tr><td colspan="2" style="background:#FFF8E1;padding:10px 14px;font-weight:600;font-size:13px;border-bottom:1px solid #e5e7eb">자동 설치되는 항목 (7개)</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600;width:130px">VS Code</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">코드 에디터 + AI 에이전트</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600">Cline 확장</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">AI 에이전트 (MCP 구동)</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600">Node.js 22+</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">MCP 서버 실행 런타임</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600">Power BI Desktop</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">대시보드 제작 도구</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600">MCP: Power BI</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">powerbi-modeling-mcp (MS)</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:600">MCP: Playwright</td><td style="padding:6px 14px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#555">playwright/mcp</td></tr>
  <tr><td style="padding:6px 14px;font-size:13px;font-weight:600">MCP: Filesystem</td><td style="padding:6px 14px;font-size:13px;color:#555">server-filesystem</td></tr>
</table>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:6px">방법 2: 수동 설치</h2>
<p style="font-size:14px;color:#555">자동 설치가 안 될 경우 아래 순서로 직접 설정하세요.</p>

<table style="width:100%;font-size:13px;color:#555;line-height:1.9">
  <tr><td style="padding:4px 0">1. <a href="https://code.visualstudio.com/download" style="color:#1a56db;font-weight:600">VS Code 다운로드</a> - Windows 64bit 설치</td></tr>
  <tr><td style="padding:4px 0">2. VS Code - Extensions (Ctrl+Shift+X) - "Cline" 검색 - Install</td></tr>
  <tr><td style="padding:4px 0">3. <a href="https://nodejs.org/en/download" style="color:#1a56db;font-weight:600">Node.js 22 LTS 다운로드</a> - 설치 (${code('node -v')}로 확인)</td></tr>
  <tr><td style="padding:4px 0">4. <a href="https://aka.ms/pbidesktopstore" style="color:#1a56db;font-weight:600">Power BI Desktop</a> - Microsoft Store에서 설치</td></tr>
  <tr><td style="padding:4px 0">5. Cline 사이드바 - 설정 - API Provider: ${code('OpenAI Compatible')}</td></tr>
  <tr><td style="padding:4px 0">&nbsp;&nbsp;&nbsp;Base URL: ${code(apimUrl + '/openai/v1')}</td></tr>
  <tr><td style="padding:4px 0">&nbsp;&nbsp;&nbsp;API Key: 위에 안내된 키 입력</td></tr>
  <tr><td style="padding:4px 0">&nbsp;&nbsp;&nbsp;Model ID: ${code('gpt-54-mini')}</td></tr>
  <tr><td style="padding:4px 0">6. Cline - MCP Servers - 아래 3개 추가:</td></tr>
  <tr><td style="padding:2px 0 2px 20px">${code('powerbi')}: npx -y @microsoft/powerbi-modeling-mcp --start --readwrite</td></tr>
  <tr><td style="padding:2px 0 2px 20px">${code('playwright')}: npx -y @playwright/mcp</td></tr>
  <tr><td style="padding:2px 0 2px 20px">${code('filesystem')}: npx -y @modelcontextprotocol/server-filesystem [Desktop]</td></tr>
</table>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#B8860B;border-bottom:2px solid #F2C811;padding-bottom:6px">실습 파일 다운로드</h2>
<p style="font-size:14px;color:#555">자동 설치 시 바탕화면에 자동 다운로드됩니다. 수동 설치 시 아래에서 받으세요.</p>
<p><a href="${pbixUrl}" style="display:inline-block;background:transparent;color:#1a1a1a;padding:8px 20px;border:2px solid #F2C811;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px">실습파일.pbix 다운로드</a></p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#B8860B;border-bottom:2px solid #F2C811;padding-bottom:6px">당일 준비물 체크리스트</h2>
<table style="font-size:14px;color:#555">
  <tr><td style="padding:4px 0">- 노트북 (Windows 10/11, 64bit)</td></tr>
  <tr><td style="padding:4px 0">- VS Code + Cline 확장 설치 완료</td></tr>
  <tr><td style="padding:4px 0">- Node.js 22+ 설치 완료</td></tr>
  <tr><td style="padding:4px 0">- Power BI Desktop 설치 완료</td></tr>
  <tr><td style="padding:4px 0">- 실습파일.pbix 바탕화면에 다운로드</td></tr>
  <tr><td style="padding:4px 0">- 인터넷 연결 가능</td></tr>
</table>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<h2 style="color:#555;border-bottom:2px solid #e5e7eb;padding-bottom:6px">문제 해결</h2>
<table style="width:100%;font-size:13px;color:#555">
  <tr><td style="padding:8px 12px;background:#FEF3C7;border-left:3px solid #D97706;border-radius:4px;margin-bottom:6px"><b>스크립트 실행이 차단됨</b><br>${code('Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned')} 실행 후 재시도</td></tr>
  <tr><td style="padding:4px"></td></tr>
  <tr><td style="padding:8px 12px;background:#FEF3C7;border-left:3px solid #D97706;border-radius:4px"><b>Power BI Desktop 설치 실패</b><br>Microsoft Store에서 직접 "Power BI Desktop" 검색하여 설치</td></tr>
  <tr><td style="padding:4px"></td></tr>
  <tr><td style="padding:8px 12px;background:#FEF3C7;border-left:3px solid #D97706;border-radius:4px"><b>Node.js 버전이 22 미만</b><br>기존 버전 삭제 후: ${code('winget install OpenJS.NodeJS.LTS')}</td></tr>
  <tr><td style="padding:4px"></td></tr>
  <tr><td style="padding:8px 12px;background:#FEF3C7;border-left:3px solid #D97706;border-radius:4px"><b>MCP 서버가 Cline에서 안 보임</b><br>VS Code를 완전히 종료 후 다시 열어주세요</td></tr>
  <tr><td style="padding:4px"></td></tr>
  <tr><td style="padding:8px 12px;background:#FEF3C7;border-left:3px solid #D97706;border-radius:4px"><b>API 연결 실패</b><br>당일 현장에서 도움 드립니다</td></tr>
</table>

<p style="font-size:13px;color:#888;margin:24px 0 0;text-align:center">
  설치 문의: <a href="mailto:admin@eldensoluton.kr" style="color:#1a56db">admin@eldensoluton.kr</a><br>
  설치가 어려우시면 당일 행사장에서 도움을 드리겠습니다.
</p>

<div style="background:#FFF8E1;border:1px solid #F2C811;border-radius:8px;padding:12px;margin-top:20px;text-align:center">
  <b>AI-Driven Power BI Workshop</b> | 2026-05-30 (토) | Eduelden AI Lab
</div>

</div></div>`;

  return { subject, html };
}

module.exports = { generate };

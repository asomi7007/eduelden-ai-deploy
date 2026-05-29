'use strict';
// Power BI MCP Workshop — 실습 프롬프트 안내 이메일 템플릿 (API 내장본)
// 원본: emails/practice-prompts.js — 두 곳을 함께 수정하세요.

const code = (t) =>
  `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:Consolas,monospace;font-size:13px">${t}</code>`;

// 진행자 가이드 v3 Part 2 의 실습 프롬프트 (원문 그대로)
const PROMPTS = [
  {
    no: 0,
    title: '테이블 목록 확인',
    mcp: ['Power BI MCP'],
    prompt: '연결된 Power BI Desktop의 테이블 목록을 확인해 줘.',
    desc: 'Power BI MCP가 Desktop에 연결되어 테이블 스키마를 조회합니다. 팩트/디멘전 테이블 목록과 각 컬럼 정보를 출력하며, 데이터 모델의 전체 구조를 파악하는 첫 단계입니다.',
  },
  {
    no: 1,
    title: '스타 스키마(Star Schema) 변환',
    mcp: ['Power BI MCP'],
    prompt: '이 데이터를 스타 스키마(Star Schema) 구조로 변환해 줘. 실제 테이블명을 기준으로 팩트 테이블과 디멘전 테이블을 분리해.',
    desc: '기존 테이블을 팩트(Fact, 숫자)와 디멘전(Dimension, 속성)으로 분류하고, 테이블 간 관계(Relationship)를 자동 생성합니다. 불필요한 컬럼 정리 및 키 컬럼을 설정합니다.',
  },
  {
    no: 2,
    title: 'Power BI 테마 JSON 생성',
    mcp: ['Playwright MCP', 'Filesystem MCP', 'Power BI MCP'],
    prompt: '이 사이트를 Playwright MCP로 참고해서 Power BI 테마 JSON 파일을 만들어 줘.\nhttps://app.powerbi.com/view?r=eyJrIjoiMWJlZDE4NzMtNjBlZi00OGY5LTk4ZDYtZjYzMGMyN2IzYTkxIiwidCI6Ijc0MzBjOGJlLWQ1ZTMtNDgxYi1hNTcwLTZjOGI0MzRkZGY4OCIsImMiOjZ9&pageName=ReportSection2e5116d592f50302d0cc',
    desc: 'Playwright MCP가 참조 대시보드 사이트를 자동 방문해 색상 팔레트·폰트·시각적 스타일을 분석하고, Filesystem MCP로 Power BI 테마 JSON 파일을 저장합니다. (3개 MCP 협업)',
    note: 'URL이 길므로 위 주소 전체를 복사해서 프롬프트에 붙여넣으세요.',
  },
  {
    no: 3,
    title: 'KPI 측정값(DAX Measure) 생성',
    mcp: ['Power BI MCP'],
    prompt: '임원용 매출 KPI 대시보드에 필요한 시계열 분석 측정값(DAX Measure)을 만들어 줘.',
    desc: '매출 합계, 전월 대비, 전년 동기 대비 등 시계열 DAX와 YTD(연초누적)·MTD(월초누적)·QTD(분기누적) 측정값, KPI 달성률·성장률 등 임원 의사결정 지표를 생성합니다.',
    note: 'CALCULATE, SAMEPERIODLASTYEAR 등 핵심 DAX 함수가 사용됩니다. 생성된 DAX를 Power BI에서 직접 확인해 보세요.',
  },
  {
    no: 4,
    title: '측정값 폴더 분류',
    mcp: ['Power BI MCP'],
    prompt: '만든 측정값들을 논리적으로 Display Folder로 분류해 줘.',
    desc: '매출 기본·시계열 비교·KPI·비율 등 카테고리별 폴더를 생성하고 각 측정값을 해당 폴더에 자동 배치합니다. Power BI 필드 패널에서 깔끔하게 정리된 구조를 확인할 수 있습니다.',
  },
  {
    no: 5,
    title: '대시보드 단계별 가이드 생성',
    mcp: ['Filesystem MCP'],
    prompt: '이 측정값들로 임원용 대시보드를 만들 건데, 레이아웃·폰트·시각적 개체 크기까지 포함한 단계별 가이드를 마크다운 파일로 만들어 줘.',
    desc: '페이지 레이아웃(캔버스 크기·그리드 배치)을 설계하고, 시각적 개체별 위치·크기·폰트·색상을 명세한 단계별 가이드를 마크다운 파일로 저장합니다. 가이드를 따라 직접 시각화를 배치해 보세요.',
  },
];

const MCP_COLOR = {
  'Power BI MCP': '#F2C811',
  'Playwright MCP': '#2EAD33',
  'Filesystem MCP': '#6366F1',
};

function mcpBadge(name) {
  const bg = MCP_COLOR[name] || '#94a3b8';
  return `<span style="display:inline-block;background:${bg};color:#1a1a1a;font-size:11px;font-weight:700;padding:3px 9px;border-radius:12px;margin:2px 4px 2px 0">${name}</span>`;
}

function promptCard(p) {
  const badges = p.mcp.map(mcpBadge).join('');
  const promptHtml = p.prompt
    .split('\n')
    .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('<br/>');

  const noteHtml = p.note
    ? `<div style="background:#FFF8E1;border-left:3px solid #F2C811;border-radius:4px;padding:8px 12px;margin-top:10px;font-size:12px;color:#7c5a00"><b>TIP</b> &nbsp;${p.note}</div>`
    : '';

  return `
<div style="border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin:16px 0;background:#fff">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="vertical-align:top;width:44px">
        <div style="width:36px;height:36px;background:#1a1a1a;color:#F2C811;border-radius:50%;text-align:center;line-height:36px;font-weight:800;font-size:16px">${p.no}</div>
      </td>
      <td style="vertical-align:top;padding-left:6px">
        <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:6px">${p.title}</div>
        <div style="margin-bottom:10px">${badges}</div>
      </td>
    </tr>
  </table>

  <div style="font-size:12px;color:#94a3b8;font-weight:600;margin:6px 0 4px">Cline에 입력 ↓</div>
  <div style="background:#1e293b;border-radius:8px;padding:14px 16px;margin-bottom:12px">
    <code style="color:#e2e8f0;font-family:'Cascadia Code',Consolas,monospace;font-size:14px;line-height:1.7;white-space:pre-wrap">${promptHtml}</code>
  </div>

  <div style="font-size:13px;color:#555;line-height:1.6">${p.desc}</div>
  ${noteHtml}
</div>`;
}

function generate({ studentId, apimUrl }) {
  const baseUrl = (apimUrl || 'https://apim-eduelden-ai.azure-api.net') + '/openai/v1';
  const greeting = studentId
    ? `안녕하세요, <b>${studentId}번</b> 참가자님!`
    : '안녕하세요, 참가자님!';

  const subject = '[Power BI Workshop] 실습 프롬프트 6종 안내 (당일 사용)';

  const cards = PROMPTS.map(promptCard).join('');

  const html = `<div style="font-family:'Segoe UI',Pretendard,sans-serif;max-width:680px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(135deg,#F2C811,#E8A500);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
  <h1 style="color:#1a1a1a;margin:0;font-size:22px">AI-Driven Power BI Workshop</h1>
  <p style="color:#333;margin:8px 0 0;font-size:14px">실습 프롬프트 안내 | 2026년 5월 30일 (토)</p>
</div>
<div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">

<p>${greeting}</p>
<p style="color:#555;font-size:14px">실습 당일 Cline에 입력할 <b>프롬프트 6종</b>을 미리 안내드립니다. 아래 순서대로(0 → 5) 입력하면 AI가 MCP를 통해 Power BI 대시보드를 단계별로 구성합니다.</p>

<div style="background:#FEF2F2;border:1px solid #EF4444;border-radius:8px;padding:12px 16px;margin:16px 0">
  <b style="color:#DC2626">실습 전 확인</b>
  <p style="color:#7F1D1D;font-size:13px;margin:6px 0 0">Power BI Desktop에서 <b>실습파일.pbix</b>가 열려 있어야 하고, Cline에 API 설정(Base URL ${code(baseUrl)}, Model ${code('gpt-54-mini')})이 완료되어 있어야 합니다. Cline은 반드시 <b>Downloads 폴더</b>에서 시작하세요.</p>
</div>

<h2 style="color:#B8860B;border-bottom:2px solid #F2C811;padding-bottom:6px;font-size:18px">실습 프롬프트 (순서대로 입력)</h2>

${cards}

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>

<div style="background:#FFF8E1;border:1px solid #F2C811;border-radius:8px;padding:14px 16px;font-size:13px;color:#7c5a00;line-height:1.6">
  <b>활용 팁</b><br/>
  · 각 단계가 끝나면 Power BI Desktop에서 결과를 직접 확인하세요.<br/>
  · AI가 제안한 구조/DAX/분류 기준은 그대로 두지 말고 의미를 이해하며 따라가 보세요.<br/>
  · 막히면 당일 현장에서 도움을 드립니다.
</div>

<p style="font-size:13px;color:#888;margin:24px 0 0;text-align:center">
  문의: <a href="mailto:admin@eldensoluton.kr" style="color:#1a56db">admin@eldensoluton.kr</a> | 강사: 허석
</p>

<div style="background:#1a1a1a;border-radius:8px;padding:12px;margin-top:20px;text-align:center">
  <b style="color:#F2C811">AI-Driven Power BI Workshop</b> <span style="color:#cbd5e1">| 2026-05-30 (토) | Eduelden AI Lab</span>
</div>

</div></div>`;

  return { subject, html };
}

module.exports = { generate, PROMPTS };

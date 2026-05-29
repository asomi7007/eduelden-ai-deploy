const { app } = require('@azure/functions');
const { sendEmail } = require('../lib/acs-email');
const template = require('../lib/practice-prompts-template');

const APIM_URL = 'https://apim-eduelden-ai.azure-api.net';

// 활성(onboarding 'done') 학생 목록 조회 — manage.js 와 동일한 파싱 규칙
async function getActiveStudents(repo, pat) {
  const ghHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${pat}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'eduelden-prompt-mailer',
  };

  const [openResp, closedResp] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`, { headers: ghHeaders }),
    fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`, { headers: ghHeaders }),
  ]);

  const allIssues = [...(await openResp.json()), ...(await closedResp.json())].filter((i) => !i.pull_request);

  const byStudent = new Map();
  for (const iss of allIssues) {
    const m = (iss.title || '').match(/학생\s*(\d{2})번/);
    if (!m) continue;
    const studentId = m[1];
    const labels = iss.labels.map((l) => l.name);
    let status = 'pending';
    if (labels.includes('done')) status = 'done';
    else if (labels.includes('rejected')) status = 'rejected';
    else if (iss.state === 'closed') status = 'closed';

    const emailMatch = (iss.body || '').match(/EMAIL:\s*([\w.+\-]+@[\w.\-]+\.\w+)/);
    const email = emailMatch ? emailMatch[1].trim() : null;

    const prev = byStudent.get(studentId);
    if (!prev || iss.number > prev.issueNumber) {
      byStudent.set(studentId, { studentId, email, status, issueNumber: iss.number });
    }
  }

  return [...byStudent.values()].filter((s) => s.status === 'done' && s.email);
}

// POST /api/send-prompts — 선택한 학생에게 실습 프롬프트 안내 메일을 ACS로 직접 발송
// body: { adminPw, studentIds: ["22","49"] }
app.http('send-prompts', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'send-prompts',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      };
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
    const adminPassword = process.env.ADMIN_PASSWORD;
    const repo = process.env.GITHUB_REPO;
    const pat = process.env.GITHUB_PAT;

    try {
      const body = await request.json();

      if (!body.adminPw || body.adminPw !== adminPassword) {
        return { status: 403, jsonBody: { error: '관리자 비밀번호가 틀렸습니다.' }, headers: corsHeaders };
      }

      const studentIds = Array.isArray(body.studentIds)
        ? body.studentIds.map((s) => String(s).trim().padStart(2, '0')).filter((s) => /^\d{2}$/.test(s))
        : [];

      if (studentIds.length === 0) {
        return { status: 400, jsonBody: { error: '발송할 학생을 1명 이상 선택해주세요.' }, headers: corsHeaders };
      }

      // 활성 학생 조회 후 선택 교집합
      const active = await getActiveStudents(repo, pat);
      const activeMap = new Map(active.map((s) => [s.studentId, s]));
      const targets = studentIds.map((id) => activeMap.get(id)).filter(Boolean);

      if (targets.length === 0) {
        return { status: 400, jsonBody: { error: '선택한 학생 중 활성(온보딩 완료) 상태가 없습니다.' }, headers: corsHeaders };
      }

      // ACS 직접 발송
      const sent = [];
      const failed = [];
      for (const s of targets) {
        const { subject, html } = template.generate({ studentId: s.studentId, apimUrl: APIM_URL });
        try {
          const r = await sendEmail(s.email, subject, html);
          if (r.status === 202) sent.push({ studentId: s.studentId, email: s.email });
          else failed.push({ studentId: s.studentId, email: s.email, error: `HTTP ${r.status}` });
        } catch (e) {
          failed.push({ studentId: s.studentId, email: s.email, error: e.message });
        }
      }

      const skipped = studentIds.filter((id) => !activeMap.has(id));

      return {
        status: failed.length === 0 ? 200 : 207,
        jsonBody: {
          message: `발송 완료: 성공 ${sent.length} / 실패 ${failed.length}` + (skipped.length ? ` / 비활성 제외 ${skipped.length}` : ''),
          sent,
          failed,
          skipped,
        },
        headers: corsHeaders,
      };
    } catch (e) {
      context.error('send-prompts error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  },
});

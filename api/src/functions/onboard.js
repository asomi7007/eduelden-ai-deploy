const { app } = require('@azure/functions');

const MAX_STUDENTS = 50;
const MAX_ASSIGN_ATTEMPTS = 5;
const TITLE_RE = /학생\s*(\d{2})번/;
const EMAIL_RE = /EMAIL:\s*([\w.+\-]+@[\w.\-]+\.\w+)/;

function ghFetchHeaders(pat) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${pat}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'eduelden-onboarding'
  };
}

// open + closed 온보딩 이슈 전체 조회 (페이지네이션)
async function listOnboardingIssues(repo, headers) {
  const all = [];
  for (const state of ['open', 'closed']) {
    for (let page = 1; page <= 5; page++) {
      const resp = await fetch(
        `https://api.github.com/repos/${repo}/issues?labels=onboarding&state=${state}&per_page=100&page=${page}`,
        { headers }
      );
      if (!resp.ok) throw new Error(`GitHub Issues 조회 실패 (HTTP ${resp.status})`);
      const items = await resp.json();
      all.push(...items.filter(i => !i.pull_request));
      if (items.length < 100) break;
    }
  }
  return all;
}

// 거부/취소(rejected)되지 않은 활성 신청만 반환
function activeEntries(issues) {
  const entries = [];
  for (const iss of issues) {
    const m = (iss.title || '').match(TITLE_RE);
    if (!m) continue;
    if (iss.labels.some(l => l.name === 'rejected')) continue;
    const e = (iss.body || '').match(EMAIL_RE);
    entries.push({
      number: iss.number,
      studentId: m[1],
      email: e ? e[1].toLowerCase() : null
    });
  }
  return entries;
}

function pickSmallestFreeId(entries) {
  const used = new Set(entries.map(e => e.studentId));
  for (let n = 1; n <= MAX_STUDENTS; n++) {
    const id = String(n).padStart(2, '0');
    if (!used.has(id)) return id;
  }
  return null;
}

async function rejectIssue(repo, headers, number, comment) {
  await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ state: 'closed', labels: ['onboarding', 'rejected'] })
  });
  await fetch(`https://api.github.com/repos/${repo}/issues/${number}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: comment })
  });
}

// POST /api/onboard — 온보딩 신청 (패스코드 검증, 학생 번호 자동 할당)
app.http('onboard', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'onboard',
  handler: async (request, context) => {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
    const repo = process.env.GITHUB_REPO;
    const pat = process.env.GITHUB_PAT;
    const classPasscode = process.env.CLASS_PASSCODE;

    try {
      const body = await request.json();
      const { passcode, studentId: requestedId, email, event } = body;

      // Validate passcode
      if (!passcode || passcode !== classPasscode) {
        return { status: 403, jsonBody: { error: '패스코드가 올바르지 않습니다.' }, headers: corsHeaders };
      }

      // Validate email
      if (!email || !/^[\w.+\-]+@[\w.\-]+\.\w+$/.test(email)) {
        return { status: 400, jsonBody: { error: '유효한 이메일 주소를 입력해주세요.' }, headers: corsHeaders };
      }
      const emailKey = email.trim().toLowerCase();

      // studentId는 선택값: 없으면 자동 할당, 있으면(구 클라이언트) 해당 번호를 요청
      const explicitId = requestedId ? String(requestedId) : null;
      if (explicitId) {
        if (!/^\d{2}$/.test(explicitId)) {
          return { status: 400, jsonBody: { error: '학생 번호(01~50)를 확인해주세요.' }, headers: corsHeaders };
        }
        const n = parseInt(explicitId, 10);
        if (n < 1 || n > MAX_STUDENTS) {
          return { status: 400, jsonBody: { error: '학생 번호는 01~50 사이여야 합니다.' }, headers: corsHeaders };
        }
      }

      const ghHeaders = ghFetchHeaders(pat);

      for (let attempt = 0; attempt < MAX_ASSIGN_ATTEMPTS; attempt++) {
        const active = activeEntries(await listOnboardingIssues(repo, ghHeaders));

        // 같은 이메일의 활성 신청이 있으면 중복 신청 차단
        const dup = active.find(e => e.email === emailKey);
        if (dup) {
          return {
            status: 409,
            jsonBody: { error: `이미 신청된 이메일입니다. (${dup.studentId}번) 메일함을 확인하거나, 이메일을 잘못 입력했다면 '취소/재신청' 탭을 이용해주세요.` },
            headers: corsHeaders
          };
        }

        let studentId;
        if (explicitId) {
          if (active.some(e => e.studentId === explicitId)) {
            return { status: 409, jsonBody: { error: `${explicitId}번은 이미 사용 중입니다.` }, headers: corsHeaders };
          }
          studentId = explicitId;
        } else {
          studentId = pickSmallestFreeId(active);
          if (!studentId) {
            return { status: 409, jsonBody: { error: `${MAX_STUDENTS}명 모두 신청 완료되었습니다.` }, headers: corsHeaders };
          }
        }

        // Create issue (워크플로우 파싱 형식 유지: PASSCODE/STUDENT_ID/EMAIL/EVENT)
        const eventLine = event ? `\nEVENT: ${event}` : '';
        const issueBody = `PASSCODE: ${passcode}\nSTUDENT_ID: ${studentId}\nEMAIL: ${email}${eventLine}`;
        const createResp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            title: `[온보딩] 학생 ${studentId}번`,
            body: issueBody,
            labels: ['onboarding']
          })
        });

        if (!createResp.ok) {
          const err = await createResp.text();
          context.error('Issue creation failed:', err);
          return { status: 502, jsonBody: { error: 'GitHub Issue 생성 실패' }, headers: corsHeaders };
        }

        const issue = await createResp.json();

        // 동시 신청으로 같은 번호가 겹쳤는지 재확인: 이슈 번호가 가장 작은(먼저 생성된) 쪽만 유지
        let lostRace = false;
        try {
          const sameId = activeEntries(await listOnboardingIssues(repo, ghHeaders))
            .filter(e => e.studentId === studentId);
          const winner = Math.min(...sameId.map(e => e.number));
          if (sameId.length > 1 && issue.number !== winner) {
            lostRace = true;
            await rejectIssue(repo, ghHeaders, issue.number, '⚠️ 동시 신청 감지 — 먼저 접수된 신청이 우선 처리됩니다.');
          }
        } catch (dupErr) {
          context.warn('Duplicate check failed (non-critical):', dupErr.message);
        }

        if (!lostRace) {
          return {
            status: 201,
            jsonBody: {
              message: '온보딩 신청 완료',
              studentId,
              email,
              issueNumber: issue.number
            },
            headers: corsHeaders
          };
        }

        if (explicitId) {
          return {
            status: 409,
            jsonBody: { error: `${studentId}번이 동시에 신청되어 먼저 접수된 건이 처리됩니다. 다른 번호를 선택해주세요.` },
            headers: corsHeaders
          };
        }
        // 자동 할당이면 다음 빈 번호로 재시도
      }

      return {
        status: 503,
        jsonBody: { error: '신청이 몰려 번호 배정에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        headers: corsHeaders
      };

    } catch (e) {
      context.error('onboard error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  }
});

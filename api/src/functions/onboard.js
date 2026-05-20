const { app } = require('@azure/functions');

// POST /api/onboard — 온보딩 신청 (패스코드 검증)
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
      const { passcode, studentId, email } = body;

      // Validate passcode
      if (!passcode || passcode !== classPasscode) {
        return { status: 403, jsonBody: { error: '패스코드가 올바르지 않습니다.' }, headers: corsHeaders };
      }

      // Validate student ID
      if (!studentId || !/^\d{2}$/.test(studentId)) {
        return { status: 400, jsonBody: { error: '학생 번호(01~50)를 확인해주세요.' }, headers: corsHeaders };
      }
      const num = parseInt(studentId);
      if (num < 1 || num > 50) {
        return { status: 400, jsonBody: { error: '학생 번호는 01~50 사이여야 합니다.' }, headers: corsHeaders };
      }

      // Validate email
      if (!email || !/^[\w.+\-]+@[\w.\-]+\.\w+$/.test(email)) {
        return { status: 400, jsonBody: { error: '유효한 이메일 주소를 입력해주세요.' }, headers: corsHeaders };
      }

      const ghHeaders = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'eduelden-onboarding'
      };

      // Check if slot is already taken
      const [openResp, closedResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`, { headers: ghHeaders }),
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`, { headers: ghHeaders })
      ]);
      const allIssues = [...await openResp.json(), ...await closedResp.json()].filter(i => !i.pull_request);

      const taken = allIssues.find(iss => {
        const m = iss.title.match(/학생\s*(\d{2})번/);
        if (!m || m[1] !== studentId) return false;
        const labels = iss.labels.map(l => l.name);
        return !labels.includes('rejected');
      });

      if (taken) {
        return { status: 409, jsonBody: { error: `${studentId}번은 이미 사용 중입니다.` }, headers: corsHeaders };
      }

      // Count active slots
      const activeCount = allIssues.filter(iss => {
        const m = iss.title.match(/학생\s*(\d{2})번/);
        if (!m) return false;
        const labels = iss.labels.map(l => l.name);
        return !labels.includes('rejected');
      }).length;

      // Use Set to count unique student IDs
      const uniqueIds = new Set();
      allIssues.forEach(iss => {
        const m = iss.title.match(/학생\s*(\d{2})번/);
        if (!m) return;
        const labels = iss.labels.map(l => l.name);
        if (!labels.includes('rejected')) uniqueIds.add(m[1]);
      });

      if (uniqueIds.size >= 50) {
        return { status: 409, jsonBody: { error: '50명 모두 신청 완료되었습니다.' }, headers: corsHeaders };
      }

      // Create issue
      const issueBody = `PASSCODE: ${passcode}\nSTUDENT_ID: ${studentId}\nEMAIL: ${email}`;
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

      // ── 중복 방지: 이슈 생성 직후 같은 번호의 다른 이슈가 있는지 재확인 ──
      // 두 명이 동시에 같은 번호를 선택하면 둘 다 이슈가 생기는데,
      // 이슈 번호가 더 큰(나중에 만들어진) 쪽을 자동으로 닫는다.
      try {
        const recheckResp = await fetch(
          `https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`,
          { headers: ghHeaders }
        );
        const openIssues = await recheckResp.json();
        const duplicates = openIssues.filter(iss => {
          const m = iss.title.match(/학생\s*(\d{2})번/);
          return m && m[1] === studentId && !iss.labels.some(l => l.name === 'rejected');
        });

        if (duplicates.length > 1) {
          // 이슈 번호가 가장 작은(먼저 생성된) 것만 살리고, 나머지 닫기
          duplicates.sort((a, b) => a.number - b.number);
          const keepIssue = duplicates[0];

          if (issue.number !== keepIssue.number) {
            // 내가 만든 이슈가 나중 것이면 → 닫고 에러 반환
            await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}`, {
              method: 'PATCH',
              headers: ghHeaders,
              body: JSON.stringify({ state: 'closed', labels: ['onboarding', 'rejected'] })
            });
            await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`, {
              method: 'POST',
              headers: ghHeaders,
              body: JSON.stringify({ body: '⚠️ 동시 신청 감지 — 먼저 접수된 신청이 우선 처리됩니다.' })
            });
            return {
              status: 409,
              jsonBody: { error: `${studentId}번이 동시에 신청되어 먼저 접수된 건이 처리됩니다. 다른 번호를 선택해주세요.` },
              headers: corsHeaders
            };
          }

          // 내가 먼저인 경우, 나머지 중복 닫기
          for (let i = 1; i < duplicates.length; i++) {
            await fetch(`https://api.github.com/repos/${repo}/issues/${duplicates[i].number}`, {
              method: 'PATCH',
              headers: ghHeaders,
              body: JSON.stringify({ state: 'closed', labels: ['onboarding', 'rejected'] })
            });
            await fetch(`https://api.github.com/repos/${repo}/issues/${duplicates[i].number}/comments`, {
              method: 'POST',
              headers: ghHeaders,
              body: JSON.stringify({ body: '⚠️ 동시 신청 감지 — 중복 이슈 자동 닫힘.' })
            });
          }
        }
      } catch (dupErr) {
        context.warn('Duplicate check failed (non-critical):', dupErr.message);
      }

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

    } catch (e) {
      context.error('onboard error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  }
});

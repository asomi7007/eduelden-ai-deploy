const { app } = require('@azure/functions');

// POST /api/cancel — 온보딩 취소 (학생 본인 또는 관리자)
app.http('cancel', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'cancel',
  handler: async (request, context) => {
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
    const adminPassword = process.env.ADMIN_PASSWORD;

    try {
      const body = await request.json();
      const { passcode, studentId, isAdmin, adminPw } = body;

      // Auth: either student passcode or admin password
      if (isAdmin) {
        if (!adminPw || adminPw !== adminPassword) {
          return { status: 403, jsonBody: { error: '관리자 비밀번호가 틀렸습니다.' }, headers: corsHeaders };
        }
      } else {
        if (!passcode || passcode !== classPasscode) {
          return { status: 403, jsonBody: { error: '패스코드가 올바르지 않습니다.' }, headers: corsHeaders };
        }
      }

      if (!studentId || !/^\d{2}$/.test(studentId)) {
        return { status: 400, jsonBody: { error: '학생 번호를 확인해주세요.' }, headers: corsHeaders };
      }

      const ghHeaders = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'eduelden-onboarding'
      };

      // Find active issue for this student
      const [openResp, closedResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`, { headers: ghHeaders }),
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`, { headers: ghHeaders })
      ]);
      const allIssues = [...await openResp.json(), ...await closedResp.json()].filter(i => !i.pull_request);

      const issue = allIssues.find(iss => {
        const m = iss.title.match(/학생\s*(\d{2})번/);
        if (!m || m[1] !== studentId) return false;
        const labels = iss.labels.map(l => l.name);
        return !labels.includes('rejected');
      });

      if (!issue) {
        return { status: 404, jsonBody: { error: `${studentId}번에 대한 활성 신청이 없습니다.` }, headers: corsHeaders };
      }

      // Close issue with rejected label
      await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}`, {
        method: 'PATCH',
        headers: ghHeaders,
        body: JSON.stringify({
          state: 'closed',
          labels: ['onboarding', 'rejected']
        })
      });

      // Add comment
      const who = isAdmin ? '관리자가' : '학생이 직접';
      await fetch(`https://api.github.com/repos/${repo}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          body: `↩️ ${who} 취소했습니다.`
        })
      });

      return {
        jsonBody: { message: `${studentId}번 신청이 취소되었습니다.`, issueNumber: issue.number },
        headers: corsHeaders
      };

    } catch (e) {
      context.error('cancel error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  }
});

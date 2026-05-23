const { app } = require('@azure/functions');

// POST /api/reset — 관리자 전체 초기화 (모든 온보딩 이슈 닫기 + rejected)
app.http('reset', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'reset',
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
    const adminPassword = process.env.ADMIN_PASSWORD;
    const repo = process.env.GITHUB_REPO;
    const pat = process.env.GITHUB_PAT;

    try {
      const body = await request.json();
      if (!body.adminPw || body.adminPw !== adminPassword) {
        return { status: 403, jsonBody: { error: '관리자 비밀번호가 틀렸습니다.' }, headers: corsHeaders };
      }

      // Confirm token (이중 확인)
      if (body.confirm !== 'RESET_ALL') {
        return { status: 400, jsonBody: { error: '확인 코드가 올바르지 않습니다. "RESET_ALL"을 전송해주세요.' }, headers: corsHeaders };
      }

      const ghHeaders = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'eduelden-onboarding'
      };

      // Fetch all open onboarding issues
      const openResp = await fetch(
        `https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`,
        { headers: ghHeaders }
      );
      const openData = openResp.ok ? await openResp.json() : [];
      const openIssues = (Array.isArray(openData) ? openData : []).filter(i => !i.pull_request);

      // Also fetch closed non-rejected issues (done/pending that are closed but not rejected)
      const closedResp = await fetch(
        `https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`,
        { headers: ghHeaders }
      );
      const closedData = closedResp.ok ? await closedResp.json() : [];
      const closedIssues = (Array.isArray(closedData) ? closedData : []).filter(i => {
        if (i.pull_request) return false;
        const labels = i.labels.map(l => l.name);
        return !labels.includes('rejected');
      });

      const allToReset = [...openIssues, ...closedIssues];

      // 초기화할 이슈가 없는 경우
      if (allToReset.length === 0) {
        return {
          jsonBody: { message: '초기화할 온보딩 신청이 없습니다.', resetCount: 0 },
          headers: corsHeaders
        };
      }
      let resetCount = 0;
      const errors = [];

      // Close all issues with rejected label + comment
      for (const iss of allToReset) {
        try {
          // Add rejected label and close
          await fetch(`https://api.github.com/repos/${repo}/issues/${iss.number}`, {
            method: 'PATCH',
            headers: ghHeaders,
            body: JSON.stringify({
              state: 'closed',
              labels: ['onboarding', 'rejected']
            })
          });

          // Add reset comment
          await fetch(`https://api.github.com/repos/${repo}/issues/${iss.number}/comments`, {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({
              body: '🔄 관리자가 전체 초기화를 실행했습니다.'
            })
          });

          resetCount++;
        } catch (issErr) {
          errors.push({ issue: iss.number, error: issErr.message });
        }
      }

      return {
        jsonBody: {
          message: `전체 초기화 완료: ${resetCount}건 처리됨`,
          resetCount,
          errors: errors.length > 0 ? errors : undefined
        },
        headers: corsHeaders
      };

    } catch (e) {
      context.error('reset error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  }
});

const { app } = require('@azure/functions');

// GET /api/slots — 온보딩 현황 조회 (인증 불필요)
app.http('slots', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'slots',
  handler: async (request, context) => {
    const repo = process.env.GITHUB_REPO;
    const pat = process.env.GITHUB_PAT;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eduelden-onboarding'
    };

    try {
      // Fetch open + closed onboarding issues
      const [openResp, closedResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`, { headers }),
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`, { headers })
      ]);

      if (!openResp.ok || !closedResp.ok) {
        return { status: 502, jsonBody: { error: 'GitHub API 호출 실패' } };
      }

      const openIssues = await openResp.json();
      const closedIssues = await closedResp.json();
      const all = [...openIssues, ...closedIssues].filter(i => !i.pull_request);

      // Build slot map
      const slots = {};
      for (const iss of all) {
        const m = iss.title.match(/학생\s*(\d{2})번/);
        if (!m) continue;
        const sid = m[1];
        const labels = iss.labels.map(l => l.name);
        let status = 'pending';
        if (labels.includes('done')) status = 'done';
        else if (labels.includes('rejected')) status = 'rejected';
        else if (iss.state === 'closed') status = 'closed';

        // Skip rejected
        if (status === 'rejected') continue;

        // Keep latest active entry
        if (!slots[sid] || status === 'done' || iss.state === 'open') {
          const emailMatch = (iss.body || '').match(/EMAIL:\s*([\w.+\-]+@[\w.\-]+\.\w+)/);
          slots[sid] = {
            studentId: sid,
            status,
            email: emailMatch ? emailMatch[1] : null,
            issueNumber: iss.number
          };
        }
      }

      return {
        jsonBody: {
          slots,
          total: Object.keys(slots).length
        },
        headers: { 'Access-Control-Allow-Origin': '*' }
      };
    } catch (e) {
      context.error('slots error:', e);
      return { status: 500, jsonBody: { error: e.message } };
    }
  }
});

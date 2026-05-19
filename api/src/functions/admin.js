const { app } = require('@azure/functions');

// POST /api/admin/list — 관리자 전체 목록 조회
app.http('adminList', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'admin-list',
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

    try {
      const body = await request.json();
      if (!body.adminPw || body.adminPw !== adminPassword) {
        return { status: 403, jsonBody: { error: '관리자 비밀번호가 틀렸습니다.' }, headers: corsHeaders };
      }

      const repo = process.env.GITHUB_REPO;
      const pat = process.env.GITHUB_PAT;
      const ghHeaders = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'eduelden-onboarding'
      };

      const [openResp, closedResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=open&per_page=100`, { headers: ghHeaders }),
        fetch(`https://api.github.com/repos/${repo}/issues?labels=onboarding&state=closed&per_page=100`, { headers: ghHeaders })
      ]);

      const allIssues = [...await openResp.json(), ...await closedResp.json()].filter(i => !i.pull_request);

      const entries = allIssues
        .map(iss => {
          const m = iss.title.match(/학생\s*(\d{2})번/);
          if (!m) return null;
          const labels = iss.labels.map(l => l.name);
          let status = 'pending';
          if (labels.includes('done')) status = 'done';
          else if (labels.includes('rejected')) status = 'rejected';
          else if (iss.state === 'closed') status = 'closed';

          const emailMatch = (iss.body || '').match(/EMAIL:\s*([\w.+\-]+@[\w.\-]+\.\w+)/);
          return {
            studentId: m[1],
            email: emailMatch ? emailMatch[1] : null,
            status,
            issueNumber: iss.number,
            issueUrl: iss.html_url,
            createdAt: iss.created_at
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.studentId.localeCompare(b.studentId));

      const stats = {
        total: entries.length,
        done: entries.filter(e => e.status === 'done').length,
        pending: entries.filter(e => e.status === 'pending').length,
        rejected: entries.filter(e => e.status === 'rejected').length
      };

      return {
        jsonBody: { entries, stats },
        headers: corsHeaders
      };

    } catch (e) {
      context.error('admin list error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  }
});

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

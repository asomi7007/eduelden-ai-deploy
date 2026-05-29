const { app } = require('@azure/functions');

// POST /api/send-prompts — 선택한 학생에게 실습 프롬프트 안내 메일 발송
// body: { adminPw, studentIds: ["22","49"], dryRun?: bool, onlyEmail?: string }
// 동작: GitHub Actions 'send-prompts.yml' 워크플로우를 dispatch (실제 발송은 Actions의 ACS로)
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
    const eventId = process.env.EVENT_ID || 'powerbi-mcp-20260530';

    try {
      const body = await request.json();

      if (!body.adminPw || body.adminPw !== adminPassword) {
        return { status: 403, jsonBody: { error: '관리자 비밀번호가 틀렸습니다.' }, headers: corsHeaders };
      }

      const dryRun = body.dryRun === true;
      const onlyEmail = (body.onlyEmail || '').trim();

      // 학생번호 정규화 (2자리)
      const studentIds = Array.isArray(body.studentIds)
        ? body.studentIds
            .map((s) => String(s).trim().padStart(2, '0'))
            .filter((s) => /^\d{2}$/.test(s))
        : [];

      if (studentIds.length === 0 && !onlyEmail) {
        return { status: 400, jsonBody: { error: '발송할 학생을 1명 이상 선택해주세요.' }, headers: corsHeaders };
      }

      const ghHeaders = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'eduelden-onboarding',
      };

      // 워크플로우 dispatch
      const dispatchResp = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/send-prompts.yml/dispatches`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              dry_run: dryRun ? 'true' : 'false',
              event_id: eventId,
              only_email: onlyEmail,
              student_ids: studentIds.join(','),
            },
          }),
        }
      );

      if (dispatchResp.status !== 204) {
        const err = await dispatchResp.text();
        context.error('workflow dispatch failed:', dispatchResp.status, err);
        const hint =
          dispatchResp.status === 403
            ? ' (GITHUB_PAT에 Actions 쓰기 권한이 필요합니다)'
            : '';
        return {
          status: 502,
          jsonBody: { error: `발송 워크플로우 실행 실패 (HTTP ${dispatchResp.status})${hint}` },
          headers: corsHeaders,
        };
      }

      // 방금 생성된 run 의 URL 을 찾아 반환 (UX: 결과 확인 링크)
      let runUrl = `https://github.com/${repo}/actions/workflows/send-prompts.yml`;
      try {
        await new Promise((r) => setTimeout(r, 2500));
        const runsResp = await fetch(
          `https://api.github.com/repos/${repo}/actions/workflows/send-prompts.yml/runs?event=workflow_dispatch&per_page=1`,
          { headers: ghHeaders }
        );
        const runs = await runsResp.json();
        if (runs.workflow_runs && runs.workflow_runs[0]) {
          runUrl = runs.workflow_runs[0].html_url;
        }
      } catch (e) {
        context.warn('run URL 조회 실패 (non-critical):', e.message);
      }

      return {
        status: 202,
        jsonBody: {
          message: dryRun
            ? '미리보기(DRY RUN) 실행됨'
            : `${studentIds.length || 1}명에게 발송 요청됨`,
          count: studentIds.length,
          dryRun,
          runUrl,
        },
        headers: corsHeaders,
      };
    } catch (e) {
      context.error('send-prompts error:', e);
      return { status: 500, jsonBody: { error: e.message }, headers: corsHeaders };
    }
  },
});

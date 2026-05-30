// 실습 프롬프트 안내 메일 일괄 발송 스크립트
// 활성(onboarding 'done') 학생 = API 키를 받아간 사람들에게만 발송
//
// Usage:
//   DRY_RUN=1 node emails/send-prompts.js     # 발송 없이 수신자 목록만 출력
//   node emails/send-prompts.js               # 실제 발송 (ACS)
//
// Required env vars (실제 발송 시):
//   GITHUB_REPO, GITHUB_TOKEN (또는 GITHUB_PAT)
//   ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS
//   EVENT_ID (선택, 기본 powerbi-mcp-20260530)

const crypto = require('crypto');
const template = require('./practice-prompts');

const APIM_URL = 'https://apim-eduelden-ai.azure-api.net';

// --- 활성 학생 목록 조회 (관리자 페이지 manage.js 와 동일한 파싱 규칙) ---
async function getActiveStudents() {
  const repo = process.env.GITHUB_REPO;
  const pat = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (!repo || !pat) throw new Error('GITHUB_REPO / GITHUB_TOKEN(PAT) 환경변수가 필요합니다.');

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

  // studentId 별로 그룹핑하여 최신(가장 큰 issue number) 항목의 상태/이메일 사용
  const byStudent = new Map();
  for (const iss of allIssues) {
    const m = (iss.title || '').match(/학생\s*(\d{2})번/); // 실제 학생 신청만 (테스트 항목 제외)
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

  // 활성 = done 이고 이메일이 유효한 학생만
  return [...byStudent.values()]
    .filter((s) => s.status === 'done' && s.email)
    .sort((a, b) => a.studentId.localeCompare(b.studentId));
}

// --- ACS 이메일 발송 ---
async function sendEmail(toAddress, subject, html) {
  const connStr = process.env.ACS_CONNECTION_STRING;
  const sender = process.env.ACS_SENDER_ADDRESS;
  if (!connStr || !sender) throw new Error('ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS 환경변수가 필요합니다.');

  const endpoint = connStr.match(/endpoint=([^;]+)/)[1].replace(/\/$/, '');
  const accessKey = connStr.match(/accesskey=(.*)/)[1];
  const host = endpoint.replace('https://', '');

  const body = JSON.stringify({
    senderAddress: sender,
    content: { subject, html },
    recipients: { to: [{ address: toAddress }] },
  });

  const url = new URL(`${endpoint}/emails:send?api-version=2023-03-31`);
  const dateStr = new Date().toUTCString();
  const contentHash = crypto.createHash('sha256').update(body).digest('base64');
  const pathAndQuery = url.pathname + url.search;
  const stringToSign = `POST\n${pathAndQuery}\n${dateStr};${host};${contentHash}`;
  const signature = crypto
    .createHmac('sha256', Buffer.from(accessKey, 'base64'))
    .update(stringToSign)
    .digest('base64');

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'x-ms-date': dateStr,
      'x-ms-content-sha256': contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      'Content-Type': 'application/json',
      'repeatability-request-id': crypto.randomUUID(),
      'repeatability-first-sent': dateStr,
    },
    body,
  });

  const result = await resp.text();
  return { status: resp.status, result };
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');
  const onlyEmail = (process.env.ONLY_EMAIL || '').trim().toLowerCase();
  // STUDENT_IDS: 콤마구분 학생번호 (예: "22,49,50"). 지정 시 해당 학생만 발송.
  const studentIds = (process.env.STUDENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.padStart(2, '0'))
    .filter((s) => /^\d{2}$/.test(s));

  let students = await getActiveStudents();

  // 선택 발송: 지정된 학생번호만 (관리자 페이지에서 선택한 대상)
  if (studentIds.length > 0) {
    const set = new Set(studentIds);
    students = students.filter((s) => set.has(s.studentId));
    console.log(`\n[STUDENT_IDS 필터] 요청 ${studentIds.length}명 → 활성 매칭 ${students.length}명`);
  }

  // 테스트 발송: 특정 이메일만 (해당 이메일의 첫 학생 1명만 발송 → 중복 방지)
  if (onlyEmail) {
    const matched = students.filter((s) => s.email.toLowerCase() === onlyEmail);
    students = matched.slice(0, 1);
    console.log(`\n[ONLY_EMAIL 필터] ${onlyEmail} → ${matched.length}건 매칭, 1건만 발송`);
  }

  console.log(`\n=== 실습 프롬프트 메일 발송 ${dryRun ? '(DRY RUN — 발송 안 함)' : ''} ===`);
  console.log(`수신 대상: ${students.length}명\n`);
  students.forEach((s) => console.log(`  ${s.studentId}번  ${s.email}  (issue #${s.issueNumber})`));
  console.log('');

  if (dryRun) {
    console.log('DRY RUN 종료. 실제 발송하려면 DRY_RUN 없이 실행하세요.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const s of students) {
    const { subject, html } = template.generate({ studentId: s.studentId, apimUrl: APIM_URL });
    try {
      const r = await sendEmail(s.email, subject, html);
      if (r.status === 202) {
        ok++;
        console.log(`  ✅ ${s.studentId}번 → ${s.email}`);
      } else {
        fail++;
        console.error(`  ❌ ${s.studentId}번 → ${s.email} : HTTP ${r.status} ${r.result}`);
      }
    } catch (e) {
      fail++;
      console.error(`  ❌ ${s.studentId}번 → ${s.email} : ${e.message}`);
    }
  }

  console.log(`\n발송 완료: 성공 ${ok} / 실패 ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('발송 스크립트 오류:', err);
  process.exit(1);
});

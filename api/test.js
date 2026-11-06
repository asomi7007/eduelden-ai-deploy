'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const passcodes = require('./src/lib/classPasscode');

const handlers = {};
const { app } = require('@azure/functions');
const register = app.http;
app.http = (name, config) => { handlers[name] = config.handler; };
require('./src/functions/class-passcode');
require('./src/functions/onboard');
require('./src/functions/cancel');
app.http = register;

const originalFetch = global.fetch;
const envNames = [
  'GITHUB_REPO', 'GITHUB_PAT', 'CLASS_PASSCODE', 'ADMIN_PASSWORD',
  'ONBOARDING_SIGNING_KEY', 'CLASS_PASSCODE_ISSUE_NUMBER',
];
let originalEnv;
let settingsIssues;
let onboardingIssues;
let writes;
let settingsStatus;
let saveStatus;
let logs;

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  Object.assign(process.env, {
    GITHUB_REPO: 'test/workshop',
    GITHUB_PAT: 'test-token',
    CLASS_PASSCODE: 'initial-test-code',
    ONBOARDING_SIGNING_KEY: 'test-signing-key-not-a-credential',
    ADMIN_PASSWORD: 'test-admin-password',
  });
  delete process.env.CLASS_PASSCODE_ISSUE_NUMBER;
  settingsIssues = [];
  onboardingIssues = [];
  writes = [];
  settingsStatus = 200;
  saveStatus = 200;
  logs = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    if (method !== 'GET') writes.push({ url, method, body });
    if (method === 'GET' && parsed.searchParams.get('labels') === 'class-settings') {
      return response(settingsIssues, settingsStatus);
    }
    if (method === 'GET' && parsed.searchParams.get('labels') === 'onboarding') {
      return response(onboardingIssues.filter(issue => issue.state === parsed.searchParams.get('state')));
    }
    if (parsed.pathname.endsWith('/labels') && method === 'POST') return response({}, 201);
    if (parsed.pathname.endsWith('/issues') && method === 'POST') {
      if (saveStatus !== 200 && body.labels.includes('class-settings')) return response({}, saveStatus);
      const issue = { ...body, number: 100 + writes.length, state: 'open', labels: body.labels.map(name => ({ name })) };
      (body.labels.includes('class-settings') ? settingsIssues : onboardingIssues).push(issue);
      return response(issue, 201);
    }
    const issueMatch = parsed.pathname.match(/\/issues\/(\d+)$/);
    if (issueMatch && method === 'GET') {
      const issue = [...settingsIssues, ...onboardingIssues].find(item => item.number === Number(issueMatch[1]));
      return response(issue || {}, issue ? 200 : 404);
    }
    if (issueMatch && method === 'PATCH') {
      const issue = [...settingsIssues, ...onboardingIssues].find(item => item.number === Number(issueMatch[1]));
      if (!issue) throw new Error('Mock issue not found');
      Object.assign(issue, body);
      if (Array.isArray(body.labels)) issue.labels = body.labels.map(name => ({ name }));
      return response(issue);
    }
    if (parsed.pathname.endsWith('/comments') && method === 'POST') return response({}, 201);
    throw new Error(`Unexpected request: ${method} ${parsed.pathname}`);
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

function request(body, method = 'POST') {
  return { method, json: async () => body };
}

const context = {
  log: (...args) => logs.push(args),
  error: (...args) => logs.push(args),
  warn: (...args) => logs.push(args),
};

test('keeps the original code before the first administrator change', async () => {
  assert.equal(await passcodes.verifyClassPasscode('initial-test-code'), true);
  assert.equal(await passcodes.verifyClassPasscode('wrong-code'), false);
});

test('persists only a salted hash and replaces the old code for fresh instances', async () => {
  const result = await passcodes.saveClassPasscode('new-test-code');
  assert.ok(result.updatedAt);
  assert.equal(settingsIssues.length, 1);
  assert.ok(!settingsIssues[0].body.includes('new-test-code'));
  assert.ok(!settingsIssues[0].body.includes('initial-test-code'));
  assert.equal(await passcodes.verifyClassPasscode('initial-test-code'), false);
  assert.equal(await passcodes.verifyClassPasscode('new-test-code'), true);
  delete require.cache[require.resolve('./src/lib/classPasscode')];
  assert.equal(await require('./src/lib/classPasscode').verifyClassPasscode('new-test-code'), true);
});

test('updates the existing settings issue without reserving an onboarding slot', async () => {
  await passcodes.saveClassPasscode('first-test-code');
  const number = settingsIssues[0].number;
  await passcodes.saveClassPasscode('second-test-code');
  assert.equal(settingsIssues.length, 1);
  assert.equal(settingsIssues[0].number, number);
  assert.equal(onboardingIssues.length, 0);
  assert.equal(await passcodes.verifyClassPasscode('first-test-code'), false);
  assert.equal(await passcodes.verifyClassPasscode('second-test-code'), true);
});

test('preserves Unicode codes through changes and restoration', async () => {
  const original = '초기-시험코드';
  process.env.CLASS_PASSCODE = original;
  assert.equal(await passcodes.verifyClassPasscode(original), true);
  await passcodes.saveClassPasscode('변경-시험코드');
  assert.equal(await passcodes.verifyClassPasscode(original), false);
  assert.equal(await passcodes.verifyClassPasscode('변경-시험코드'), true);
  await passcodes.saveClassPasscode(original);
  assert.equal(await passcodes.verifyClassPasscode(original), true);
  assert.equal(await passcodes.verifyClassPasscode('변경-시험코드'), false);
});

test('handles concurrent first-save records deterministically', async () => {
  await passcodes.saveClassPasscode('first-test-code');
  const first = { ...settingsIssues[0] };
  await passcodes.saveClassPasscode('second-test-code');
  settingsIssues = [first, { ...settingsIssues[0], number: first.number + 1 }];
  assert.equal(await passcodes.verifyClassPasscode('second-test-code'), true);
  assert.equal(await passcodes.verifyClassPasscode('first-test-code'), false);
});

test('fixed issue lookup bypasses stale listings and fails closed if the record is missing', async () => {
  await passcodes.saveClassPasscode('new-code');
  process.env.CLASS_PASSCODE_ISSUE_NUMBER = String(settingsIssues[0].number);
  settingsStatus = 500;
  assert.equal(await passcodes.verifyClassPasscode('new-code'), true);
  await passcodes.saveClassPasscode('changed-code');
  assert.equal(await passcodes.verifyClassPasscode('changed-code'), true);
  assert.equal(await passcodes.verifyClassPasscode('new-code'), false);
  settingsIssues = [];
  await assert.rejects(passcodes.verifyClassPasscode('initial-test-code'), /HTTP 404/);
});

test('first save verifies the created issue directly even before it appears in listings', async () => {
  const fetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (new URL(url).searchParams.get('labels') === 'class-settings') return response([]);
    return fetch(url, options);
  };
  const saved = await passcodes.saveClassPasscode('new-code');
  assert.ok(saved.updatedAt);
  assert.equal(settingsIssues.length, 1);
});
test('never falls back to the original code when settings cannot be read', async () => {
  for (const status of [403, 404, 500]) {
    settingsStatus = status;
    await assert.rejects(passcodes.verifyClassPasscode('initial-test-code'), /조회 실패/);
  }
});

test('rejects corrupted or tampered settings rather than using a default code', async () => {
  await passcodes.saveClassPasscode('new-test-code');
  const record = JSON.parse(settingsIssues[0].body);
  record.settings.hash = '0'.repeat(64);
  settingsIssues[0].body = JSON.stringify(record);
  await assert.rejects(passcodes.verifyClassPasscode('new-test-code'), /인증에 실패/);
  settingsIssues[0].body = 'not-json';
  await assert.rejects(passcodes.verifyClassPasscode('initial-test-code'), /형식/);
});

test('rejects unauthorized passcode changes before accessing storage', async () => {
  global.fetch = async () => { throw new Error('Storage must not be accessed'); };
  for (const adminPw of [undefined, '', 'wrong-password']) {
    const result = await handlers['class-passcode'](request({ adminPw, passcode: 'new-code', confirmPasscode: 'new-code' }), context);
    assert.equal(result.status, 403);
  }
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await handlers['class-passcode'](request({ passcode: 'new-code', confirmPasscode: 'new-code' }), context)).status, 403);
});

test('validates passcode length, whitespace and confirmation before saving', async () => {
  for (const passcode of ['', 'abc', 'x'.repeat(129), ' code', 'new code', 'code\n', 'a\u0000bc', 1234, null]) {
    const result = await handlers['class-passcode'](request({ adminPw: process.env.ADMIN_PASSWORD, passcode, confirmPasscode: passcode }), context);
    assert.equal(result.status, 400);
  }
  const mismatch = await handlers['class-passcode'](request({
    adminPw: process.env.ADMIN_PASSWORD, passcode: 'new-code', confirmPasscode: 'different-code',
  }), context);
  assert.equal(mismatch.status, 400);
  assert.equal(writes.length, 0);
  assert.equal(passcodes.validNewPasscode('가나다라'), true);
  assert.equal(passcodes.validNewPasscode('x'.repeat(128)), true);
});

test('reports malformed JSON, preflight and failed persistence explicitly', async () => {
  const invalidJson = await handlers['class-passcode']({ method: 'POST', json: async () => { throw new SyntaxError(); } }, context);
  assert.equal(invalidJson.status, 400);
  assert.equal((await handlers['class-passcode'](request(null, 'OPTIONS'), context)).status, 204);
  saveStatus = 403;
  const failed = await handlers['class-passcode'](request({
    adminPw: process.env.ADMIN_PASSWORD, passcode: 'new-code', confirmPasscode: 'new-code',
  }), context);
  assert.equal(failed.status, 502);
  assert.match(failed.jsonBody.error, /저장 실패/);
  assert.equal(settingsIssues.length, 0);
});

test('successful admin save never returns or logs either code', async () => {
  const result = await handlers['class-passcode'](request({
    adminPw: process.env.ADMIN_PASSWORD, passcode: 'new-test-code', confirmPasscode: 'new-test-code',
  }), context);
  assert.equal(result.status, 200);
  const serialized = JSON.stringify([result, logs]);
  assert.ok(!serialized.includes('new-test-code'));
  assert.ok(!serialized.includes('initial-test-code'));
});

test('missing signing configuration fails explicitly without creating settings', async () => {
  delete process.env.ONBOARDING_SIGNING_KEY;
  const result = await handlers['class-passcode'](request({
    adminPw: process.env.ADMIN_PASSWORD, passcode: 'new-code', confirmPasscode: 'new-code',
  }), context);
  assert.equal(result.status, 502);
  assert.match(result.jsonBody.error, /설정이 누락/);
  assert.equal(settingsIssues.length, 0);
  assert.equal(writes.length, 0);
});

test('the original class code cannot forge server proofs after a change', async () => {
  await passcodes.saveClassPasscode('new-code');
  const signed = require('node:crypto').createHmac('sha256', 'initial-test-code')
    .update(JSON.stringify(['onboarding-v1', process.env.GITHUB_REPO, '01', 'test@example.test', 'default'])).digest('hex');
  assert.equal(passcodes.verifyOnboardingProof(signed, '01', 'test@example.test', 'default'), false);
});

test('onboarding accepts the new code, rejects the old, and stores proof instead of plaintext', async () => {
  await passcodes.saveClassPasscode('new-test-code');
  const submission = { email: 'TEST@example.test', event: 'kimi-copilot-20261107-gwangju' };
  const oldCode = await handlers.onboard(request({ ...submission, passcode: 'initial-test-code' }), context);
  assert.equal(oldCode.status, 403);
  const accepted = await handlers.onboard(request({ ...submission, passcode: 'new-test-code' }), context);
  assert.equal(accepted.status, 201);
  const issue = onboardingIssues[0];
  assert.ok(!issue.body.includes('new-test-code'));
  assert.ok(!issue.body.includes('PASSCODE:'));
  const proof = issue.body.match(/ONBOARDING_PROOF: ([a-f0-9]{64})/)[1];
  assert.equal(passcodes.verifyOnboardingProof(proof, '01', 'test@example.test', submission.event), true);
});

test('onboarding retains the optional default event and rejects issue-field injection', async () => {
  const accepted = await handlers.onboard(request({ email: 'test@example.test', passcode: 'initial-test-code' }), context);
  assert.equal(accepted.status, 201);
  assert.match(onboardingIssues[0].body, /EVENT: default/);
  const rejected = await handlers.onboard(request({
    email: 'other@example.test', passcode: 'initial-test-code', event: 'default\nEMAIL: attacker@example.test',
  }), context);
  assert.equal(rejected.status, 400);
});

test('student cancellation uses the new code while admin cancellation stays independent', async () => {
  await passcodes.saveClassPasscode('new-test-code');
  onboardingIssues.push({ number: 50, title: '[온보딩] 학생 01번', state: 'closed', labels: [{ name: 'onboarding' }, { name: 'done' }] });
  assert.equal((await handlers.cancel(request({ studentId: '01', passcode: 'initial-test-code' }), context)).status, 403);
  assert.equal((await handlers.cancel(request({ studentId: '01', passcode: 'new-test-code' }), context)).status || 200, 200);
  onboardingIssues[0].labels = [{ name: 'onboarding' }, { name: 'done' }];
  settingsStatus = 500;
  assert.equal((await handlers.cancel(request({ studentId: '01', isAdmin: true, adminPw: process.env.ADMIN_PASSWORD }), context)).status || 200, 200);
});

test('accepted proofs survive rotation but fail when recipient, student, event or signature changes', async () => {
  const proof = passcodes.createOnboardingProof('01', 'test@example.test', 'default');
  await passcodes.saveClassPasscode('new-test-code');
  assert.equal(passcodes.verifyOnboardingProof(proof, '01', 'test@example.test', 'default'), true);
  assert.equal(passcodes.verifyOnboardingProof(proof, '02', 'test@example.test', 'default'), false);
  assert.equal(passcodes.verifyOnboardingProof(proof, '01', 'other@example.test', 'default'), false);
  assert.equal(passcodes.verifyOnboardingProof(proof, '01', 'test@example.test', 'other-event'), false);
  assert.equal(passcodes.verifyOnboardingProof('invalid', '01', 'test@example.test', 'default'), false);
});

test('email workflow authenticates server proofs and legacy requests with the current code', async () => {
  const yaml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'student-onboarding.yml'), 'utf8');
  const section = yaml.split('            const body = context.payload.issue.body')[1].split('      - name: Get APIM')[0];
  const script = 'const body = context.payload.issue.body' + section.replace(/^ {12}/gm, '');
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('context', 'github', 'core', 'require', script);
  async function authenticate(body) {
    const outputs = {};
    let rejected = false;
    await run({ payload: { issue: { body } }, repo: { owner: 'test', repo: 'workshop' }, issue: { number: 1 } }, {
      rest: { issues: { createComment: async () => {}, update: async () => { rejected = true; } } },
    }, { setOutput: (key, value) => { outputs[key] = value; }, setFailed: () => { rejected = true; } }, () => passcodes);
    return { outputs, rejected };
  }
  await passcodes.saveClassPasscode('new-test-code');
  const info = 'STUDENT_ID: 01\nEMAIL: test@example.test\nEVENT: default';
  const proof = passcodes.createOnboardingProof('01', 'test@example.test', 'default');
  assert.equal((await authenticate(`ONBOARDING_PROOF: ${proof}\n${info}`)).outputs.student_id, '01');
  assert.equal((await authenticate(`ONBOARDING_PROOF: invalid\nPASSCODE: new-test-code\n${info}`)).rejected, true);
  assert.equal((await authenticate(`ONBOARDING_PROOF: ${proof}\n${info.replace('test@example.test', 'other@example.test')}`)).rejected, true);
  assert.equal((await authenticate(`PASSCODE: initial-test-code\n${info}`)).rejected, true);
  assert.equal((await authenticate(`PASSCODE: new-test-code\n${info}`)).outputs.student_id, '01');
});

test('admin form posts confirmed values, clears them after save, and reports failures', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const source = html.match(/async function adminChangePasscode\(\) \{[\s\S]*?\n\}/)[0];
  const elements = {
    btnSavePasscode: { disabled: false, textContent: '패스코드 변경' },
    newClassPasscode: { value: 'new-code' },
    confirmClassPasscode: { value: 'new-code' },
  };
  const alerts = [];
  const requests = [];
  const sandbox = {
    document: { getElementById: id => elements[id] },
    adminPw: 'admin-fixture',
    hideAlert: () => {},
    showAlert: (...args) => alerts.push(args),
    apiFetch: async (route, options) => { requests.push({ route, body: JSON.parse(options.body) }); return { message: 'saved' }; },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  await sandbox.adminChangePasscode();
  assert.equal(requests[0].route, '/manage/passcode');
  assert.equal(requests[0].body.confirmPasscode, 'new-code');
  assert.equal(elements.newClassPasscode.value, '');
  assert.equal(elements.confirmClassPasscode.value, '');
  assert.equal(elements.btnSavePasscode.disabled, false);
  assert.equal(alerts[0][1], 'success');
  elements.newClassPasscode.value = 'new-code';
  elements.confirmClassPasscode.value = 'different-code';
  await sandbox.adminChangePasscode();
  assert.equal(requests.length, 1);
  assert.equal(alerts.at(-1)[1], 'error');
  elements.confirmClassPasscode.value = 'new-code';
  sandbox.apiFetch = async () => { throw new Error('storage failed'); };
  await sandbox.adminChangePasscode();
  assert.match(alerts.at(-1)[2], /storage failed/);
  assert.equal(elements.btnSavePasscode.disabled, false);
  assert.equal(elements.newClassPasscode.value, 'new-code');
});

test('uses the exact event name on the page, email and completion notification', () => {
  const eventName = 'Techive의 여덟 번째 발표  with 광주과학기술원';
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.ok(html.includes(`<title>${eventName} - 온보딩</title>`));
  assert.ok(html.includes(`🚀 ${eventName}</h1>`));
  const email = require('../emails/kimi-copilot').generate({
    studentId: '01', apiKey: 'test-key-not-a-credential', apimUrl: 'https://test.example/openai/v1',
  });
  assert.equal(email.subject, `[${eventName}] 01번 — 접속 정보 및 설치 안내`);
  assert.ok(email.html.includes(eventName));
  assert.ok(email.html.includes('Ocp-Apim-Subscription-Key'));
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'student-onboarding.yml'), 'utf8');
  assert.ok(workflow.includes(`'kimi-copilot-20261107-gwangju': ' (${eventName})'`));
});

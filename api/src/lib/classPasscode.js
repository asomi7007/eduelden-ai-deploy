'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SETTINGS_LABEL = 'class-settings';
const SETTINGS_TITLE = '[설정] 수업 패스코드';

function signingKey() {
  const key = process.env.ONBOARDING_SIGNING_KEY;
  if (!key) throw new Error('수업 인증 설정이 누락되었습니다.');
  return key;
}

function sign(value) {
  return crypto.createHmac('sha256', signingKey()).update(JSON.stringify(value)).digest('hex');
}

function equalSignature(actual, expected) {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) &&
    crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

async function github(path, options = {}, token = process.env.GITHUB_PAT) {
  const repo = process.env.GITHUB_REPO;
  if (!repo || !token) throw new Error('GitHub 연결 설정이 누락되었습니다.');
  return fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'eduelden-onboarding',
    },
  });
}

async function loadSettings(token) {
  const response = await github(`/issues?labels=${SETTINGS_LABEL}&state=all&sort=created&direction=desc&per_page=100`, {}, token);
  if (!response.ok) throw new Error(`수업 설정 조회 실패 (HTTP ${response.status})`);
  const issues = (await response.json()).filter(issue => !issue.pull_request && issue.title === SETTINGS_TITLE);
  if (!issues.length) return null;
  // Concurrent first saves can create two issues. The newest issue is authoritative.
  issues.sort((a, b) => b.number - a.number);

  let record;
  try {
    record = JSON.parse(issues[0].body);
  } catch {
    throw new Error('수업 설정 형식이 올바르지 않습니다.');
  }
  const { settings, signature } = record || {};
  if (!settings || settings.version !== 1 || !/^[a-f0-9]{32}$/.test(settings.salt) ||
      !/^[a-f0-9]{64}$/.test(settings.hash) || !equalSignature(signature, sign(settings))) {
    throw new Error('수업 설정 인증에 실패했습니다.');
  }
  return { issueNumber: issues[0].number, settings };
}

async function verifyClassPasscode(passcode, token) {
  if (typeof passcode !== 'string' || !passcode || passcode.length > 128) return false;
  const record = await loadSettings(token);
  if (!record) {
    if (!process.env.CLASS_PASSCODE) throw new Error('수업 패스코드 설정이 누락되었습니다.');
    const expected = Buffer.from(process.env.CLASS_PASSCODE);
    const actual = Buffer.from(passcode);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  const hash = await scrypt(passcode, record.settings.salt, 32);
  return crypto.timingSafeEqual(hash, Buffer.from(record.settings.hash, 'hex'));
}

function validNewPasscode(passcode) {
  return typeof passcode === 'string' && passcode.length >= 4 && passcode.length <= 128 &&
    passcode === passcode.trim() && !/[\s\u0000-\u001f\u007f]/u.test(passcode);
}

async function saveClassPasscode(passcode) {
  if (!validNewPasscode(passcode)) throw new Error('패스코드는 공백 없이 4~128자로 입력해주세요.');
  const existing = await loadSettings();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(passcode, salt, 32)).toString('hex');
  const settings = { version: 1, salt, hash, updatedAt: new Date().toISOString() };
  const body = JSON.stringify({ settings, signature: sign(settings) });

  if (!existing) {
    const labelResponse = await github('/labels', {
      method: 'POST',
      body: JSON.stringify({ name: SETTINGS_LABEL, color: '64748b', description: 'Onboarding configuration' }),
    });
    if (!labelResponse.ok) {
      const label = await github(`/labels/${SETTINGS_LABEL}`);
      if (!label.ok) throw new Error(`수업 설정 라벨 생성 실패 (HTTP ${labelResponse.status})`);
    }
  }

  const response = await github(existing ? `/issues/${existing.issueNumber}` : '/issues', {
    method: existing ? 'PATCH' : 'POST',
    body: JSON.stringify(existing
      ? { body }
      : { title: SETTINGS_TITLE, body, labels: [SETTINGS_LABEL] }),
  });
  if (!response.ok) throw new Error(`수업 패스코드 저장 실패 (HTTP ${response.status})`);

  const saved = await loadSettings();
  if (!saved || saved.settings.hash !== hash || saved.settings.salt !== salt) {
    throw new Error('수업 패스코드 저장을 확인할 수 없습니다. 새로고침 후 다시 시도해주세요.');
  }
  return { updatedAt: saved.settings.updatedAt };
}

function createOnboardingProof(studentId, email, event) {
  return sign(['onboarding-v1', process.env.GITHUB_REPO, studentId, email, event]);
}

function verifyOnboardingProof(proof, studentId, email, event) {
  return equalSignature(proof, createOnboardingProof(studentId, email, event));
}

module.exports = {
  verifyClassPasscode, validNewPasscode, saveClassPasscode,
  createOnboardingProof, verifyOnboardingProof,
};

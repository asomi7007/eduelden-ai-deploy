'use strict';

// eldon-link 단축 URL 생성 + 키 레코드 캐시 공용 헬퍼
// 사용처: admin-keys(발급 시 자동 생성), key-example(폴백 생성)
// 규칙: 이미 shareShortUrl이 있으면 재사용(중복 생성 방지), 실패 시 null (호출자 폴백)

const crypto = require('crypto');

function shareTokenOf(keyId) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  return crypto.createHmac('sha256', secret).update(keyId).digest('base64url').slice(0, 16);
}

async function makeShortUrl(longUrl, title) {
  const token = process.env.ELDON_LINK_TOKEN;
  const endpoint = process.env.ELDON_LINK_ENDPOINT || 'https://www.eldnx.com/api/links/create';
  if (!token) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-api-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: longUrl, title: title || '', meta: 'apim-dashboard' })
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.shortUrl || null;
  } catch { return null; }
}

/**
 * 키에 단축 URL 보장 — 있으면 재사용, 없으면 생성 후 캐시 저장.
 * @returns {string} shortUrl or null
 */
async function ensureShareShortUrl(k, origin) {
  if (k.shareShortUrl) return k.shareShortUrl;
  const base = origin || process.env.PUBLIC_BASE_URL || 'https://api.eldnx.com';
  const longUrl = `${base}/share/${k.keyId}?t=${shareTokenOf(k.keyId)}`;
  const short = await makeShortUrl(longUrl, k.owner || k.keyId);
  if (short) {
    try { await upsertKeySafe({ ...k, shareShortUrl: short }); } catch { /* 저장 실패 시 매번 재생성되지만 기능은 유지 */ }
  }
  return short;
}

// 순환 의존 회피: lazy require
let _upsertKey = null;
function upsertKeySafe(k) {
  if (!_upsertKey) _upsertKey = require('../lib/tableStorage').upsertKey;
  return _upsertKey(k);
}

module.exports = { shareTokenOf, makeShortUrl, ensureShareShortUrl };

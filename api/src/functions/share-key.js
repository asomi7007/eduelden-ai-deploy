'use strict';

const { app } = require('@azure/functions');
const { successResponse, errorResponse } = require('../lib/auth');
const { baseUrl } = require('../lib/snippets');
const { buildSnippets } = require('../lib/snippets');
const { listKeys } = require('../lib/tableStorage');
const crypto = require('crypto');

function shareToken(keyId) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  return crypto.createHmac('sha256', secret).update(keyId).digest('base64url').slice(0, 16);
}

function decSecret(stored) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  const key = crypto.createHash('sha256').update(secret).digest();
  const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
  const dec = Buffer.concat([d.update(Buffer.from(stored, 'base64')), d.final()]);
  return dec.toString('utf8');
}

/** GET /api/share/{keyId}?t=<token> — 로그인 없이 접근 (QR 찍은 참가자용) */
app.http('sharedKeyInfo', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'share/{keyId}',
  handler: async (request) => {
    try {
      const keyId = request.params.keyId;
      const t = request.query.get('t') || '';
      if (!keyId || t !== shareToken(keyId)) {
        return errorResponse('invalid link', 403);
      }
      const keys = (await listKeys()).filter((k) => k.keyId === keyId);
      if (!keys.length) return errorResponse('key not found', 404);
      const k = keys[0];
      if (k.status !== 'ACTIVE') {
        return errorResponse('이 키는 만료 또는 정지되었습니다', 410);
      }
      // 실제 API 키 복호화해서 제공 (암호화 저장본에서)
      let apiKey = '';
      try {
        apiKey = k.encryptedKey ? decSecret(k.encryptedKey) : '';
      } catch { apiKey = ''; }
      return successResponse({
        keyId: k.keyId,
        owner: k.owner,
        workshopId: k.workshopId,
        expiresAt: k.expiresAt,
        apiKey,                    // 실제 키 전체
        maskedKey: k.maskedKey,    // 참고용 마스킹
        baseUrl: baseUrl(),
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

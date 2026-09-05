'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { buildSnippets } = require('../lib/snippets');
const { listKeys, getWorkshop } = require('../lib/tableStorage');
const crypto = require('crypto');

function shareToken(keyId) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  return crypto.createHmac('sha256', secret).update(keyId).digest('base64url').slice(0, 16);
}

/**
 * GET /api/dashboard/admin/keys/{keyId}/example?model=<modelId>
 * 관리자 전용: 실제 API 키가 포함된 사용 예제 + 공유 QR URL 반환.
 * ⚠️ APIM은 primaryKey 재조회가 안 되므로, 발급/재생성 응답의 원본 키를
 * AccessKeys 테이블에 암호화 저장했다가 여기서 복호화해 제공한다.
 * (암호화키=ADMIN_TOKEN, Table Storage 원본에는 키가 없음)
 */
function encSecret(raw) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  const key = crypto.createHash('sha256').update(secret).digest();
  const c = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
  const enc = Buffer.concat([c.update(raw, 'utf8'), c.final()]);
  return enc.toString('base64');
}
function decSecret(stored) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  const key = crypto.createHash('sha256').update(secret).digest();
  const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
  const dec = Buffer.concat([d.update(Buffer.from(stored, 'base64')), d.final()]);
  return dec.toString('utf8');
}

async function getStoredKey(keyId) {
  const keys = (await listKeys()).filter((k) => k.keyId === keyId);
  if (!keys.length) return null;
  return keys[0];
}

app.http('keyExample', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/keys/{keyId}/example',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const { keyId } = request.params;
      const model = request.query.get('model') || 'model-router';
      const k = await getStoredKey(keyId);
      if (!k) return errorResponse('key not found', 404);
      if (!k.encryptedKey) {
        return errorResponse('원본 키가 저장되어 있지 않습니다 (발급 시에만 확인 가능). 재생성하면 예제가 활성화됩니다.', 409);
      }
      const rawKey = decSecret(k.encryptedKey);
      const snippets = buildSnippets(rawKey, model);
      const workshop = await getWorkshop(k.workshopId);
      const allowedModels = (workshop && workshop.allowedModels && workshop.allowedModels.length)
        ? workshop.allowedModels : ['model-router'];
      const origin = process.env.PUBLIC_BASE_URL || `https://${(request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim()}`;
      return successResponse({
        keyId,
        owner: k.owner,
        workshopId: k.workshopId,
        expiresAt: k.expiresAt,
        model,
        allowedModels,
        ...snippets,
        shareUrl: `${origin}/share/${keyId}?t=${shareToken(keyId)}`,
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

module.exports = { encSecret, decSecret };

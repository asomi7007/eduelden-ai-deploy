'use strict';

const { app } = require('@azure/functions');
const { successResponse, errorResponse } = require('../lib/auth');
const { buildSnippets, baseUrl, MODEL_DESCRIPTIONS, MODEL_CAPABILITIES, MODEL_TOKEN_LIMITS } = require('../lib/snippets');
const { listKeys, getWorkshop, listModels } = require('../lib/tableStorage');
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
      const workshop = await getWorkshop(k.workshopId);
      const allModels = await listModels();
      const imageModels = new Set(allModels.filter((m) => m.modelType === 'image').map((m) => m.modelId));
      // 텍스트 전용: Copilot 앱은 chat completions 규격만 사용 — 이미지 모델은 노출 제외
      const allowedModels = ((workshop && workshop.allowedModels && workshop.allowedModels.length)
        ? workshop.allowedModels : ['model-router']).filter((m) => !imageModels.has(m));
      const displayNames = {};
      allModels.forEach((m) => { displayNames[m.modelId] = m.displayName; });
      const snippets = buildSnippets(apiKey, allowedModels[0]);
      return successResponse({
        keyId: k.keyId,
        owner: k.owner,
        workshopId: k.workshopId,
        expiresAt: k.expiresAt,
        apiKey,                    // 실제 키 전체
        maskedKey: k.maskedKey,    // 참고용 마스킹
        baseUrl: baseUrl(),
        allowedModels,             // 실습에 배정된 텍스트 모델만 (이미지 제외)
        displayNames,              // 모델 표시명
        modelDescriptions: MODEL_DESCRIPTIONS,
        modelCapabilities: MODEL_CAPABILITIES,
        modelTokenLimits: MODEL_TOKEN_LIMITS,
        snippets,                  // 기본 예제 (첫 모델 기준)
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

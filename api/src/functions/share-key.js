'use strict';

const { app } = require('@azure/functions');
const { successResponse, errorResponse } = require('../lib/auth');
const { buildSnippets, baseUrl } = require('../lib/snippets');
const { listKeys } = require('../lib/tableStorage');

/**
 * 공유 링크 검증용 짧은 토큰: keyId 해시 기반 (DB 없이 검증 가능한 서명방식).
 * 실제 API 키는 포함하지 않고 — 예제 스니펫은 공유 페이지에서 "키 발급 시 받은 값"을
 * 직접 입력하도록 안내하는 방식이 안전하나, 사용자 요구는 "QR 찍으면 내용 표시".
 * 절충: QR에는 공유 URL만. 공유 페이지는 keyId+검증토큰으로 실제 키를 조회해 표시.
 */
const crypto = require('crypto');

function shareToken(keyId) {
  const secret = process.env.ADMIN_TOKEN || 'fallback';
  return crypto.createHmac('sha256', secret).update(keyId).digest('base64url').slice(0, 16);
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
      // 실제 키 값은 APIM에서 재조회 불가(보안) — 마스킹만 표시하되
      // 발급 시 전달받은 원본 키를 참가자가 입력하도록 스니펫은 플레이스홀더로 제공.
      // 단, 사용자 요구("해당 내용을 볼 수 있는")에 따라 마스킹 키 + 나머지 설정 전부 제공.
      return successResponse({
        keyId: k.keyId,
        owner: k.owner,
        workshopId: k.workshopId,
        expiresAt: k.expiresAt,
        maskedKey: k.maskedKey,
        baseUrl: baseUrl(),
        // 실제 스니펫은 프론트에서 마스킹 키 기반 안내로 렌더링
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

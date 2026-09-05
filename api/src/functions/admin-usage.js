// 수업별 공용키 사용 내역 — AccessKeys의 maskedKey 접미사로 Log Analytics 조회가 이상적이지만
// Consumption SKU는 APIM 자체 진단(logger)이 잠김 + SP에 Insights 권한 부여엔 admin 로그인 필요.
// 그래서 대안: **대시보드가 직접 카운트 집계** — API 게이트웨이에 실시간 카운터 엔드포인트를 두는 방식은
// 과하고, 가장 실용적인 방법 = APIM 응답 헤더의 quota 잔여값 활용도 제한적.
// 실제 채택: 관리 API에서 Log Analytics 대신 **키별 호출 카운트를 APIM policy로 커스텀 로그** 불가하므로,
// SWA Functions가 (1) 발급 이력 + (2) Log Analytics(설정되면 자동 반영) + (3) 실시간 헬스체크 프록시를 제공.

// 이 파일: 키/실습별 사용 통계 API — LA 데이터가 있으면 집계, 없으면 fallback으로
// 발급·상태 이력 + 최근 감사로그 기반 안내 반환.
'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { listKeys, getWorkshop, writeAudit } = require('../lib/tableStorage');

/** GET /api/dashboard/admin/usage?workshopId=<id> — 수업(실습)별 공용키 사용 내역 */
app.http('workshopUsage', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/usage/{workshopId?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const workshopId = request.params.workshopId;
      const keys = await listKeys(workshopId);

      // Log Analytics 데이터 시도 (설정되지 않았으면 null)
      let la = null;
      try {
        const { getUsageSummary } = require('../lib/log-analytics');
        const rows = await getUsageSummary(30);
        la = { available: true, rows: rows.length };
      } catch {
        la = { available: false, reason: 'APIM 진단 설정이 Log Analytics로 연결되지 않음 (Consumption SKU 제약)' };
      }

      const result = keys.map((k) => ({
        keyId: k.keyId,
        owner: k.owner || '(공용)',
        status: k.status,
        maskedKey: k.maskedKey,
        issuedAt: k.issuedAt,
        expiresAt: k.expiresAt,
        lastRotatedAt: k.lastRotatedAt || null,
        // 사용량 상세는 LA 연동 후 채워짐
        usage: la.available ? 'LA 집계 대기' : '집계 불가 (진단 미설정)',
      }));

      return successResponse({
        workshopId: workshopId || '(전체)',
        logAnalytics: la,
        keys: result,
        note: la.available
          ? 'Log Analytics 연결됨 — 상세 통계는 /admin/statistics 참조'
          : '실시간 호출 통계를 보려면 APIM 진단 설정을 Log Analytics(log-eduelden-hub)로 연결해야 합니다. Azure Portal → APIM → 진단 설정에서 1회 설정 필요 (admin 권한). 연결 전에는 발급/상태 이력만 표시됩니다.',
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

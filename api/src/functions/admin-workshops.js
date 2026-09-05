'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { listWorkshops, getWorkshop, upsertWorkshop, deleteWorkshopEntity, writeAudit } = require('../lib/tableStorage');
const { setSubscriptionState, deleteSubscription } = require('../lib/apim');
const { listKeys, upsertKey, deleteKeyEntity } = require('../lib/tableStorage');

app.http('adminWorkshops', {
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/workshops/{workshopId?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      if (request.method === 'GET') {
        if (request.params.workshopId) {
          const w = await getWorkshop(request.params.workshopId);
          if (!w) return errorResponse('workshop not found', 404);
          return successResponse(w);
        }
        return successResponse(await listWorkshops());
      }
      if (request.method === 'POST') {
        const body = await request.json();
        if (!body.workshopId || !body.name) return errorResponse('workshopId, name required', 400);
        body.status = body.status || 'PLANNED';
        await upsertWorkshop(body);
        await writeAudit('workshop.create', body.workshopId);
        return successResponse({ ok: true, workshopId: body.workshopId });
      }
      if (request.method === 'PATCH') {
        const workshopId = request.params.workshopId;
        if (!workshopId) return errorResponse('workshopId required', 400);
        const existing = await getWorkshop(workshopId);
        if (!existing) return errorResponse('workshop not found', 404);
        const body = await request.json();
        await upsertWorkshop({ ...existing, ...body, workshopId });

        if (body.status === 'CLOSED' || body.status === 'SUSPENDED') {
          // 실습 종료 → 소속 키 전부 APIM에서 정지
          const keys = await listKeys(workshopId);
          for (const k of keys) {
            if (k.status === 'ACTIVE') {
              try {
                await setSubscriptionState(k.apimSubscriptionId, 'suspended');
                await upsertKey({ ...k, status: 'SUSPENDED' });
              } catch (e) { /* 개별 실패는 계속 */ }
            }
          }
        }
        await writeAudit('workshop.update', { workshopId, patch: body });
        return successResponse({ ok: true });
      }
      if (request.method === 'DELETE') {
        const workshopId = request.params.workshopId;
        if (!workshopId) return errorResponse('workshopId required', 400);
        // 소속 키 전부 폐기 (APIM 구독 삭제 + DB 삭제)
        const keys = await listKeys(workshopId);
        let purged = 0;
        for (const k of keys) {
          try {
            await deleteSubscription(k.apimSubscriptionId);
            await deleteKeyEntity(k.workshopId, k.keyId);
            purged++;
          } catch { /* continue */ }
        }
        await deleteWorkshopEntity(workshopId);
        await writeAudit('workshop.delete', { workshopId, purged });
        return successResponse({ ok: true, purged });
      }

      return errorResponse('method not allowed', 405);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

// POST /workshops/{id}/close — 실습 즉시 종료
app.http('adminWorkshopClose', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/workshops/{workshopId}/close',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const { workshopId } = request.params;
      const w = await getWorkshop(workshopId);
      if (!w) return errorResponse('workshop not found', 404);
      await upsertWorkshop({ ...w, status: 'CLOSED' });
      const keys = await listKeys(workshopId);
      let suspended = 0;
      for (const k of keys) {
        if (k.status === 'ACTIVE') {
          try {
            await setSubscriptionState(k.apimSubscriptionId, 'suspended');
            await upsertKey({ ...k, status: 'SUSPENDED' });
            suspended++;
          } catch { /* continue */ }
        }
      }
      await writeAudit('workshop.close', { workshopId, suspended });
      return successResponse({ ok: true, suspended });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

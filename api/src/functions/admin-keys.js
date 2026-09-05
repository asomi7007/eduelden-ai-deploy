'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { listKeys, upsertKey, deleteKeyEntity, getWorkshop, upsertWorkshop, writeAudit } = require('../lib/tableStorage');
const { createLabSubscription, regenerateKey, setSubscriptionState, deleteSubscription, maskKey } = require('../lib/apim');

function newKeyId() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `LAB-${date}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

app.http('adminKeys', {
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/keys/{keyId?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      if (request.method === 'GET') {
        const workshopId = request.query.get('workshopId') || undefined;
        return successResponse(await listKeys(workshopId));
      }

      if (request.method === 'POST') {
        const body = await request.json();

        // --- bulk: CSV 등록 (owners: "이름1,이름2,..." 또는 teams 배열) ---
        if (request.query.get('bulk') === '1' || body.bulk) {
          const workshopId = body.workshopId;
          const workshop = await getWorkshop(workshopId);
          if (!workshop) return errorResponse('workshop not found', 404);
          const owners = (body.owners || []).filter(Boolean);
          if (!owners.length) return errorResponse('owners[] required', 400);

          const issued = [];
          for (const owner of owners) {
            const keyId = newKeyId();
            const subId = `sub-${workshopId}-${keyId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const secrets = await createLabSubscription(subId, `${workshopId}/${owner}`);
            await upsertKey({
              keyId, workshopId, name: keyId, owner,
              apimSubscriptionId: subId,
              maskedKey: maskKey(secrets.primaryKey),
              status: 'ACTIVE',
              issuedAt: new Date().toISOString(),
              expiresAt: workshop.expiresAt,
            });
            issued.push({ keyId, owner, subId, primaryKey: secrets.primaryKey, expiresAt: workshop.expiresAt });
          }
          await upsertWorkshop({ ...workshop, keyCount: (workshop.keyCount || 0) + issued.length });
          await writeAudit('key.bulkIssue', { workshopId, count: issued.length });
          // primaryKey는 이 응답에 한 번만 실림
          return successResponse({ issued });
        }

        // --- single ---
        const workshopId = body.workshopId;
        const workshop = await getWorkshop(workshopId);
        if (!workshop) return errorResponse('workshop not found', 404);
        const owner = body.owner || '';
        const keyId = newKeyId();
        const subId = `sub-${workshopId}-${keyId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const secrets = await createLabSubscription(subId, `${workshopId}/${owner || keyId}`);
        await upsertKey({
          keyId, workshopId, name: keyId, owner,
          apimSubscriptionId: subId,
          maskedKey: maskKey(secrets.primaryKey),
          status: 'ACTIVE',
          issuedAt: new Date().toISOString(),
          expiresAt: workshop.expiresAt,
        });
        await upsertWorkshop({ ...workshop, keyCount: (workshop.keyCount || 0) + 1 });
        await writeAudit('key.issue', { workshopId, keyId });
        return successResponse({ keyId, owner, primaryKey: secrets.primaryKey, expiresAt: workshop.expiresAt });
      }

      return errorResponse('method not allowed', 405);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

// POST /keys/{keyId}/regenerate|suspend|activate, DELETE /keys/{keyId}
app.http('adminKeyAction', {
  methods: ['POST', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/keys/{keyId}/{action}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const { keyId, action } = request.params;
      const keys = (await listKeys()).filter((k) => k.keyId === keyId);
      if (!keys.length) return errorResponse('key not found', 404);
      const k = keys[0];

      if (request.method === 'DELETE') {
        await deleteSubscription(k.apimSubscriptionId);
        await deleteKeyEntity(k.workshopId, k.keyId);
        await writeAudit('key.delete', keyId);
        return successResponse({ ok: true });
      }

      const which = request.query.get('which') || 'primary';
      if (action === 'regenerate') {
        const secrets = await regenerateKey(k.apimSubscriptionId, which);
        await upsertKey({
          ...k,
          maskedKey: maskKey(which === 'secondary' ? secrets.secondaryKey : secrets.primaryKey),
          lastRotatedAt: new Date().toISOString(),
        });
        await writeAudit('key.regenerate', { keyId, which });
        return successResponse({
          keyId,
          primaryKey: secrets.primaryKey,
          secondaryKey: secrets.secondaryKey,
        });
      }
      if (action === 'suspend') {
        await setSubscriptionState(k.apimSubscriptionId, 'suspended');
        await upsertKey({ ...k, status: 'SUSPENDED' });
        await writeAudit('key.suspend', keyId);
        return successResponse({ ok: true });
      }
      if (action === 'activate') {
        await setSubscriptionState(k.apimSubscriptionId, 'active');
        await upsertKey({ ...k, status: 'ACTIVE' });
        await writeAudit('key.activate', keyId);
        return successResponse({ ok: true });
      }
      return errorResponse(`unknown action: ${action}`, 400);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

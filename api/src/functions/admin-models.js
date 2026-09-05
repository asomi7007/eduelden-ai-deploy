'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { listModels, upsertModel, writeAudit } = require('../lib/tableStorage');

app.http('adminModels', {
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/models/{modelId?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      if (request.method === 'GET') {
        return successResponse(await listModels());
      }
      if (request.method === 'POST') {
        const body = await request.json();
        if (!body.modelId) return errorResponse('modelId required', 400);
        await upsertModel(body);
        await writeAudit('model.create', body.modelId);
        return successResponse({ ok: true });
      }
      if (request.method === 'PATCH') {
        const modelId = request.params.modelId;
        if (!modelId) return errorResponse('modelId required', 400);
        const body = await request.json();
        await upsertModel({ ...body, modelId });
        await writeAudit('model.update', { modelId, patch: body });
        return successResponse({ ok: true });
      }
      return errorResponse('method not allowed', 405);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { writeAudit, listAudit } = require('../lib/tableStorage');
const { listModels } = require('../lib/tableStorage');

app.http('adminSystem', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/system/{action?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const action = request.params.action || 'health';

      if (request.method === 'GET' && action === 'health') {
        const checks = {};
        // Table Storage
        try {
          const models = await listModels();
          checks.tableStorage = { ok: true, models: models.length };
        } catch (e) {
          checks.tableStorage = { ok: false, error: e.message };
        }
        // APIM (config presence)
        checks.apim = {
          ok: !!(process.env.AZURE_SUBSCRIPTION_ID && process.env.AZURE_RESOURCE_GROUP && process.env.APIM_SERVICE_NAME),
          service: process.env.APIM_SERVICE_NAME || 'unset',
        };
        return successResponse(checks);
      }

      if (request.method === 'GET' && action === 'audit') {
        const limit = parseInt(request.query.get('limit') || '100', 10);
        return successResponse(await listAudit(limit));
      }

      if (request.method === 'POST' && action === 'audit') {
        const body = await request.json();
        await writeAudit(body.action || 'manual', body.detail || '');
        return successResponse({ ok: true });
      }

      return errorResponse(`unknown action: ${action}`, 400);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

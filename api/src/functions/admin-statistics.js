'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { getUsageSummary } = require('../lib/log-analytics');
const { listModels } = require('../lib/tableStorage');

app.http('adminStatistics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/admin/statistics/{view?}',
  handler: async (request) => {
    const cors = handleCors(request);
    if (cors) return cors;
    const auth = await verifyAdmin(request);
    if (!auth.authenticated) return errorResponse(auth.error, 401);

    try {
      const view = request.params.view || 'overview';
      const days = parseInt(request.query.get('days') || '7', 10);

      if (view === 'models') {
        const models = await listModels();
        return successResponse({
          models: models.map((m) => ({
            modelId: m.modelId,
            displayName: m.displayName,
            modelType: m.modelType,
            enabled: m.enabled,
            isDefault: m.isDefault,
          })),
        });
      }

      const rows = await getUsageSummary(days);
      let totalRequests = 0;
      const byModel = {};
      for (const r of rows) {
        totalRequests += r.TotalRequests || 0;
        byModel[r.Model || 'unknown'] = (byModel[r.Model || 'unknown'] || 0) + (r.TotalRequests || 0);
      }
      return successResponse({
        view,
        days,
        totalRequests,
        byModel,
        rawRowCount: rows.length,
      });
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  },
});

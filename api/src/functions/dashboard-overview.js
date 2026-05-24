'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { getUsageSummary, estimateTokens, estimateCost } = require('../lib/log-analytics');
const { listStudentSubscriptions } = require('../lib/azure-client');

/**
 * GET /api/dashboard/overview
 * Returns total token usage, estimated cost, active students, and budget status.
 */
app.http('dashboardOverview', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/overview',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      // Get usage summary from Log Analytics
      const summaryRows = await getUsageSummary(30);

      // Aggregate across models
      let totalRequests = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCost = 0;
      let uniqueStudents = 0;
      const modelBreakdown = {};

      for (const row of summaryRows) {
        const model = row.Model || 'unknown';
        const requests = row.TotalRequests || 0;
        const inputTokens = estimateTokens(row.TotalRequestBytes);
        const outputTokens = estimateTokens(row.TotalResponseBytes);
        const cost = estimateCost(model, inputTokens, outputTokens);

        totalRequests += requests;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        totalCost += cost;
        uniqueStudents = Math.max(uniqueStudents, row.UniqueStudents || 0);

        modelBreakdown[model] = {
          requests,
          inputTokens,
          outputTokens,
          cost: Math.round(cost * 10000) / 10000,
          avgLatencyMs: Math.round(row.AvgLatencyMs || 0)
        };
      }

      // Get subscription states
      let activeStudents = 0;
      let suspendedStudents = 0;
      try {
        const subs = await listStudentSubscriptions();
        activeStudents = subs.filter(s => s.properties?.state === 'active').length;
        suspendedStudents = subs.filter(s => s.properties?.state === 'suspended').length;
      } catch (subErr) {
        context.warn('Could not fetch subscription states:', subErr.message);
        activeStudents = uniqueStudents; // fallback to KQL data
      }

      // Budget info
      const budgetTotal = 800; // USD
      const budgetUsed = Math.round(totalCost * 100) / 100;
      const budgetRemaining = Math.round((budgetTotal - budgetUsed) * 100) / 100;
      const budgetPercent = Math.round((budgetUsed / budgetTotal) * 10000) / 100;

      return successResponse({
        period: 'last_30_days',
        tokens: {
          input: totalInputTokens,
          output: totalOutputTokens,
          total: totalInputTokens + totalOutputTokens
        },
        requests: totalRequests,
        cost: {
          estimated: Math.round(totalCost * 100) / 100,
          budget: budgetTotal,
          remaining: budgetRemaining,
          percentUsed: budgetPercent
        },
        students: {
          total: 50,
          active: activeStudents,
          suspended: suspendedStudents,
          usedThisPeriod: uniqueStudents
        },
        modelBreakdown
      });

    } catch (err) {
      context.error('dashboard-overview error:', err);
      return errorResponse(`Failed to fetch overview: ${err.message}`);
    }
  }
});

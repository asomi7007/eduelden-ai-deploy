'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { getDailyUsage, estimateTokens, estimateCost } = require('../lib/log-analytics');

/**
 * GET /api/dashboard/daily
 * Returns daily usage trends for the last 30 days (or ?days=N).
 * Query params: days (default 30)
 */
app.http('dashboardDaily', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/daily',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const url = new URL(request.url);
      const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90);

      const dailyRows = await getDailyUsage(days);

      // Group by day, aggregate models
      const dailyMap = new Map();

      for (const row of dailyRows) {
        const day = row.Day ? new Date(row.Day).toISOString().split('T')[0] : 'unknown';
        const model = row.Model || 'unknown';
        const inputTokens = estimateTokens(row.RequestBytes);
        const outputTokens = estimateTokens(row.ResponseBytes);
        const cost = estimateCost(model, inputTokens, outputTokens);

        if (!dailyMap.has(day)) {
          dailyMap.set(day, {
            date: day,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            models: {}
          });
        }

        const entry = dailyMap.get(day);
        entry.requests += row.Requests || 0;
        entry.inputTokens += inputTokens;
        entry.outputTokens += outputTokens;
        entry.cost += cost;

        if (!entry.models[model]) {
          entry.models[model] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        }
        entry.models[model].requests += row.Requests || 0;
        entry.models[model].inputTokens += inputTokens;
        entry.models[model].outputTokens += outputTokens;
        entry.models[model].cost += cost;
      }

      // Convert to sorted array
      const dailyData = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          ...d,
          cost: Math.round(d.cost * 10000) / 10000,
          models: Object.fromEntries(
            Object.entries(d.models).map(([k, v]) => [k, { ...v, cost: Math.round(v.cost * 10000) / 10000 }])
          )
        }));

      // Compute totals
      const totals = dailyData.reduce((acc, d) => ({
        requests: acc.requests + d.requests,
        inputTokens: acc.inputTokens + d.inputTokens,
        outputTokens: acc.outputTokens + d.outputTokens,
        cost: acc.cost + d.cost
      }), { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 });

      return successResponse({
        period: `last_${days}_days`,
        days: dailyData,
        totals: {
          ...totals,
          cost: Math.round(totals.cost * 100) / 100
        }
      });

    } catch (err) {
      context.error('dashboard-daily error:', err);
      return errorResponse(`Failed to fetch daily usage: ${err.message}`);
    }
  }
});

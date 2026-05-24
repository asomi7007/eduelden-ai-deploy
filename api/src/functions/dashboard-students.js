'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { getStudentUsage, getStudentDetail, getStudentHourly, estimateTokens, estimateCost } = require('../lib/log-analytics');
const { listStudentSubscriptions, getSubscriptionDetails } = require('../lib/azure-client');

/**
 * GET /api/dashboard/students
 * Lists all students with their usage summary.
 * Query params: days (default 30), sort (requests|cost|tokens, default requests)
 */
app.http('dashboardStudentsList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/students',
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
      const sortBy = url.searchParams.get('sort') || 'requests';

      // Fetch usage data and subscription states in parallel
      const [usageRows, subscriptions] = await Promise.all([
        getStudentUsage(days),
        listStudentSubscriptions().catch(() => [])
      ]);

      // Build subscription state map
      const subStateMap = new Map();
      for (const sub of subscriptions) {
        const name = sub.name || sub.properties?.displayName || '';
        subStateMap.set(name, sub.properties?.state || 'unknown');
      }

      // Process usage data
      const students = usageRows.map(row => {
        const subId = row.ApimSubscriptionId || 'unknown';
        const inputTokens = estimateTokens(row.RequestBytes);
        const outputTokens = estimateTokens(row.ResponseBytes);

        // Estimate cost using dominant model (simplified)
        const models = row.Models || [];
        const primaryModel = models.length > 0 ? models[0] : 'unknown';
        const cost = estimateCost(primaryModel, inputTokens, outputTokens);

        // Extract student number from subscription ID
        const numMatch = subId.match(/(\d{2})$/);
        const studentNum = numMatch ? numMatch[1] : subId;

        return {
          subscriptionId: subId,
          studentNumber: studentNum,
          state: subStateMap.get(subId) || 'unknown',
          requests: row.Requests || 0,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost: Math.round(cost * 10000) / 10000,
          lastActive: row.LastActive || null,
          models
        };
      });

      // Sort
      const sortFns = {
        requests: (a, b) => b.requests - a.requests,
        cost: (a, b) => b.estimatedCost - a.estimatedCost,
        tokens: (a, b) => b.totalTokens - a.totalTokens
      };
      students.sort(sortFns[sortBy] || sortFns.requests);

      // Include students with no usage (inactive)
      const usedSubIds = new Set(students.map(s => s.subscriptionId));
      for (let i = 1; i <= 50; i++) {
        const subId = `sub-student-${String(i).padStart(2, '0')}`;
        if (!usedSubIds.has(subId)) {
          students.push({
            subscriptionId: subId,
            studentNumber: String(i).padStart(2, '0'),
            state: subStateMap.get(subId) || 'unknown',
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            lastActive: null,
            models: []
          });
        }
      }

      return successResponse({
        period: `last_${days}_days`,
        totalStudents: 50,
        activeStudents: students.filter(s => s.requests > 0).length,
        students
      });

    } catch (err) {
      context.error('dashboard-students error:', err);
      return errorResponse(`Failed to fetch student list: ${err.message}`);
    }
  }
});

/**
 * GET /api/dashboard/students/:id
 * Returns detailed usage for a single student.
 * Query params: days (default 30)
 */
app.http('dashboardStudentDetail', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/students/{studentId}',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const studentId = request.params.studentId;
      const url = new URL(request.url);
      const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90);

      // Normalize subscription ID
      const subscriptionId = studentId.startsWith('sub-student-')
        ? studentId
        : `sub-student-${studentId.padStart(2, '0')}`;

      // Fetch detail, hourly, and subscription info in parallel
      const [dailyRows, hourlyRows, subDetails] = await Promise.all([
        getStudentDetail(subscriptionId, days),
        getStudentHourly(subscriptionId),
        getSubscriptionDetails(subscriptionId).catch(() => null)
      ]);

      // Process daily data
      const daily = dailyRows.map(row => {
        const model = row.Model || 'unknown';
        const inputTokens = estimateTokens(row.RequestBytes);
        const outputTokens = estimateTokens(row.ResponseBytes);
        return {
          date: row.Day ? new Date(row.Day).toISOString().split('T')[0] : 'unknown',
          model,
          requests: row.Requests || 0,
          inputTokens,
          outputTokens,
          cost: Math.round(estimateCost(model, inputTokens, outputTokens) * 10000) / 10000
        };
      });

      // Process hourly (today)
      const hourly = hourlyRows.map(row => {
        const model = row.Model || 'unknown';
        const inputTokens = estimateTokens(row.RequestBytes);
        const outputTokens = estimateTokens(row.ResponseBytes);
        return {
          hour: row.Hour ? new Date(row.Hour).toISOString() : 'unknown',
          model,
          requests: row.Requests || 0,
          inputTokens,
          outputTokens,
          cost: Math.round(estimateCost(model, inputTokens, outputTokens) * 10000) / 10000
        };
      });

      // Totals
      const totals = daily.reduce((acc, d) => ({
        requests: acc.requests + d.requests,
        inputTokens: acc.inputTokens + d.inputTokens,
        outputTokens: acc.outputTokens + d.outputTokens,
        cost: acc.cost + d.cost
      }), { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 });

      return successResponse({
        subscriptionId,
        subscription: subDetails,
        period: `last_${days}_days`,
        totals: {
          ...totals,
          cost: Math.round(totals.cost * 100) / 100
        },
        daily,
        today: hourly
      });

    } catch (err) {
      context.error('dashboard-student-detail error:', err);
      return errorResponse(`Failed to fetch student detail: ${err.message}`);
    }
  }
});

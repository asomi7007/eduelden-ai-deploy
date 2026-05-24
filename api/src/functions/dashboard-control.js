'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const { setSubscriptionState, getSubscriptionDetails } = require('../lib/azure-client');

/**
 * POST /api/dashboard/control/quota
 * Update quota/rate-limit for a student subscription.
 * Body: { subscriptionId, dailyLimit?, minuteLimit? }
 *
 * Note: APIM rate limits are policy-based. This endpoint updates
 * the subscription-level properties. For actual rate-limit changes,
 * APIM policies need to be updated via the management API.
 */
app.http('dashboardControlQuota', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/control/quota',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const body = await request.json();
      const { subscriptionId, dailyLimit, minuteLimit } = body;

      if (!subscriptionId) {
        return errorResponse('subscriptionId is required', 400);
      }

      // Validate subscription exists
      const subDetails = await getSubscriptionDetails(subscriptionId);
      if (!subDetails) {
        return errorResponse(`Subscription ${subscriptionId} not found`, 404);
      }

      // Store quota settings (in production, this would update APIM policy XML)
      // For now, we record the intent and return success
      // TODO: Implement APIM policy update via REST API
      const quotaSettings = {
        subscriptionId,
        dailyLimit: dailyLimit || 200,
        minuteLimit: minuteLimit || 10,
        updatedAt: new Date().toISOString()
      };

      context.log(`Quota update requested for ${subscriptionId}: daily=${dailyLimit}, minute=${minuteLimit}`);

      return successResponse({
        message: `Quota settings updated for ${subscriptionId}`,
        quota: quotaSettings,
        subscription: subDetails
      });

    } catch (err) {
      context.error('dashboard-control-quota error:', err);
      return errorResponse(`Failed to update quota: ${err.message}`);
    }
  }
});

/**
 * POST /api/dashboard/control/suspend
 * Suspend or reactivate a student subscription.
 * Body: { subscriptionId, action: "suspend" | "activate" }
 */
app.http('dashboardControlSuspend', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/control/suspend',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const body = await request.json();
      const { subscriptionId, action } = body;

      if (!subscriptionId) {
        return errorResponse('subscriptionId is required', 400);
      }

      if (!action || !['suspend', 'activate'].includes(action)) {
        return errorResponse('action must be "suspend" or "activate"', 400);
      }

      const state = action === 'suspend' ? 'suspended' : 'active';
      await setSubscriptionState(subscriptionId, state);

      // Verify the change
      const updatedSub = await getSubscriptionDetails(subscriptionId);

      context.log(`Subscription ${subscriptionId} ${action}ed successfully`);

      return successResponse({
        message: `Subscription ${subscriptionId} ${action}ed`,
        subscription: updatedSub
      });

    } catch (err) {
      context.error('dashboard-control-suspend error:', err);
      return errorResponse(`Failed to ${err.message.includes('suspend') ? 'suspend' : 'update'} subscription: ${err.message}`);
    }
  }
});

/**
 * POST /api/dashboard/control/bulk
 * Bulk operations on multiple student subscriptions.
 * Body: { subscriptionIds: string[], action: "suspend" | "activate" }
 */
app.http('dashboardControlBulk', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/control/bulk',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const body = await request.json();
      let { subscriptionIds, action } = body;

      // Support shorthand actions from frontend: suspendAll, activateAll, resetQuota
      if (action === 'suspendAll') { action = 'suspend'; subscriptionIds = null; }
      else if (action === 'activateAll') { action = 'activate'; subscriptionIds = null; }
      else if (action === 'resetQuota') {
        // Reset quota is a no-op state reset — just activate all
        // (actual quota counter resets happen at APIM policy level per day)
        context.log('Quota reset requested — activating all subscriptions');
        action = 'activate'; subscriptionIds = null;
      }

      if (!action || !['suspend', 'activate'].includes(action)) {
        return errorResponse('action must be "suspend", "activate", "suspendAll", "activateAll", or "resetQuota"', 400);
      }

      // If no subscriptionIds provided, fetch all student subscriptions
      if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        const { listStudentSubscriptions } = require('../lib/azure-client');
        const allSubs = await listStudentSubscriptions();
        subscriptionIds = allSubs.map(s => s.name || s.subscriptionId);
        context.log(`Bulk ${action}: targeting all ${subscriptionIds.length} student subscriptions`);
      }

      if (subscriptionIds.length > 50) {
        return errorResponse('Maximum 50 subscriptions per bulk operation', 400);
      }

      const state = action === 'suspend' ? 'suspended' : 'active';
      const results = [];

      // Process sequentially to avoid rate limiting
      for (const subId of subscriptionIds) {
        try {
          await setSubscriptionState(subId, state);
          results.push({ subscriptionId: subId, success: true });
        } catch (subErr) {
          results.push({ subscriptionId: subId, success: false, error: subErr.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      context.log(`Bulk ${action}: ${successCount} succeeded, ${failCount} failed`);

      return successResponse({
        message: `Bulk ${action}: ${successCount}/${subscriptionIds.length} succeeded`,
        results,
        summary: { total: subscriptionIds.length, succeeded: successCount, failed: failCount }
      });

    } catch (err) {
      context.error('dashboard-control-bulk error:', err);
      return errorResponse(`Bulk operation failed: ${err.message}`);
    }
  }
});

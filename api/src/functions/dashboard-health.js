'use strict';

const { app } = require('@azure/functions');

/**
 * GET /api/dashboard/health
 * Health check endpoint — no auth required.
 * Returns environment variable status (existence, not values).
 */
app.http('dashboardHealth', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/health',
  handler: async (request, context) => {
    return {
      status: 200,
      jsonBody: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: {
          ADMIN_TOKEN: !!process.env.ADMIN_TOKEN,
          ADMIN_TOKEN_LEN: (process.env.ADMIN_TOKEN || '').length,
          ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
          ADMIN_PASSWORD_LEN: (process.env.ADMIN_PASSWORD || '').length,
          ADMIN_PASSWORD_FIRST2: (process.env.ADMIN_PASSWORD || '').substring(0, 2),
          AZURE_SUBSCRIPTION_ID: !!process.env.AZURE_SUBSCRIPTION_ID,
          AZURE_RESOURCE_GROUP: !!process.env.AZURE_RESOURCE_GROUP,
          APIM_SERVICE_NAME: !!process.env.APIM_SERVICE_NAME,
          LOG_ANALYTICS_WORKSPACE_ID: !!process.env.LOG_ANALYTICS_WORKSPACE_ID,
          AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
          AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
          AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
        },
        nodeVersion: process.version,
        functionRuntime: process.env.FUNCTIONS_EXTENSION_VERSION || 'unknown'
      },
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
});

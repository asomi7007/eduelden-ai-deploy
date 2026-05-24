'use strict';

const { app } = require('@azure/functions');
const { verifyAdmin, handleCors, successResponse, errorResponse } = require('../lib/auth');
const path = require('path');
const fs = require('fs');

/**
 * Alert settings storage.
 * Uses a local JSON file for simplicity. In production, migrate to Azure Table Storage.
 */

const ALERTS_FILE = path.join(__dirname, '..', '..', 'data', 'alerts.json');

function getDefaultAlerts() {
  return {
    budgetThresholds: [
      { percent: 50, notify: true, action: 'email', label: '50% budget used' },
      { percent: 80, notify: true, action: 'email', label: '80% budget used' },
      { percent: 95, notify: true, action: 'suspend_all', label: '95% budget — suspend all' }
    ],
    studentThresholds: {
      dailyRequests: 200,
      dailyCost: 5.0, // USD per student per day
      notifyAdmin: true,
      autoSuspend: false
    },
    notifications: {
      adminEmail: process.env.ADMIN_EMAIL || 'admin@eldensoluton.kr',
      enabled: true,
      channels: ['email']
    },
    updatedAt: new Date().toISOString()
  };
}

function loadAlerts() {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch {
    // Fall through to defaults
  }
  return getDefaultAlerts();
}

function saveAlerts(alerts) {
  const dir = path.dirname(ALERTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  alerts.updatedAt = new Date().toISOString();
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
}

/**
 * GET /api/dashboard/alerts
 * Returns current alert/threshold settings.
 */
app.http('dashboardAlertsGet', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/alerts',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const alerts = loadAlerts();
      return successResponse(alerts);
    } catch (err) {
      context.error('dashboard-alerts-get error:', err);
      return errorResponse(`Failed to load alert settings: ${err.message}`);
    }
  }
});

/**
 * POST /api/dashboard/alerts
 * Update alert/threshold settings.
 * Body: partial or full alert settings object
 */
app.http('dashboardAlertsUpdate', {
  methods: ['POST', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'dashboard/alerts',
  handler: async (request, context) => {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const auth = await verifyAdmin(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error, 401);
    }

    try {
      const body = await request.json();
      const current = loadAlerts();

      // Merge updates
      if (body.budgetThresholds && Array.isArray(body.budgetThresholds)) {
        // Validate thresholds
        for (const t of body.budgetThresholds) {
          if (typeof t.percent !== 'number' || t.percent < 0 || t.percent > 100) {
            return errorResponse('Each budgetThreshold must have percent between 0-100', 400);
          }
        }
        current.budgetThresholds = body.budgetThresholds;
      }

      if (body.studentThresholds) {
        current.studentThresholds = {
          ...current.studentThresholds,
          ...body.studentThresholds
        };
      }

      if (body.notifications) {
        current.notifications = {
          ...current.notifications,
          ...body.notifications
        };
      }

      saveAlerts(current);
      context.log('Alert settings updated');

      return successResponse({
        message: 'Alert settings updated successfully',
        alerts: current
      });

    } catch (err) {
      context.error('dashboard-alerts-update error:', err);
      return errorResponse(`Failed to update alert settings: ${err.message}`);
    }
  }
});

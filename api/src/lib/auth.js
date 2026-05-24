'use strict';

/**
 * Admin authentication middleware for dashboard API.
 * Supports two auth methods:
 *   1. Bearer token in Authorization header (ADMIN_TOKEN env var)
 *   2. adminPw field in request body (ADMIN_PASSWORD env var, legacy compat)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Verify admin authentication from request.
 * @param {import('@azure/functions').HttpRequest} request
 * @returns {{ authenticated: boolean, error?: string }}
 */
async function verifyAdmin(request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Method 1: Bearer token
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (adminToken && token === adminToken) {
      return { authenticated: true };
    }
    // Also accept ADMIN_PASSWORD as bearer token for backward compat
    if (adminPassword && token === adminPassword) {
      return { authenticated: true };
    }
    return { authenticated: false, error: 'Invalid bearer token' };
  }

  // Method 2: Body adminPw (for legacy admin.js compat)
  try {
    const body = await request.clone().json();
    if (body && body.adminPw) {
      if (adminPassword && body.adminPw === adminPassword) {
        return { authenticated: true };
      }
      if (adminToken && body.adminPw === adminToken) {
        return { authenticated: true };
      }
      return { authenticated: false, error: 'Invalid admin password' };
    }
  } catch {
    // No JSON body or parse error — not an auth failure by itself
  }

  return { authenticated: false, error: 'No authentication provided. Use Bearer token or adminPw in body.' };
}

/**
 * Handle CORS preflight.
 * @param {import('@azure/functions').HttpRequest} request
 * @returns {object|null} Response if OPTIONS, null otherwise
 */
function handleCors(request) {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }
  return null;
}

/**
 * Create a JSON response with CORS headers.
 */
function jsonResponse(data, status = 200) {
  return {
    status,
    jsonBody: data,
    headers: CORS_HEADERS
  };
}

/**
 * Create an error response.
 */
function errorResponse(message, status = 500) {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Create a success response.
 */
function successResponse(data) {
  return jsonResponse({ success: true, data });
}

module.exports = {
  verifyAdmin,
  handleCors,
  jsonResponse,
  errorResponse,
  successResponse,
  CORS_HEADERS
};

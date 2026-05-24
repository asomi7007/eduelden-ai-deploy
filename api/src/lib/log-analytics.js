'use strict';

const { DefaultAzureCredential } = require('@azure/identity');
const { LogsQueryClient } = require('@azure/monitor-query');

/**
 * Log Analytics KQL query client with in-memory caching.
 * Queries ApiManagementGatewayLogs for token usage data.
 */

// In-memory cache: key -> { data, expiresAt }
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _client = null;

function getClient() {
  if (!_client) {
    const credential = new DefaultAzureCredential();
    _client = new LogsQueryClient(credential);
  }
  return _client;
}

function getWorkspaceId() {
  const id = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!id) throw new Error('LOG_ANALYTICS_WORKSPACE_ID env var not set');
  return id;
}

/**
 * Execute a KQL query with caching.
 * @param {string} query - KQL query string
 * @param {object} [options] - { timespan, cacheKey }
 * @returns {Promise<Array<object>>} rows as objects
 */
async function queryLogs(query, options = {}) {
  const { timespan, cacheKey } = options;
  const key = cacheKey || query;

  // Check cache
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const client = getClient();
  const workspaceId = getWorkspaceId();

  const result = await client.queryWorkspace(
    workspaceId,
    query,
    { duration: timespan || 'P30D' }
  );

  if (result.status === 'Failed' || result.status === 'PartialFailed') {
    throw new Error(`KQL query failed: ${result.error?.message || 'Unknown error'}`);
  }

  // Convert tables to array of objects
  const rows = [];
  if (result.tables && result.tables.length > 0) {
    const table = result.tables[0];
    const columns = table.columns.map(c => c.name);
    for (const row of table.rows) {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      rows.push(obj);
    }
  }

  // Cache result
  _cache.set(key, { data: rows, expiresAt: Date.now() + CACHE_TTL_MS });

  return rows;
}

/**
 * Clear the query cache (useful for forced refresh).
 */
function clearCache() {
  _cache.clear();
}

// --- Cost estimation ---

const COST_RATES = {
  'gpt-54-mini': { input: 0.0004, output: 0.0016 },   // per 1K tokens
  'gpt-55': { input: 0.005, output: 0.015 },
  'deepseek-v4-flash': { input: 0.00014, output: 0.00028 }
};

/**
 * Estimate token count from byte size (rough: 1 token ~ 4 bytes).
 */
function estimateTokens(bytes) {
  return Math.ceil((bytes || 0) / 4);
}

/**
 * Extract model name from URL path.
 * URL pattern: /deployments/{model-name}/...
 */
function extractModelFromUrl(url) {
  if (!url) return 'unknown';
  const match = url.match(/\/deployments\/([^/]+)\//);
  return match ? match[1] : 'unknown';
}

/**
 * Estimate cost for a given model and token counts.
 * @param {string} model - model deployment name
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} estimated cost in USD
 */
function estimateCost(model, inputTokens, outputTokens) {
  // Try to match model name to known rates
  const normalizedModel = model.toLowerCase();
  let rates = null;

  for (const [key, value] of Object.entries(COST_RATES)) {
    if (normalizedModel.includes(key.replace('-', ''))) {
      rates = value;
      break;
    }
    if (normalizedModel.includes(key)) {
      rates = value;
      break;
    }
  }

  // Fuzzy match
  if (!rates) {
    if (normalizedModel.includes('mini')) {
      rates = COST_RATES['gpt-54-mini'];
    } else if (normalizedModel.includes('gpt')) {
      rates = COST_RATES['gpt-55'];
    } else if (normalizedModel.includes('deepseek')) {
      rates = COST_RATES['deepseek-v4-flash'];
    } else {
      // Default to cheapest
      rates = COST_RATES['deepseek-v4-flash'];
    }
  }

  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// --- Pre-built KQL queries ---

/**
 * Get total usage summary for a time range.
 */
async function getUsageSummary(days = 30) {
  const query = `
ApiManagementGatewayLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| summarize
    TotalRequests = count(),
    TotalRequestBytes = sum(RequestSize),
    TotalResponseBytes = sum(ResponseSize),
    AvgLatencyMs = avg(TotalTime),
    UniqueStudents = dcount(ApimSubscriptionId)
  by Model
`;
  return queryLogs(query, { cacheKey: `summary_${days}d` });
}

/**
 * Get daily usage breakdown.
 */
async function getDailyUsage(days = 30) {
  const query = `
ApiManagementGatewayLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| extend Day = bin(TimeGenerated, 1d)
| summarize
    Requests = count(),
    RequestBytes = sum(RequestSize),
    ResponseBytes = sum(ResponseSize)
  by Day, Model
| order by Day asc
`;
  return queryLogs(query, { cacheKey: `daily_${days}d` });
}

/**
 * Get per-student usage.
 */
async function getStudentUsage(days = 30) {
  const query = `
ApiManagementGatewayLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| summarize
    Requests = count(),
    RequestBytes = sum(RequestSize),
    ResponseBytes = sum(ResponseSize),
    LastActive = max(TimeGenerated),
    Models = make_set(Model)
  by ApimSubscriptionId
| order by Requests desc
`;
  return queryLogs(query, { cacheKey: `students_${days}d` });
}

/**
 * Get single student's detailed usage.
 */
async function getStudentDetail(subscriptionId, days = 30) {
  const query = `
ApiManagementGatewayLogs
| where TimeGenerated > ago(${days}d)
| where ApimSubscriptionId == "${subscriptionId}"
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| extend Day = bin(TimeGenerated, 1d)
| summarize
    Requests = count(),
    RequestBytes = sum(RequestSize),
    ResponseBytes = sum(ResponseSize)
  by Day, Model
| order by Day asc
`;
  return queryLogs(query, { cacheKey: `student_${subscriptionId}_${days}d` });
}

/**
 * Get student's hourly usage for today.
 */
async function getStudentHourly(subscriptionId) {
  const query = `
ApiManagementGatewayLogs
| where TimeGenerated > ago(1d)
| where ApimSubscriptionId == "${subscriptionId}"
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| extend Hour = bin(TimeGenerated, 1h)
| summarize
    Requests = count(),
    RequestBytes = sum(RequestSize),
    ResponseBytes = sum(ResponseSize)
  by Hour, Model
| order by Hour asc
`;
  return queryLogs(query, { cacheKey: `student_hourly_${subscriptionId}` });
}

module.exports = {
  queryLogs,
  clearCache,
  estimateTokens,
  extractModelFromUrl,
  estimateCost,
  getUsageSummary,
  getDailyUsage,
  getStudentUsage,
  getStudentDetail,
  getStudentHourly,
  COST_RATES
};

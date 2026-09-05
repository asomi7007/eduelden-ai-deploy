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

// Azure 공식 가격표 기준 (2026-09-05 확인, Global Standard, per 1M tokens USD)
// https://azure.microsoft.com/en-us/pricing/details/azure-openai/
// https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/grok/
// https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/deepseek/
const COST_RATES = {
  // GPT-5.6 시리즈 (short context Global)
  'gpt-5.6-luna':  { input: 0.20, output: 1.20 },
  'gpt-5.6-sol':   { input: 5.00, output: 30.00 },
  'gpt-5.6-terra': { input: 2.00, output: 12.00 },
  // GPT-Chat Latest (08062026 Global)
  'gpt-chat-latest': { input: 5.00, output: 30.00 },
  // Grok (Foundry serverless, Global)
  'grok-4.6':     { input: 1.25, output: 2.50 },   // Grok-4.2/4.3 Global 기준
  'grok-4':       { input: 3.00, output: 15.00 },
  'grok-4-fast':  { input: 0.20, output: 0.50 },
  'grok-3':       { input: 3.00, output: 15.00 },
  'grok-3-mini':  { input: 0.25, output: 1.27 },
  // DeepSeek (Foundry serverless, Global)
  'deepseek-v4-flash': { input: 0.19, output: 0.51 },
  'deepseek-v4-pro':   { input: 1.74, output: 3.48 },
  'deepseek-r1':       { input: 1.35, output: 5.40 },
  'deepseek-v3':       { input: 1.14, output: 4.56 },
  // 기존 호환 (per 1K → 1M 환산)
  'gpt-54-mini':  { input: 0.40, output: 1.60 },
  'gpt-55':       { input: 5.00, output: 15.00 },
  // model-router: 실제 라우팅 결과물은 응답 model 필드 기준으로 개별 계산됨
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
  // rates are per 1M tokens (Azure 공식 가격표 기준)
  const normalizedModel = model.toLowerCase();
  let rates = null;

  // exact match 우선
  if (COST_RATES[normalizedModel]) {
    rates = COST_RATES[normalizedModel];
  }
  // prefix/contains 매칭 (롱컨텍스트 등 변형 포함)
  if (!rates) {
    for (const [key, value] of Object.entries(COST_RATES)) {
      if (normalizedModel.includes(key)) {
        rates = value;
        break;
      }
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

  return (inputTokens / 1e6) * rates.input + (outputTokens / 1e6) * rates.output;
}

// --- Pre-built KQL queries ---
// NOTE: APIM diagnostic logs exist in TWO tables due to a mode switch:
//   - AzureDiagnostics (legacy, before resource-specific mode was enabled)
//     Column names use _s/_d suffixes, no ApimSubscriptionId
//   - ApiManagementGatewayLogs (resource-specific, new data)
//     Proper column names including ApimSubscriptionId
// We union both tables and normalize column names for full coverage.

/**
 * Common KQL fragment: union both log tables with normalized columns.
 * AzureDiagnostics rows get ApimSubscriptionId = "unknown" (not available in that mode).
 */
const UNIFIED_LOGS = `
let UnifiedLogs = union isfuzzy=true
  (ApiManagementGatewayLogs
   | extend _SubId = tostring(ApimSubscriptionId)
   | extend _HeaderVal = tostring(BackendRequestHeaders["X-Student-Id"])
   | extend StudentId = case(
       isnotempty(_SubId), _SubId,
       isnotempty(_HeaderVal), strcat("sub-student-", _HeaderVal),
       "unknown"
     )
   | project TimeGenerated, ResponseCode=toint(ResponseCode), RequestSize=tolong(RequestSize), ResponseSize=tolong(ResponseSize), BackendUrl=Url, TotalTimeMs=toreal(TotalTime), ApimSubscriptionId=StudentId),
  (AzureDiagnostics
   | where Category == 'GatewayLogs'
   | project TimeGenerated, ResponseCode=toint(responseCode_d), RequestSize=tolong(requestSize_d), ResponseSize=tolong(responseSize_d), BackendUrl=backendUrl_s, TotalTimeMs=toreal(DurationMs), ApimSubscriptionId="unknown");
`;

/**
 * Get total usage summary for a time range.
 */
async function getUsageSummary(days = 30) {
  const query = `
${UNIFIED_LOGS}
UnifiedLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, BackendUrl)
| summarize
    TotalRequests = count(),
    TotalRequestBytes = sum(RequestSize),
    TotalResponseBytes = sum(ResponseSize),
    AvgLatencyMs = avg(TotalTimeMs),
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
${UNIFIED_LOGS}
UnifiedLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, BackendUrl)
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
 * NOTE: Historical data from AzureDiagnostics has ApimSubscriptionId="unknown"
 * because that field wasn't available in AzureDiagnostics mode.
 * Only data after resource-specific mode was enabled has real subscription IDs.
 */
async function getStudentUsage(days = 30) {
  const query = `
${UNIFIED_LOGS}
UnifiedLogs
| where TimeGenerated > ago(${days}d)
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, BackendUrl)
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
${UNIFIED_LOGS}
UnifiedLogs
| where TimeGenerated > ago(${days}d)
| where ApimSubscriptionId == "${subscriptionId}"
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, BackendUrl)
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
${UNIFIED_LOGS}
UnifiedLogs
| where TimeGenerated > ago(1d)
| where ApimSubscriptionId == "${subscriptionId}"
| where ResponseCode >= 200 and ResponseCode < 300
| extend Model = extract("/deployments/([^/]+)/", 1, BackendUrl)
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

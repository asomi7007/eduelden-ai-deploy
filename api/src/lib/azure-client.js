'use strict';

const { DefaultAzureCredential } = require('@azure/identity');

/**
 * Azure APIM Management REST API client.
 * Uses DefaultAzureCredential (Managed Identity in prod, az login locally).
 */

const APIM_API_VERSION = '2022-08-01';

let _credential = null;

function getCredential() {
  if (!_credential) {
    _credential = new DefaultAzureCredential();
  }
  return _credential;
}

/**
 * Get a Bearer token for Azure Management API.
 */
async function getManagementToken() {
  const credential = getCredential();
  const tokenResponse = await credential.getToken('https://management.azure.com/.default');
  return tokenResponse.token;
}

/**
 * Build the APIM base URL for REST calls.
 */
function getApimBasePath() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const serviceName = process.env.APIM_SERVICE_NAME || 'apim-eduelden-ai';
  return `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.ApiManagement/service/${serviceName}`;
}

/**
 * Make an authenticated request to Azure Management API.
 */
async function apimRequest(path, options = {}) {
  const token = await getManagementToken();
  const basePath = getApimBasePath();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${basePath}${path}${separator}api-version=${APIM_API_VERSION}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`APIM API error ${response.status}: ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * List all subscriptions in APIM (student subscriptions).
 * @param {string} [filter] - OData filter expression
 * @returns {Promise<Array>} subscription list
 */
async function listSubscriptions(filter) {
  let path = '/subscriptions';
  if (filter) {
    path += `?$filter=${encodeURIComponent(filter)}`;
  }
  const result = await apimRequest(path);
  return result.value || [];
}

/**
 * Get a single subscription by ID.
 * @param {string} subscriptionId - e.g., "sub-student-01"
 */
async function getSubscription(subscriptionId) {
  return apimRequest(`/subscriptions/${subscriptionId}`);
}

/**
 * Change subscription state (active, suspended, cancelled).
 * @param {string} subscriptionId
 * @param {string} state - "active" | "suspended" | "cancelled"
 */
async function setSubscriptionState(subscriptionId, state) {
  const subscription = await getSubscription(subscriptionId);
  const etag = subscription?.properties?.stateComment || '*';

  return apimRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: { 'If-Match': '*' },
    body: JSON.stringify({
      properties: {
        state
      }
    })
  });
}

/**
 * Get subscription usage/analytics (quota info from subscription properties).
 */
async function getSubscriptionDetails(subscriptionId) {
  const sub = await getSubscription(subscriptionId);
  return {
    id: subscriptionId,
    displayName: sub.properties?.displayName || subscriptionId,
    state: sub.properties?.state || 'unknown',
    createdDate: sub.properties?.createdDate,
    startDate: sub.properties?.startDate,
    expirationDate: sub.properties?.expirationDate
  };
}

/**
 * List all student subscriptions (sub-student-01 to sub-student-50).
 */
async function listStudentSubscriptions() {
  const allSubs = await listSubscriptions();
  return allSubs.filter(s => {
    const name = s.name || s.properties?.displayName || '';
    return name.startsWith('sub-student-') || (s.properties?.displayName || '').startsWith('sub-student-');
  });
}

module.exports = {
  getCredential,
  getManagementToken,
  apimRequest,
  listSubscriptions,
  getSubscription,
  setSubscriptionState,
  getSubscriptionDetails,
  listStudentSubscriptions
};

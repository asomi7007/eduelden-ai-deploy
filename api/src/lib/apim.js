'use strict';

/**
 * APIM subscription management helpers (ARM REST via DefaultAzureCredential).
 * Reuses getManagementToken/apimRequest pattern from azure-client.js.
 */

const { getApimBasePath } = require('./azure-client-ext');

const API_VERSION = '2022-08-01';

async function armRequest(method, path, body, context) {
  const { getManagementToken } = require('./azure-client-ext');
  const token = await getManagementToken();
  const base = getApimBasePath();
  const url = `${base}${path}?api-version=${API_VERSION}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 204) {
    const text = await res.text();
    throw new Error(`APIM ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** 참가자/팀용 구독 생성 → primaryKey 반환 (한 번만 노출) */
async function createLabSubscription(subscriptionId, displayName) {
  const productId = process.env.APIM_PRODUCT_ID || 'hands-on-ai';
  const base = getApimBasePath();
  const scope = `${base}/products/${productId}`;
  await armRequest('PUT', `/subscriptions/${subscriptionId}`, {
    properties: { displayName, scope, state: 'active', allowTracing: false },
  });
  const secrets = await armRequest('POST', `/subscriptions/${subscriptionId}/listSecrets`);
  return { primaryKey: secrets.primaryKey, secondaryKey: secrets.secondaryKey };
}

async function regenerateKey(subscriptionId, which) {
  const keyName = which === 'secondary' ? 'secondary' : 'primary';
  const secrets = await armRequest('POST', `/subscriptions/${subscriptionId}/regenerateKey?keyType=${keyName}`);
  return { primaryKey: secrets.primaryKey, secondaryKey: secrets.secondaryKey };
}

async function setSubscriptionState(subscriptionId, state) {
  const cur = await armRequest('GET', `/subscriptions/${subscriptionId}`);
  await armRequest('PUT', `/subscriptions/${subscriptionId}`, {
    properties: { ...cur.properties, state },
  });
  return { ok: true, state };
}

async function deleteSubscription(subscriptionId) {
  await armRequest('DELETE', `/subscriptions/${subscriptionId}`);
  return { ok: true };
}

function maskKey(key) {
  if (!key) return '';
  return `sk-apim-****${key.slice(-4).toUpperCase()}`;
}

module.exports = { createLabSubscription, regenerateKey, setSubscriptionState, deleteSubscription, maskKey };

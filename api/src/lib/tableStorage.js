'use strict';

/**
 * Azure Table Storage data layer (Models / Workshops / AccessKeys / AuditLogs).
 * Uses account key from env (local) or Managed Identity in production
 * via azure-data-tables TableServiceClient.
 */

const { TableServiceClient, AzureNamedKeyCredential, TableClient } = require('@azure/data-tables');

const ACCOUNT = process.env.STORAGE_ACCOUNT_NAME || 'steudeldenadmin';
const TABLES = { models: 'Models', workshops: 'Workshops', keys: 'AccessKeys', audit: 'AuditLogs' };

let _service;

function getService() {
  if (_service) return _service;
  const endpoint = `https://${ACCOUNT}.table.core.windows.net`;
  const key = process.env.STORAGE_ACCOUNT_KEY;
  if (key) {
    _service = new TableServiceClient(endpoint, new AzureNamedKeyCredential(ACCOUNT, key));
  } else {
    // Managed Identity (Functions) — @azure/identity required at runtime
    const { DefaultAzureCredential } = require('@azure/identity');
    _service = new TableServiceClient(endpoint, new DefaultAzureCredential());
  }
  return _service;
}

function getTable(name) {
  const endpoint = `https://${ACCOUNT}.table.core.windows.net`;
  const key = process.env.STORAGE_ACCOUNT_KEY;
  const credential = key
    ? new AzureNamedKeyCredential(ACCOUNT, key)
    : new (require('@azure/identity').DefaultAzureCredential)({ managedIdentityClientId: process.env.MANAGED_IDENTITY_CLIENT_ID });
  return new TableClient(endpoint, TABLES[name], credential);
}

// ---------- Models ----------
async function listModels() {
  const t = getTable('models');
  const out = [];
  for await (const e of t.listEntities({ queryOptions: { filter: "PartitionKey eq 'MODEL'" } })) {
    out.push({
      modelId: e.rowKey,
      displayName: e.DisplayName,
      deploymentName: e.DeploymentName,
      modelType: e.ModelType,
      apiPath: e.ApiPath,
      enabled: e.Enabled,
      isDefault: e.IsDefault,
      displayOrder: e.DisplayOrder,
      updatedAt: e.UpdatedAt,
    });
  }
  out.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
  return out;
}

async function upsertModel(m) {
  const t = getTable('models');
  const now = new Date().toISOString();
  await t.upsertEntity({
    partitionKey: 'MODEL',
    rowKey: m.modelId,
    DisplayName: m.displayName || m.modelId,
    DeploymentName: m.deploymentName || m.modelId,
    ModelType: m.modelType || 'text',
    ApiPath: m.apiPath || '/v1/chat/completions',
    Enabled: m.enabled !== false,
    IsDefault: !!m.isDefault,
    DisplayOrder: m.displayOrder || 99,
    UpdatedAt: now,
  }, 'Replace');
  return { ok: true };
}

// ---------- Workshops ----------
function workshopFromEntity(e) {
  return {
    workshopId: e.rowKey,
    name: e.Name,
    validFrom: e.ValidFrom,
    expiresAt: e.ExpiresAt,
    allowedModels: (e.AllowedModels || '').split(',').filter(Boolean),
    requestsPerMinute: e.RequestsPerMinute || 10,
    dailyRequestLimit: e.DailyRequestLimit || 200,
    status: e.Status || 'PLANNED',
    org: e.Org || '',
    keyCount: e.KeyCount || 0,
    tokenLimitPerKey: e.TokenLimitPerKey || 0,
    createdAt: e.CreatedAt,
  };
}

async function listWorkshops() {
  const t = getTable('workshops');
  const out = [];
  for await (const e of t.listEntities()) out.push(workshopFromEntity(e));
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}

async function getWorkshop(id) {
  const t = getTable('workshops');
  try {
    return workshopFromEntity(await t.getEntity('WORKSHOP', id));
  } catch { return null; }
}

async function upsertWorkshop(w) {
  const t = getTable('workshops');
  const now = new Date().toISOString();
  await t.upsertEntity({
    partitionKey: 'WORKSHOP',
    rowKey: w.workshopId,
    Name: w.name,
    ValidFrom: w.validFrom,
    ExpiresAt: w.expiresAt,
    AllowedModels: (w.allowedModels || []).join(','),
    RequestsPerMinute: w.requestsPerMinute || 10,
    DailyRequestLimit: w.dailyRequestLimit || 200,
    Status: w.status || 'PLANNED',
    Org: w.org || '',
    KeyCount: w.keyCount || 0,
    TokenLimitPerKey: w.tokenLimitPerKey || 0,
    CreatedAt: w.createdAt || now,
  }, 'Replace');
  return { ok: true };
}

async function deleteWorkshopEntity(workshopId) {
  const t = getTable('workshops');
  await t.deleteEntity('WORKSHOP', workshopId);
  return { ok: true };
}

// ---------- AccessKeys ----------
function keyFromEntity(e) {
  return {
    keyId: e.rowKey,
    workshopId: e.WorkshopId,
    name: e.Name,
    owner: e.Owner || '',
    apimSubscriptionId: e.ApimSubscriptionId,
    maskedKey: e.MaskedKey || '',
    encryptedKey: e.EncryptedKey || '',
    status: e.Status || 'ACTIVE',
    issuedAt: e.IssuedAt,
    expiresAt: e.ExpiresAt,
    lastRotatedAt: e.LastRotatedAt,
  };
}

async function listKeys(workshopId) {
  const t = getTable('keys');
  const out = [];
  const filter = workshopId ? `PartitionKey eq '${workshopId}'` : undefined;
  for await (const e of t.listEntities({ queryOptions: filter ? { filter } : {} })) {
    out.push(keyFromEntity(e));
  }
  return out;
}

async function upsertKey(k) {
  const t = getTable('keys');
  await t.upsertEntity({
    partitionKey: k.workshopId,
    rowKey: k.keyId,
    WorkshopId: k.workshopId,
    Name: k.name,
    Owner: k.owner || '',
    ApimSubscriptionId: k.apimSubscriptionId,
    MaskedKey: k.maskedKey || '',
    EncryptedKey: k.encryptedKey || '',
    Status: k.status || 'ACTIVE',
    IssuedAt: k.issuedAt || new Date().toISOString(),
    ExpiresAt: k.expiresAt,
    LastRotatedAt: k.lastRotatedAt,
  }, 'Replace');
  return { ok: true };
}

async function deleteKeyEntity(workshopId, keyId) {
  const t = getTable('keys');
  await t.deleteEntity(workshopId, keyId);
  return { ok: true };
}

/** 활성 상태면서 만료시간이 지난 키 (타이머 폐기 대상) */
async function findExpiringKeys(nowIso) {
  const t = getTable('keys');
  const out = [];
  for await (const e of t.listEntities({ queryOptions: { filter: "Status eq 'ACTIVE'" } })) {
    if (e.ExpiresAt && e.ExpiresAt <= nowIso) out.push(keyFromEntity(e));
  }
  return out;
}

// ---------- AuditLogs ----------
async function writeAudit(action, detail, actor) {
  const t = getTable('audit');
  const ts = new Date().toISOString();
  const rowKey = `${ts.replace(/[^0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
  await t.upsertEntity({
    partitionKey: 'AUDIT',
    rowKey: rowKey,
    Action: action,
    Detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    Actor: actor || 'admin',
    Timestamp: ts,
  });
  return { ok: true };
}

async function listAudit(limit = 100) {
  const t = getTable('audit');
  const out = [];
  for await (const e of t.listEntities()) {
    out.push({ timestamp: e.Timestamp, action: e.Action, detail: e.Detail, actor: e.Actor });
  }
  out.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return out.slice(0, limit);
}

module.exports = {
  listModels, upsertModel,
  listWorkshops, getWorkshop, upsertWorkshop, deleteWorkshopEntity,
  listKeys, upsertKey, deleteKeyEntity, findExpiringKeys,
  writeAudit, listAudit,
};

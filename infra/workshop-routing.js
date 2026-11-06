'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_STUDENTS = 50;
const MAX_OUTPUT_TOKENS = 4096;
const tenants = {
  primary: {
    label: '기존 테넌트',
    subscriptionId: '08bfa8d7-3cb6-42d6-8214-18e784777a56',
    resourceGroup: 'rg-ai-poc-sandbox',
    account: 'ai-poc-sandbox-resource',
    backendId: 'backend-foundry-mi',
    baseUrl: 'https://ai-poc-sandbox-resource.openai.azure.com/openai',
  },
  secondary: {
    label: '추가 테넌트',
    subscriptionId: 'c85bfac0-4056-4d6c-956b-db1e5caf8248',
    resourceGroup: 'rg-asomi',
    account: 'asomi-4512-resource',
    backendId: 'backend-workshop-secondary',
    baseUrl: 'https://asomi-4512-resource.services.ai.azure.com/openai',
  },
};
const models = [
  {
    id: 'gpt-5.4-mini', name: 'GPT 5.4 mini', vision: true,
    responseModelPattern: '^gpt-5[.]4-mini(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?$',
    deployments: { primary: 'gpt-5.4-mini', secondary: 'gpt-5.4-mini-1' },
    tpm: { primary: 4000000, secondary: 10000000 },
    rpm: { primary: 4000, secondary: 10000 },
  },
  {
    id: 'Kimi-K3.1-Pro', name: 'Kimi K3.1 Pro', vision: false,
    responseModelPattern: '^Kimi-K3[.]1(?:-Pro)?$',
    deployments: { primary: 'Kimi-K3.1-Pro', secondary: 'Kimi-K3.1-Pro' },
    tpm: { primary: 100000, secondary: 100000 },
    rpm: { primary: 100, secondary: 100 },
  },
];

function assignTenant(studentId, modelId) {
  if (typeof studentId !== 'string' || !/^(0[1-9]|[1-4][0-9]|50)$/.test(studentId)) {
    throw new Error('Student ID must be 01 through 50.');
  }
  const model = models.find(item => item.id === modelId);
  if (!model) throw new Error('Unsupported workshop model.');
  const n = Number(studentId);
  const share = Math.min(
    model.tpm.primary / (model.tpm.primary + model.tpm.secondary),
    model.rpm.primary / (model.rpm.primary + model.rpm.secondary)
  );
  // Rounding cumulative shares spreads the smaller pool throughout every prefix.
  return Math.floor(n * share + 0.5) > Math.floor((n - 1) * share + 0.5)
    ? 'primary' : 'secondary';
}

function assignments(modelId, count = MAX_STUDENTS) {
  return Array.from({ length: count }, (_, i) => {
    const studentId = String(i + 1).padStart(2, '0');
    return { studentId, tenant: assignTenant(studentId, modelId) };
  });
}

function generatePolicy() {
  const xmlAttribute = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');
  const primaryIds = model => assignments(model.id)
    .filter(item => item.tenant === 'primary')
    .map(item => `"sub-student-${item.studentId}"`).join(', ');
  const modelList = JSON.stringify({
    object: 'list', data: models.map(model => ({ id: model.id, object: 'model', owned_by: 'eduelden' })),
  });
  const gpt = models[0];
  const kimi = models[1];
  return `<policies>
  <inbound>
    <base />
    <choose>
      <when condition='${xmlAttribute('@(context.Subscription == null || !System.Text.RegularExpressions.Regex.IsMatch(context.Subscription.Id, "^sub-student-(0[1-9]|[1-4][0-9]|50)$"))')}'>
        <return-response>
          <set-status code="403" reason="Forbidden" />
          <set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header>
          <set-body>{"error":{"code":"student_subscription_required","message":"An active workshop student subscription is required."}}</set-body>
        </return-response>
      </when>
    </choose>
    <rate-limit-by-key calls="30" renewal-period="60" counter-key="@(context.Subscription.Id)" retry-after-header-name="Retry-After" />
    <quota-by-key calls="500" renewal-period="86400" counter-key="@(context.Subscription.Id)" />
    <choose>
      <when condition='${xmlAttribute('@(context.Request.Method == "GET" && context.Request.Url.Path.EndsWith("/models"))')}'>
        <return-response>
          <set-status code="200" reason="OK" />
          <set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header>
          <set-body>${modelList}</set-body>
        </return-response>
      </when>
      <when condition='${xmlAttribute('@(context.Request.Method != "POST" || !context.Request.Url.Path.EndsWith("/v1/chat/completions"))')}'>
        <return-response>
          <set-status code="400" reason="Bad Request" />
          <set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header>
          <set-body>{"error":{"code":"unsupported_api","message":"Use Chat Completions with gpt-5.4-mini or Kimi-K3.1-Pro. Responses API is not enabled on this gateway."}}</set-body>
        </return-response>
      </when>
    </choose>
    <set-variable name="reqBody" value='@(context.Request.Body.As&lt;JObject&gt;(preserveContent: true))' />
    <set-variable name="modelName" value='${xmlAttribute('@{ var body = (JObject)context.Variables["reqBody"]; return (string)body["model"] ?? ""; }')}' />
    <choose>
      <when condition='${xmlAttribute('@(!string.Equals((string)context.Variables["modelName"], "gpt-5.4-mini", StringComparison.OrdinalIgnoreCase) && !string.Equals((string)context.Variables["modelName"], "Kimi-K3.1-Pro", StringComparison.OrdinalIgnoreCase))')}'>
        <return-response>
          <set-status code="400" reason="Bad Request" />
          <set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header>
          <set-body>{"error":{"code":"model_not_allowed","message":"Use model ID gpt-5.4-mini or Kimi-K3.1-Pro."}}</set-body>
        </return-response>
      </when>
      <when condition='${xmlAttribute(`@{
        var body = (JObject)context.Variables["reqBody"];
        var limit = body["max_completion_tokens"] ?? body["max_tokens"];
        return !(body["messages"] is JArray) || (limit != null && (limit.Type != JTokenType.Integer || (long)limit <= 0));
      }`)}'>
        <return-response>
          <set-status code="400" reason="Bad Request" />
          <set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header>
          <set-body>{"error":{"code":"invalid_request","message":"messages must be an array and the output token limit must be a positive integer."}}</set-body>
        </return-response>
      </when>
    </choose>
    <set-variable name="tenant-route" value='${xmlAttribute(`@{
      var isGpt = string.Equals((string)context.Variables["modelName"], "gpt-5.4-mini", StringComparison.OrdinalIgnoreCase);
      var primary = isGpt ? new string[] { ${primaryIds(gpt)} } : new string[] { ${primaryIds(kimi)} };
      foreach (var id in primary) { if (id == context.Subscription.Id) { return "primary"; } }
      return "secondary";
    }`)}' />
    <set-body>@{
      var body = (JObject)context.Variables["reqBody"];
      var isGpt = string.Equals((string)context.Variables["modelName"], "gpt-5.4-mini", StringComparison.OrdinalIgnoreCase);
      var secondary = (string)context.Variables["tenant-route"] == "secondary";
      body["model"] = isGpt ? (secondary ? "${gpt.deployments.secondary}" : "${gpt.deployments.primary}") : "${kimi.deployments.primary}";
      var limit = body["max_completion_tokens"] ?? body["max_tokens"];
      body.Remove("max_tokens");
      body["max_completion_tokens"] = limit == null || (long)limit &gt; ${MAX_OUTPUT_TOKENS} ? ${MAX_OUTPUT_TOKENS} : (long)limit;
      // Keep Chat Completions tool calls fast and avoid exhausting the output cap on reasoning.
      if (isGpt) { body["reasoning_effort"] = "none"; } else { body.Remove("reasoning_effort"); }
      if (body["tools"] == null) { body.Remove("parallel_tool_calls"); }
      var allowed = new string[] { "model", "messages", "temperature", "top_p", "max_completion_tokens", "stream", "stop", "presence_penalty", "frequency_penalty", "n", "response_format", "tools", "tool_choice", "logprobs", "top_logprobs", "user", "seed", "stream_options", "parallel_tool_calls", "metadata", "reasoning_effort" };
      var remove = new System.Collections.Generic.List&lt;string&gt;();
      foreach (var property in body.Properties()) {
        bool keep = false;
        foreach (var name in allowed) { if (property.Name == name) { keep = true; break; } }
        if (!keep) { remove.Add(property.Name); }
      }
      foreach (var name in remove) { body.Remove(name); }
      return body.ToString(Newtonsoft.Json.Formatting.None);
    }</set-body>
    <rewrite-uri template="/v1/chat/completions" copy-unmatched-params="false" />
    <set-header name="Authorization" exists-action="delete" />
    <set-header name="Ocp-Apim-Subscription-Key" exists-action="delete" />
    <set-header name="api-key" exists-action="delete" />
    <choose>
      <when condition='${xmlAttribute('@((string)context.Variables["tenant-route"] == "primary")')}'>
        <set-backend-service backend-id="${tenants.primary.backendId}" />
        <authentication-managed-identity resource="https://cognitiveservices.azure.com" />
      </when>
      <otherwise>
        <set-backend-service backend-id="${tenants.secondary.backendId}" />
      </otherwise>
    </choose>
  </inbound>
  <backend>
    <forward-request timeout="120" buffer-response="false" />
  </backend>
  <outbound>
    <base />
    <set-header name="X-Workshop-Tenant" exists-action="override"><value>@((string)context.Variables["tenant-route"])</value></set-header>
  </outbound>
  <on-error><base /></on-error>
</policies>
`;
}

module.exports = { MAX_STUDENTS, MAX_OUTPUT_TOKENS, tenants, models, assignTenant, assignments, generatePolicy };

if (require.main === module) {
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(__dirname, 'apim-v2-kimi-policy.xml'), generatePolicy(), 'utf8');
  } else {
    console.log(JSON.stringify({
      tenants, models, policy: generatePolicy(),
      assignments: Object.fromEntries(models.map(model => [model.id, assignments(model.id)])),
    }));
  }
}

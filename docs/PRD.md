# PRD: Azure AI Foundry Vibe-Coding Lab Platform

> **Purpose**: This document enables any LLM agent or engineer to reproduce the entire system from scratch — without trial and error.

---

## 1. Product Overview

A **self-service student onboarding platform** for an Azure AI Foundry vibe-coding class. Students (up to 50) visit a web page, enter their student ID and email, and automatically receive:
- An APIM subscription key (unified access to 3 AI models)
- A welcome email with setup instructions and a PowerShell auto-setup script
- Pre-configured VS Code + Cline extension ready for AI-assisted coding

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| API Gateway | Azure APIM (Developer SKU) | Single key per student, rate limiting, backend key hiding |
| Email Delivery | Azure Communication Services (ACS) Email | Graph API requires Exchange license; ACS works out-of-box |
| Onboarding Backend | GitHub Issues + Actions | Zero-cost, auditable, event-driven pipeline |
| Frontend Hosting | Azure Static Web Apps (SWA) | Free tier, integrated API (Azure Functions), auto-deploy |
| Student IDE | VS Code + Cline extension | OpenAI-compatible provider supports APIM proxy |
| Script Language | PowerShell (.ps1) | Native on Windows student PCs |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Student Flow                                  │
│                                                                      │
│  Student Browser ──► SWA Frontend (docs/index.html)                 │
│       │                    │                                         │
│       │              SWA API (Azure Functions)                       │
│       │              ├─ GET  /api/slots     → Show available slots   │
│       │              ├─ POST /api/onboard   → Create GitHub Issue    │
│       │              ├─ POST /api/cancel     → Cancel onboarding     │
│       │              └─ POST /api/manage     → Admin dashboard       │
│       │                    │                                         │
│       │              GitHub Issue (label: onboarding)                │
│       │                    │                                         │
│       │              GitHub Actions Workflow                         │
│       │              ├─ Verify passcode                              │
│       │              ├─ Azure Login → Get APIM subscription key      │
│       │              ├─ Send welcome email via ACS (HMAC-SHA256)     │
│       │              └─ Close issue with 'done' label                │
│       │                                                              │
│       ▼                                                              │
│  Student Email ──► Download setup-student.ps1                        │
│       │              ├─ Install VS Code (if missing)                 │
│       │              ├─ Install Cline extension                      │
│       │              ├─ Write Cline config (globalState + secrets)   │
│       │              └─ API connection test                          │
│       │                                                              │
│       ▼                                                              │
│  VS Code + Cline ──► APIM Gateway ──► Azure OpenAI / DeepSeek       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Map

```
eduelden-ai-deploy/
├── docs/                           # SWA Frontend
│   ├── index.html                  # Onboarding UI (student + admin)
│   └── staticwebapp.config.json    # SWA routing config
├── api/                            # SWA Backend (Azure Functions v4, Node.js)
│   └── src/functions/
│       ├── slots.js                # GET /api/slots - show onboarding status
│       ├── onboard.js              # POST /api/onboard - create GitHub issue
│       ├── cancel.js               # POST /api/cancel - cancel onboarding
│       └── admin.js                # POST /api/manage - admin dashboard
├── .github/
│   ├── workflows/
│   │   ├── student-onboarding.yml  # Core: issue → key → email pipeline
│   │   ├── key-management.yml      # APIM key rotation
│   │   └── cost-monitor.yml        # Daily cost report
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml  # Issue template
├── scripts/
│   └── setup-student.ps1           # Student PC auto-setup (English)
└── ai-class-starter/               # Starter project for students
```

---

## 3. Azure Resources Required

### 3.1 Resource List

| Resource | Type | SKU/Tier | Region | Cost |
|---|---|---|---|---|
| Resource Group | `rg-{name}` | — | Any | Free |
| AI Foundry Resource | `{name}-ai-resource` | S0 | Must support target models | Pay-per-use |
| AI Foundry Project | `{name}-ai` | — | Same as resource | Free |
| APIM | `apim-{name}-ai` | Developer | Same region | ~$50/mo |
| SWA | `swa-{name}-onboard` | Free | Any | Free |
| ACS | `acs-{name}-email` | Free | Any | Free (first 1000 emails) |
| ACS Email Service | `acs-{name}-email-svc` | — | Same as ACS | Free |

### 3.2 Model Deployments (in AI Foundry)

| Deployment Name | Model | TPM | Purpose |
|---|---|---|---|
| `gpt-54-mini` | GPT-5.4-mini (or equivalent) | 100K | Default: fast, general-purpose |
| `gpt-55` | GPT-5.5 (or equivalent) | 50K | High quality, complex tasks |
| `deepseek-v4-flash-1` | DeepSeek-V4-Flash | Serverless | Alternative model (instance 1) |
| `deepseek-v4-flash-2` | DeepSeek-V4-Flash | Serverless | Alternative model (instance 2) |

> **Note**: Model names are Azure deployment names, not actual model identifiers. Verify available models in your AI Foundry catalog with `az cognitiveservices account list-models` before deploying.

### 3.3 Entra ID

| Item | Value |
|---|---|
| Student accounts | `01@{domain}` ~ `50@{domain}` (pre-created) |
| Security group | `AI-Class-Students-{name}` |
| RBAC role | `Cognitive Services User` on AI resource |
| Service principal | `github-actions-{name}` (for GitHub Actions) |

---

## 4. APIM Configuration (Critical)

### 4.1 APIs

| API Name | Path | Backend |
|---|---|---|
| `openai-api` | `/openai` | `https://{ai-resource}.openai.azure.com/openai` |
| `deepseek-api` | `/deepseek` | Same (with `set-backend-service` in policy) |

### 4.2 Subscriptions

- 50 subscriptions: `sub-student-01` ~ `sub-student-50`
- Each subscription scoped to both APIs
- Subscription requirement: **DISABLED** on both APIs (auth handled in policy)

### 4.3 Inbound Policy (Critical — Cline Compatibility)

The APIM policy must handle **three problems**:

#### Problem 1: Multi-Header Authentication
Cline sends `Authorization: Bearer <key>`, curl may send `api-key` or `Ocp-Apim-Subscription-Key`. The policy must accept all three:

```xml
<set-variable name="auth-key" value="@{
  var auth = context.Request.Headers.GetValueOrDefault("Authorization","");
  if(auth.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)) {
    return auth.Substring(7).Trim();
  }
  var ak = context.Request.Headers.GetValueOrDefault("api-key","");
  if(!string.IsNullOrEmpty(ak)) { return ak; }
  return context.Request.Headers.GetValueOrDefault("Ocp-Apim-Subscription-Key","");
}" />
```

#### Problem 2: URL Format Translation
Cline (OpenAI SDK) sends: `POST /openai/chat/completions` with `model` in body.
Azure OpenAI expects: `POST /openai/deployments/{model}/chat/completions?api-version=2024-10-21`.

The policy rewrites the URL:

```xml
<choose>
  <when condition="@(context.Request.Url.Path.Contains("/chat/completions")
                     && !context.Request.Url.Path.Contains("/deployments/"))">
    <set-variable name="reqBody" value="@(context.Request.Body.As<JObject>(preserveContent: true))" />
    <set-variable name="modelName" value="@{
      var body = (JObject)context.Variables["reqBody"];
      return body["model"]?.ToString() ?? "gpt-54-mini";
    }" />
    <rewrite-uri template="@("/deployments/" + (string)context.Variables["modelName"]
                              + "/chat/completions")" copy-unmatched-params="true" />
    <set-query-parameter name="api-version" exists-action="override">
      <value>2024-10-21</value>
    </set-query-parameter>
  </when>
</choose>
```

#### Problem 3: Backend Key Injection
Strip the student's auth headers and inject the real Azure OpenAI key:

```xml
<set-header name="api-key" exists-action="override">
  <value>{{real-azure-openai-key}}</value>
</set-header>
<set-header name="Authorization" exists-action="delete" />
<set-header name="Ocp-Apim-Subscription-Key" exists-action="delete" />
```

### 4.4 Rate Limiting

```xml
<rate-limit-by-key calls="10" renewal-period="60"
                   counter-key="@((string)context.Variables["auth-key"])" />
<quota-by-key calls="200" renewal-period="86400"
              counter-key="@((string)context.Variables["auth-key"])" />
```

---

## 5. GitHub Actions Workflow — Student Onboarding Pipeline

### 5.1 Trigger
- `issues.opened` event with label `onboarding`

### 5.2 Steps

1. **Parse & Validate** (`actions/github-script@v7`)
   - Extract `PASSCODE`, `STUDENT_ID`, `EMAIL` from issue body
   - Verify passcode matches `CLASS_PASSCODE` secret
   - Validate student ID (01-50) and email format
   - On failure: comment on issue, close with `rejected` label

2. **Azure Login** (`azure/login@v2`)
   - Uses `AZURE_CREDENTIALS` secret (service principal JSON)

3. **Get APIM Key** (bash `az rest`)
   - `POST .../subscriptions/sub-student-{id}/listSecrets`
   - Mask the key with `::add-mask::`

4. **Send Welcome Email** (`actions/github-script@v7` with Node.js crypto)
   - ACS Email via REST API with HMAC-SHA256 authentication
   - HTML email contains: credentials, auto-setup instructions, manual setup guide, 3 model configs

5. **Close Issue** with `done` label and summary comment

### 5.3 Required GitHub Secrets

| Secret | Value | Source |
|---|---|---|
| `AZURE_CREDENTIALS` | Service principal JSON | `az ad sp create-for-rbac` |
| `ACS_CONNECTION_STRING` | ACS connection string | Azure Portal > ACS > Keys |
| `ACS_SENDER_ADDRESS` | `donotreply@{guid}.azurecomm.net` | ACS Email > MailFrom addresses |
| `CLASS_PASSCODE` | Student passcode | Custom (e.g., `!!ed7788`) |

### 5.4 SWA Environment Variables

| Variable | Value |
|---|---|
| `GITHUB_PAT` | Personal access token (repo + issues) |
| `GITHUB_REPO` | `{owner}/{repo}` |
| `CLASS_PASSCODE` | Same as GitHub secret |
| `ADMIN_PASSWORD` | Admin dashboard password |

---

## 6. ACS Email — HMAC-SHA256 Authentication

ACS REST API requires HMAC-SHA256 signed requests. **Must use Node.js** (not bash) because `openssl` can't handle binary keys with null bytes.

```javascript
const crypto = require('crypto');
const endpoint = connStr.match(/endpoint=([^;]+)/)[1].replace(/\/$/, '');
const accessKey = connStr.match(/accesskey=(.*)/)[1];
const host = endpoint.replace('https://', '');

const url = new URL(`${endpoint}/emails:send?api-version=2023-03-31`);
const dateStr = new Date().toUTCString();
const contentHash = crypto.createHash('sha256').update(body).digest('base64');
const pathAndQuery = url.pathname + url.search;
const stringToSign = `POST\n${pathAndQuery}\n${dateStr};${host};${contentHash}`;
const signature = crypto.createHmac('sha256', Buffer.from(accessKey, 'base64'))
  .update(stringToSign).digest('base64');

// Headers:
// x-ms-date: dateStr
// x-ms-content-sha256: contentHash
// Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}
// repeatability-request-id: crypto.randomUUID()
// repeatability-first-sent: dateStr
```

---

## 7. SWA Routing — Critical Gotcha

Azure Static Web Apps **reserves `/api/admin*` paths** internally. Any API endpoint starting with `admin` will return 404.

**Solution**: Use alternative route names (e.g., `/api/manage` instead of `/api/adminlist`).

`staticwebapp.config.json`:
```json
{
  "navigationFallback": { "rewrite": "/index.html" },
  "routes": [
    { "route": "/api/*", "allowedRoles": ["anonymous"] }
  ]
}
```

---

## 8. Student Setup Script (setup-student.ps1)

### 8.1 What It Does

1. **VS Code**: Check if installed → download & silent install if missing
2. **Cline Extension**: `code --install-extension saoudrizwan.claude-dev --force`
3. **API Config**: Write `~/.ai-class/config.json` with 3 model configs
4. **Cline Auto-Config**: Write to `~/.cline/data/globalState.json` and `secrets.json`
5. **Connection Test**: Send test request through APIM

### 8.2 Cline Config Locations (Important)

Cline does **NOT** read from VS Code `settings.json` for API configuration.

| File | Contents |
|---|---|
| `~/.cline/data/globalState.json` | `actModeApiProvider`, `openAiCompatibleBaseUrl`, `openAiCompatibleModelId` |
| `~/.cline/data/secrets.json` | `openAiCompatibleApiKey` |

### 8.3 Script Must Be in English

PowerShell scripts downloaded via `Invoke-WebRequest` from GitHub lose encoding for non-ASCII characters. **All output strings must be English-only** to avoid `cp949` / UTF-8 encoding corruption on Korean Windows.

---

## 9. Onboarding Frontend (SWA)

Single-page HTML app (`docs/index.html`) with:
- **Student Panel**: Enter student ID (01-50), email, passcode → submit
- **Slot Grid**: 50 slots showing available/pending/done status (real-time via `/api/slots`)
- **Admin Panel**: Password-protected, shows all onboarding entries with stats
- **Cancel**: Students can cancel their own onboarding

### API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/slots` | None | Slot availability grid |
| POST | `/api/onboard` | Passcode | Submit onboarding request |
| POST | `/api/cancel` | Passcode or admin | Cancel onboarding |
| POST | `/api/manage` | Admin password | Admin dashboard data |

### Race Condition Handling

`onboard.js` includes post-creation duplicate check:
- After creating an issue, re-fetches all open issues for the same student ID
- If duplicates found, keeps the one with the lowest issue number (first created)
- Closes later duplicates with `rejected` label

---

## 10. Lessons Learned / Pitfalls

| # | Pitfall | Solution |
|---|---|---|
| 1 | SWA reserves `/api/admin*` | Use `/api/manage` route name |
| 2 | Graph API needs Exchange license | Use ACS Email instead |
| 3 | ACS HMAC with bash has null-byte issues | Use Node.js `crypto` module |
| 4 | `raw.githubusercontent.com` serves `text/plain` | Provide PowerShell `Invoke-WebRequest` as primary download |
| 5 | Korean in `.ps1` breaks on download | Write all script output in English |
| 6 | Cline sends `Authorization: Bearer`, APIM expects `Ocp-Apim-Subscription-Key` | Policy extracts from any auth header |
| 7 | Cline sends `/chat/completions`, Azure expects `/deployments/{model}/chat/completions` | Policy rewrites URL + injects `api-version` |
| 8 | Cline config is NOT in VS Code `settings.json` | Write to `~/.cline/data/globalState.json` + `secrets.json` |
| 9 | APIM subscription validation runs before policies | Disable `subscriptionRequired`, validate in policy |
| 10 | `AZURE_CREDENTIALS` must be valid JSON | Use `az ad sp create-for-rbac --sdk-auth` format |

---

## 11. Budget & Cost Control

| Item | Budget | Notes |
|---|---|---|
| GPT models | $700 | TPM-limited |
| DeepSeek | $70 | Serverless pay-per-use |
| APIM | ~$50/mo | Developer SKU |
| Buffer | $30 | — |
| **Total** | **$800** | Monthly budget alert at 50%, 80%, 95% |

Cost monitoring via `cost-monitor.yml` (daily cron at 09:00 KST).

---

## 12. Security Model

| Layer | Mechanism |
|---|---|
| Student → SWA API | Class passcode (shared secret) |
| SWA API → GitHub | PAT token (repo scope) |
| GitHub Actions → Azure | Service principal (RBAC) |
| GitHub Actions → ACS | Connection string (HMAC-SHA256) |
| Student → APIM | APIM subscription key (per-student) |
| APIM → Azure OpenAI | Real API key (injected by policy, never exposed) |
| Admin dashboard | Separate admin password |

**Never expose in plaintext**: APIM subscription keys, Azure OpenAI keys, service principal secrets, ACS connection strings.

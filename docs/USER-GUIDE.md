# User Guide: Azure AI Foundry Vibe-Coding Lab Platform

> For instructors operating the platform and students using it.

---

## Part 1: Instructor Guide

### 1.1 Daily Operations

#### Start of Class
1. Open the **admin dashboard** (separate SWA): `https://calm-beach-02d18ca00.7.azurestaticapps.net`
2. Log in with the admin token — sent via the `X-Admin-Token` custom header (not the standard Authorization header, because SWA overwrites it)
3. The dashboard has 6 pages: **Login**, **Overview** (budget gauge, model usage), **Students** list, **Student Detail** (hourly chart), **Bulk Control** (enable/disable keys), **Alert Settings**
4. Open the **onboarding admin panel**: `https://{swa-onboard-url}` → scroll to Admin section → enter admin password
5. Share the onboarding URL and passcode with students

#### During Class
- Use the admin dashboard **Overview** page for real-time monitoring — it shows total requests, estimated cost, budget gauge, and model breakdown
- Use the **Students** page to view per-student usage with last-active time
- Track onboarding progress via the slot grid on the onboarding SWA (auto-refreshes)
- Check GitHub Issues for any `error` or `pending` labels

#### End of Class
- Run cost check: GitHub Actions > `cost-monitor.yml` > Run workflow
- Review daily chart on the dashboard before dismissing students
- If needed, disable student keys via the dashboard or CLI (see Key Management below)

### 1.2 Student Onboarding Flow

```
Student visits SWA URL
    ↓
Enters: Student ID (01-50) + Email + Passcode
    ↓
System creates GitHub Issue (label: onboarding)
    ↓
GitHub Actions workflow:
  1. Validates passcode
  2. Gets APIM subscription key for the student
  3. Sends welcome email via ACS
  4. Closes issue with 'done' label
    ↓
Student receives email with:
  - Azure account credentials
  - API key and Base URL
  - PowerShell setup command
  - Manual setup instructions
```

> **Note**: GitHub Free plan allows 20 concurrent workflow jobs. If 50 students 
> apply simultaneously, some will queue (2-5 min delay). Recommend staggering: 
> have students apply in groups of 10.

### 1.3 Admin Dashboard

The admin monitoring dashboard (`swa-eduelden-dashboard`) is a separate React application from the student onboarding SWA. Access it at:

```
https://swa-eduelden-dashboard.azurestaticapps.net
```

#### Login
1. Navigate to the dashboard URL
2. Enter the admin token (configured as `DASHBOARD_ADMIN_TOKEN` in the SWA environment)
3. Click **Login** — token is stored in your browser session (not persisted across tabs)

#### Dashboard Pages

| Page | What you can do |
|---|---|
| **Overview** | See total token usage today, budget gauge (% of $800 spent), daily usage bar chart (last 30 days), Top 5 students by usage |
| **Students** | Browse all 50 students, search by ID or name, sort by usage/quota/status |
| **Student Detail** | View per-student token history chart, model usage breakdown (GPT-mini vs GPT vs DeepSeek), adjust daily quota, suspend/reactivate subscription |
| **Bulk Control** | Reset all student quotas to default, suspend all 50 students at once, or reactivate all |
| **Alerts** | Configure 3-tier budget alert thresholds (default: 50%/80%/95%), set per-student daily token threshold, manage admin notification email |

#### Data Freshness
Dashboard data is sourced from Log Analytics (APIM GatewayLogs). Results are **cached for 5 minutes** in the API layer. There is no manual refresh button — simply wait 5 minutes for new data to appear.

### 1.4 Key Management

#### Rotate a Student's Key
```bash
# Via GitHub Actions
# Go to Actions > key-management.yml > Run workflow
# Input: student ID, action: regenerate-student

# Via CLI
az rest --method POST \
  --url "https://management.azure.com/subscriptions/{sub-id}/resourceGroups/rg-{name}/providers/Microsoft.ApiManagement/service/apim-{name}-ai/subscriptions/sub-student-{id}/regeneratePrimaryKey?api-version=2022-08-01"
```

#### Disable a Student's Key
```bash
az apim subscription update --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --subscription-id sub-student-{id} \
  --state suspended
```

#### Bulk Disable All Keys
```bash
for i in $(seq -w 1 50); do
  az apim subscription update --service-name apim-{name}-ai \
    --resource-group rg-{name} \
    --subscription-id "sub-student-${i}" \
    --state suspended
done
```

### 1.5 Cost Monitoring

- **Dashboard**: The admin dashboard Overview page shows a budget gauge with real-time estimated cost (based on APIM request logs)
- **Automated**: `cost-monitor.yml` runs daily at 09:00 KST
- **Budget alerts**: Email to admin at 50%, 80%, 95% of $800
- **Manual check**:
  ```bash
  az consumption usage list --resource-group rg-{name} \
    --start-date $(date -d "-7 days" +%Y-%m-%d) \
    --end-date $(date +%Y-%m-%d) \
    --query "[].{service:instanceName, cost:pretaxCost}" -o table
  ```

### 1.6 Canceling a Student's Onboarding

**Option A: Student self-cancels** via the SWA onboarding page (needs passcode)

**Option B: Admin cancels** via the admin panel or API:
```bash
curl -X POST "https://{swa-url}/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"01","isAdmin":true,"adminPw":"admin-password"}'
```

### 1.7 Post-Class Cleanup

See `docs/resource-cleanup.md` for full procedure. Key steps:
1. Suspend all APIM subscriptions
2. Delete model deployments
3. Delete APIM instance (stops ~$50/mo charge)
4. Optionally delete the entire resource group

> **Warning**: After deleting APIM, it remains in soft-delete state for 48 hours. 
> You cannot recreate an APIM with the same name during this period.
> To purge immediately: `az apim deletedservice purge --service-name apim-{name}-ai --location {region}`

---

## Part 2: Student Guide

### 2.1 Getting Started (Automatic Setup)

#### Step 1: Request Onboarding
1. Visit the onboarding page (URL provided by instructor)
2. Choose an available student number (01-50)
3. Enter your email address
4. Enter the class passcode
5. Click "Apply"
6. Check your email (check spam folder too)

#### Step 2: Download & Run Setup Script

> **Important**: If VS Code is not yet installed, run PowerShell as **Administrator** 
> (right-click PowerShell > "Run as administrator"). If VS Code is already installed, 
> normal user permissions are sufficient.

Open PowerShell and paste:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/{owner}/{repo}/main/scripts/setup-student.ps1" -OutFile setup-student.ps1
```

Run the script (replace values from your email):
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-student.ps1 -StudentId {YOUR_ID} -ApiKey "{YOUR_KEY}"
```

The script will:
- Install VS Code (if not already installed)
- Install the Cline extension
- Install Power BI MCP (`C:\MCPServers\PowerBIModelingMCP\`) as a Windows exe (not npx) and configure Cline MCP settings for Power BI integration
- Configure API settings automatically
- Test the connection

> **Note**: If VS Code was already open during script execution, restart VS Code or run
> the **"Developer: Reload Window"** command (`Ctrl+Shift+P` → "Reload Window") for
> the new MCP settings to take effect.

#### Step 3: Start Coding
1. Open VS Code
2. Click the Cline icon in the left sidebar
3. Type a message like "Hello!" → you should get an AI response
4. Start vibe coding!

### 2.2 Manual Setup (If Automatic Fails)

#### Install VS Code
Download from: https://code.visualstudio.com/download

#### Install Cline Extension
1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search for `Cline`
4. Install **Cline** (by saoudrizwan)

#### Configure Cline
1. Click the Cline icon in the left sidebar
2. Select **"Bring my own API key"**
3. Choose **API Provider**: `OpenAI Compatible`
4. Enter:
   - **Base URL**: `https://apim-{name}-ai.azure-api.net/openai/v1`
   - **API Key**: (from your email)
   - **Model ID**: `gpt-54-mini`
5. Click **Continue**

### 2.3 Switching Models

You have access to 3 AI models. Change in Cline settings (gear icon):

| Model | Base URL | Model ID | Best For |
|---|---|---|---|
| **GPT-5.4-mini** (default) | `https://apim-{name}-ai.azure-api.net/openai/v1` | `gpt-54-mini` | General coding, fast responses |
| **GPT-5.5** | `https://apim-{name}-ai.azure-api.net/openai/v1` | `gpt-55` | Complex tasks, higher quality |
| **DeepSeek V4** | `https://apim-{name}-ai.azure-api.net/deepseek/v1` | `deepseek-v4-flash` | Alternative perspective |

> **Important**: GPT and DeepSeek use **different Base URLs** (`/openai/v1` vs `/deepseek/v1`). Don't forget to change the Base URL when switching to DeepSeek.

### 2.4 Rate Limits

| Limit | Value |
|---|---|
| Requests per minute | 10 |
| Requests per day | 200 |

If you hit the limit, wait 1 minute (per-minute) or try the next day (daily).
Error message: `429 Too Many Requests`

### 2.5 Troubleshooting

| Problem | Solution |
|---|---|
| "401 Unauthorized" | Check API key is correct. Copy again from email. |
| "404 Resource not found" | Check Base URL ends with `/v1`. Check Model ID matches exactly. |
| "429 Too Many Requests" | Rate limit hit. Wait 1 minute and try again. |
| Cline not responding | Check internet connection. Try clicking Retry. |
| Script won't run | Run `Set-ExecutionPolicy Bypass -Scope Process -Force` first |
| VS Code not found after install | Close and reopen PowerShell to refresh PATH |
| Cline not reading config | UTF-8 BOM in config file. Re-save: `[IO.File]::WriteAllText("$env:USERPROFILE\.cline\data\globalState.json", (Get-Content ... -Raw), [Text.UTF8Encoding]::new($false))` |
| DeepSeek first request very slow | Serverless cold start (10-30s). Normal for first request. Wait and retry. Set Cline timeout to 60s+ |
| Already onboarded student cancelled | Cancel only closes issue, doesn't disable APIM key. Run key-management workflow with `disable-student` action to also disable the key |
| Dashboard shows "Unauthorized" | Admin token may be wrong or session expired. Navigate to `/login` and re-enter the token |
| Dashboard data not updating | Data is cached for 5 minutes. Wait and refresh. If still stale, check Log Analytics diagnostic settings in Azure Portal |
| Power BI MCP not appearing in Cline | Re-run setup-student.ps1 or manually add the MCP server entry to `cline_mcp_settings.json` in VS Code globalStorage |
| Cline shows "model not supported" error | Azure OpenAI does not accept `reasoning_effort` or `stream_options`. APIM policy strips these automatically — if error persists, check that the latest policy is deployed |
| `gpt-55` parameter error (400/403) | APIM automatically strips unsupported params (`prediction`, `stream_options`, `service_tier`, `store`, `metadata`). Already applied. If still failing, check APIM policy. |
| Power BI MCP "No connection found" | npx wrapper pollutes stdout with non-JSON text. Use exe direct execution: check `C:\MCPServers\PowerBIModelingMCP\node_modules\@microsoft\powerbi-modeling-mcp-win32-x64\dist\powerbi-modeling-mcp.exe` exists. Re-run `setup-student.ps1` if missing. |
| Dashboard shows 0 data | APIM diagnostics must be in Resource-specific mode (not AzureDiagnostics legacy). Check with `az monitor diagnostic-settings list`. KQL queries union both tables for backward compatibility. |
| Dashboard login 401 | SWA overwrites Authorization header. Dashboard uses `X-Admin-Token` custom header. Check `ADMIN_TOKEN` env var in SWA settings. |

---

## Appendix A: Architecture Quick Reference

```
Student Flow:
  Student Browser
      ↓ HTTPS
  SWA Onboarding (swa-{name}-onboard, docs/index.html)
      ↓ GitHub API
  GitHub Issues + Actions
      ↓ ACS Email
  Student Email
      ↓ PowerShell script (setup-student.ps1)
  VS Code + Cline + Power BI MCP
      ↓ HTTPS (X-Admin-Token or Authorization: Bearer)
  Azure APIM (rate limit + param strip + URL rewrite + key injection via Named Value)
      ↓ api-key header ({{aoai-api-key}})
  Azure OpenAI / DeepSeek (AI models)

Admin Flow:
  Admin Browser
      ↓ HTTPS (X-Admin-Token header)
  SWA Dashboard (swa-eduelden-dashboard, React + Vite)
      ↓ Azure Functions API
  Log Analytics (ApiManagementGatewayLogs ∪ AzureDiagnostics, 5-min cache)
  APIM Management API (subscription state, key management)
```

## Appendix B: All Credentials Reference

| Credential | Where Used | Where Stored |
|---|---|---|
| Class Passcode | Student onboarding form | GitHub Secret + SWA env var |
| Admin Password | Admin dashboard | SWA env var |
| GitHub PAT | SWA API → GitHub Issues | SWA env var. Required scope: `repo` (or fine-grained: Issues R/W + Contents R) |
| AZURE_CREDENTIALS | GitHub Actions → Azure | GitHub Secret |
| ACS_CONNECTION_STRING | GitHub Actions → Email | GitHub Secret |
| ACS_SENDER_ADDRESS | Email From address | GitHub Secret |
| APIM subscription keys | Student → APIM | Generated per-student, sent via email |
| Azure OpenAI key | APIM → Azure OpenAI | APIM Named Value `{{aoai-api-key}}` (secret=true) |
| Admin Token | Admin dashboard login | SWA env var `ADMIN_TOKEN`, sent via `X-Admin-Token` header |
| AZURE_SWA_DASHBOARD_TOKEN | Dashboard SWA deployment | GitHub Secret |

## Appendix C: APIM Policy — What It Does

The APIM policy handles the translation between OpenAI-compatible format (what Cline sends) and Azure OpenAI format (what the backend expects):

```
Cline sends:                         APIM rewrites to:
POST /openai/v1/chat/completions  →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
POST /openai/chat/completions     →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
Body: {"model":"gpt-54-mini",...}     (model extracted from body, injected into URL path)
```

Additionally, the APIM inbound policy strips parameters unsupported by Azure OpenAI:
- `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`

This prevents 400/403 errors when Cline sends these parameters.

The policy also:
- **Injects the real Azure OpenAI key** using the Named Value `{{aoai-api-key}}` — the key is stored securely in APIM's Named Values store, never in source code
- **Accepts any auth header style** from the student client (`Authorization: Bearer`, `api-key`, or `Ocp-Apim-Subscription-Key`)

This allows students to use standard OpenAI-compatible clients without knowing about Azure's deployment-based URL structure or managing backend credentials.

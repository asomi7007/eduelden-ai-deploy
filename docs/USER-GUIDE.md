# User Guide: Azure AI Foundry Vibe-Coding Lab Platform

> For instructors operating the platform and students using it.

---

## Part 1: Instructor Guide

### 1.1 Daily Operations

#### Start of Class
1. Open admin dashboard: `https://{swa-url}` → scroll to Admin section
2. Enter admin password → view onboarding stats
3. Share the onboarding URL and passcode with students

#### During Class
- Monitor onboarding progress via the slot grid (auto-refreshes)
- Check GitHub Issues for any `error` or `pending` labels
- Use Azure Portal > APIM > Analytics to monitor API usage

#### End of Class
- Run cost check: GitHub Actions > `cost-monitor.yml` > Run workflow
- If needed, disable student keys (see Key Management below)

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

### 1.3 Key Management

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

### 1.4 Cost Monitoring

- **Automated**: `cost-monitor.yml` runs daily at 09:00 KST
- **Budget alerts**: Email to admin at 50%, 80%, 95% of $800
- **Manual check**:
  ```bash
  az consumption usage list --resource-group rg-{name} \
    --start-date $(date -d "-7 days" +%Y-%m-%d) \
    --end-date $(date +%Y-%m-%d) \
    --query "[].{service:instanceName, cost:pretaxCost}" -o table
  ```

### 1.5 Canceling a Student's Onboarding

**Option A: Student self-cancels** via the SWA onboarding page (needs passcode)

**Option B: Admin cancels** via the admin panel or API:
```bash
curl -X POST "https://{swa-url}/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"01","isAdmin":true,"adminPw":"admin-password"}'
```

### 1.6 Post-Class Cleanup

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
- Configure API settings automatically
- Test the connection

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

---

## Appendix A: Architecture Quick Reference

```
Student Browser
    ↓ HTTPS
Azure Static Web App (Frontend + API)
    ↓ GitHub API
GitHub Issues + Actions
    ↓ ACS Email
Student Email
    ↓ PowerShell script
VS Code + Cline
    ↓ HTTPS (Authorization: Bearer)
Azure APIM (rate limit + URL rewrite + key injection)
    ↓ api-key header
Azure OpenAI / DeepSeek (AI models)
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
| Azure OpenAI key | APIM → Azure OpenAI | Embedded in APIM policy |

## Appendix C: Model Configuration in APIM Policy

The APIM policy handles the translation between OpenAI-compatible format (what Cline sends) and Azure OpenAI format (what the backend expects):

```
Cline sends:                         APIM rewrites to:
POST /openai/v1/chat/completions  →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
POST /openai/chat/completions     →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
Body: {"model":"gpt-54-mini",...}     (model extracted from body, injected into URL path)
```

This allows students to use standard OpenAI-compatible clients without knowing about Azure's deployment-based URL structure.

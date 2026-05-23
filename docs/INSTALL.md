# Installation Manual: Azure AI Foundry Vibe-Coding Lab

> Step-by-step guide to build the entire platform from zero.
> Follow phases in order. Do not skip.

---

## Prerequisites

- Azure subscription with Owner access
- Azure CLI 2.50+ installed and logged in (`az login`) — check with `az --version`
- GitHub account with `gh` CLI 2.0+ installed — check with `gh --version`
- Domain with pre-created student accounts (`01@domain` ~ `50@domain`)
- Node.js 18.x or 20.x LTS (for SWA API development) — check with `node --version`
- PowerShell 5.1+ (students need this for setup script) — check with `$PSVersionTable.PSVersion`

---

## Quick Start (Automated Deployment)

If you want to deploy everything at once instead of following each phase manually:

### 1. Configure
```bash
cp config.env.template config.env
# Edit config.env with your organization's values
```

### 2. Deploy
```bash
chmod +x scripts/deploy-all.sh
./scripts/deploy-all.sh
```

### 3. Resume from a specific phase
```bash
./scripts/deploy-all.sh --phase 4    # Resume from Phase 4
./scripts/deploy-all.sh --dry-run    # Preview without executing
```

> The automated script handles Phases 1-7. You still need to:
> - Apply APIM policies manually (Phase 4 — see PRD.md Section 4.3)
> - Complete ACS Email domain setup in Portal (Phase 5)
> - Set `GITHUB_PAT` in SWA Configuration (Phase 7)
> - Run end-to-end test (Phase 8)

If you prefer step-by-step control, continue with the manual phases below.

---

## Phase 1: Resource Group & Budget

```bash
# 1. Create or verify resource group
az group create --name rg-{name} --location koreacentral

# 2. Create budget ($800, monthly)
az consumption budget create \
  --budget-name "eduelden-ai-budget" \
  --resource-group rg-{name} \
  --amount 800 --time-grain Monthly \
  --start-date $(date +%Y-%m-01) --end-date $(date -d "+6 months" +%Y-%m-01) \
  --category Cost

# 3. Add alert thresholds (50%, 80%, 95%) — must be done in Azure Portal
# Portal > Cost Management > Budgets > ai-class-budget > Alert conditions
```

---

## Phase 2: AI Foundry Setup

```bash
# 1. Verify existing AI Foundry resource
az cognitiveservices account show \
  --name {ai-resource-name} \
  --resource-group rg-{name}

# 2. Check available models
az cognitiveservices account list-models \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --query "[].{model:model.name, version:model.version}" -o table

# 3. Deploy models (adjust model names based on catalog)
# GPT model (general purpose, fast)
az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name gpt-54-mini \
  --model-name gpt-5.4-mini \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 100

# GPT model (high quality)
az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name gpt-55 \
  --model-name gpt-5.5 \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 50

# DeepSeek (Marketplace model — requires terms acceptance)
# IMPORTANT: Before CLI deployment, accept terms in Azure Portal:
#   1. Portal > AI Foundry > Model catalog > Search "DeepSeek-V4-Flash"
#   2. Click "Deploy" > Accept marketplace terms
#   3. Cancel the portal deployment (we'll deploy via CLI or use the portal deployment)
#   4. If CLI fails with "MarketplaceTermsNotAccepted", complete step 1-2 first
#
# Deploy 2 instances for load balancing:
az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name deepseek-v4-flash-1 \
  --model-name DeepSeek-V4-Flash \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 1

az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name deepseek-v4-flash-2 \
  --model-name DeepSeek-V4-Flash \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 1
```

---

## Phase 3: Entra ID & RBAC

```bash
# 1. Create security group
az ad group create --display-name AI-Class-Students-{name} \
  --mail-nickname ai-class-students

# 2. Add students to group (loop 01-50)
GROUP_ID=$(az ad group show --group "AI-Class-Students-{name}" --query id -o tsv)
for i in $(seq -w 1 50); do
  USER_ID=$(az ad user show --id "${i}@{domain}" --query id -o tsv 2>/dev/null)
  if [ -n "$USER_ID" ]; then
    az ad group member add --group $GROUP_ID --member-id $USER_ID
    echo "Added ${i}@{domain}"
  fi
done

# 3. Assign Cognitive Services User role
AI_RESOURCE_ID=$(az cognitiveservices account show \
  --name {ai-resource-name} --resource-group rg-{name} --query id -o tsv)
az role assignment create \
  --assignee-object-id $GROUP_ID \
  --role "Cognitive Services User" \
  --scope $AI_RESOURCE_ID

# 4. Create service principal for GitHub Actions
az ad sp create-for-rbac --name github-actions-{name} \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-{name} \
  --sdk-auth
# Save the output JSON — this becomes AZURE_CREDENTIALS secret
# Note: --sdk-auth is deprecated in Azure CLI 2.30+ and shows a warning.
# This is expected — the output JSON format is still required by azure/login@v2.
# Ignore the deprecation warning, or consider migrating to OpenID Connect
# federated credentials for a more modern approach.
```

---

## Phase 4: APIM Setup

```bash
# 1. Create APIM instance (takes ~30 minutes)
az apim create --name apim-{name}-ai \
  --resource-group rg-{name} \
  --publisher-email admin@{domain} \
  --publisher-name "{org-name}" \
  --sku-name Developer \
  --location {region}

# ⚠️ IMPORTANT: APIM provisioning takes 30-45 minutes.
# Do NOT proceed to step 2 until provisioning is complete.
# Check status:
az apim show --name apim-{name}-ai --resource-group rg-{name} \
  --query provisioningState -o tsv
# Wait until output is "Succeeded" before continuing.

# 2. Get Azure OpenAI key (for APIM backend policy)
AOAI_KEY=$(az cognitiveservices account keys list \
  --name {ai-resource-name} --resource-group rg-{name} \
  --query key1 -o tsv)

# 2.5 Register the key as APIM Named Value (used in policy as {{real-azure-openai-key}})
az apim nv create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --named-value-id real-azure-openai-key \
  --display-name "Azure OpenAI Key" \
  --value "$AOAI_KEY" --secret true

# 3. Create OpenAI API
az apim api create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api --display-name "OpenAI API" \
  --path openai \
  --service-url "https://{ai-resource-name}.openai.azure.com/openai" \
  --protocols https --subscription-required false

# 4. Create catch-all operation
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api \
  --operation-id openai-all \
  --display-name "All OpenAI" \
  --method POST --url-template "/*"

# 4b. Add GET operation (for /models endpoint that Cline may query)
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api \
  --operation-id openai-get \
  --display-name "GET OpenAI" \
  --method GET --url-template "/*"

# 5. Create DeepSeek API (same pattern, different path)
az apim api create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id deepseek-api --display-name "DeepSeek API" \
  --path deepseek \
  --service-url "https://{ai-resource-name}.openai.azure.com/openai" \
  --protocols https --subscription-required false

az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id deepseek-api \
  --operation-id deepseek-all \
  --display-name "All DeepSeek" \
  --method POST --url-template "/*"

# 5b. Add GET operation for DeepSeek (for /models endpoint that Cline may query)
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id deepseek-api \
  --operation-id deepseek-get \
  --display-name "GET DeepSeek" \
  --method GET --url-template "/*"

# 6. Apply APIM policies — see PRD.md Section 4.3 for full XML
# Use Azure Portal > APIM > APIs > openai-api > Inbound processing > Code editor
# Or use az rest to PUT the policy programmatically

# 7. Create student subscriptions (50)
for i in $(seq -w 1 50); do
  az apim subscription create --service-name apim-{name}-ai \
    --resource-group rg-{name} \
    --subscription-id "sub-student-${i}" \
    --display-name "Student ${i}" \
    --scope "/apis" --state active
done
```

### APIM Policy Application

```powershell
# Apply policy via REST API (PowerShell example)
$token = (az account get-access-token --query accessToken -o tsv)
$headers = @{Authorization="Bearer $token"; "Content-Type"="application/json"}

$policy = @'
<policies>
  <inbound>
    <base />
    <!-- See PRD.md Section 4.3 for complete policy XML -->
    <!-- Must include: multi-header auth, URL rewrite, rate limit, key injection -->
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
'@

$body = @{properties=@{format="rawxml";value=$policy}} | ConvertTo-Json -Depth 3
$url = "https://management.azure.com/subscriptions/{sub-id}/resourceGroups/rg-{name}/providers/Microsoft.ApiManagement/service/apim-{name}-ai/apis/openai-api/policies/policy?api-version=2022-08-01"
Invoke-RestMethod -Uri $url -Headers $headers -Method PUT -Body $body
```

---

## Phase 5: Azure Communication Services (Email)

```bash
# 1. Create ACS resource
az communication create --name acs-{name}-email \
  --resource-group rg-{name} \
  --location Global --data-location Korea

# 2. Create Email Communication Service (Portal required — detailed steps)
# Step 2a: Portal > search "Email Communication Services" > Create
#          Name: acs-{name}-email-svc, Data location: Korea
# Step 2b: After creation > "Provision domains" > "Add Azure managed domain"
# Step 2c: Go to Communication Services resource > "Domains" > "Connect domain"
#          > Select the domain from step 2b
# Step 2d: Check MailFrom addresses for sender: donotreply@{guid}.azurecomm.net

# 3. Get connection string
ACS_CONN=$(az communication list-key --name acs-{name}-email \
  --resource-group rg-{name} --query primaryConnectionString -o tsv)
# Save as GitHub secret: ACS_CONNECTION_STRING
```

---

## Phase 6: GitHub Repository Setup

```bash
# 1. Create repo
gh repo create {owner}/eduelden-ai-deploy --public

# 2. Clone and set up structure
git clone https://github.com/{owner}/eduelden-ai-deploy.git
cd eduelden-ai-deploy

# 3. Create directory structure
mkdir -p docs api/src/functions scripts .github/workflows .github/ISSUE_TEMPLATE

# 4. Initialize API (Azure Functions v4)
cd api && npm init -y
npm install @azure/functions
# Copy function files: slots.js, onboard.js, cancel.js, admin.js

# 5. Set GitHub secrets
gh secret set AZURE_CREDENTIALS < azure-credentials.json
gh secret set ACS_CONNECTION_STRING --body "$ACS_CONN"
gh secret set ACS_SENDER_ADDRESS --body "donotreply@{guid}.azurecomm.net"
gh secret set CLASS_PASSCODE --body "your-passcode"

# 6. Create labels
gh label create onboarding --color 0E8A16
gh label create done --color 1D76DB
gh label create rejected --color D93F0B
gh label create error --color B60205
gh label create pending --color FBCA04
gh label create cost-alert --color FF6600
gh label create urgent --color E11D48
```

---

## Phase 7: Static Web App Deployment

```bash
# 1. Create SWA (via Portal or CLI)
az staticwebapp create --name swa-{name}-onboard \
  --resource-group rg-{name} \
  --source https://github.com/{owner}/eduelden-ai-deploy \
  --branch main \
  --app-location "/docs" \
  --api-location "/api" \
  --location eastus2

# 2. Set SWA environment variables
az staticwebapp appsettings set --name swa-{name}-onboard \
  --resource-group rg-{name} \
  --setting-names \
    GITHUB_PAT="{your-pat}" \
    GITHUB_REPO="{owner}/eduelden-ai-deploy" \
    CLASS_PASSCODE="{your-passcode}" \
    ADMIN_PASSWORD="{your-admin-password}"

# 3. Verify staticwebapp.config.json exists in docs/
cat docs/staticwebapp.config.json
# Should contain: navigationFallback + /api/* anonymous route

# 4. Push code — SWA auto-deploys from GitHub
git add . && git commit -m "Initial setup" && git push
```

---

## Phase 8: End-to-End Test

```bash
# 1. Visit SWA URL
# https://{random-name}.azurestaticapps.net

# 2. Enter test student (ID: 01, email: your-email@test.com, passcode)

# 3. Verify:
#    - GitHub issue created with 'onboarding' label
#    - Actions workflow completes successfully
#    - Email received with all credentials
#    - setup-student.ps1 download works
#    - Script installs VS Code + Cline
#    - Cline connects to APIM and gets AI response

# 4. Test all 3 models:
curl -X POST "https://apim-{name}-ai.azure-api.net/openai/chat/completions" \
  -H "Authorization: Bearer {student-key}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-54-mini","messages":[{"role":"user","content":"Hello"}]}'

curl -X POST "https://apim-{name}-ai.azure-api.net/openai/chat/completions" \
  -H "Authorization: Bearer {student-key}" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-55","messages":[{"role":"user","content":"Hello"}]}'

curl -X POST "https://apim-{name}-ai.azure-api.net/deepseek/chat/completions" \
  -H "Authorization: Bearer {student-key}" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Helper Scripts

| Script | Purpose | Usage |
|---|---|---|
| `scripts/deploy-all.sh` | Full automated deployment (Phase 1-7) | `./scripts/deploy-all.sh` |
| `scripts/01_deploy_foundry.sh` | Deploy AI models only | `./scripts/01_deploy_foundry.sh` |
| `scripts/02_manage_keys.sh` | Manage student APIM keys | `./scripts/02_manage_keys.sh {create\|export\|list\|disable\|enable\|regenerate}` |
| `scripts/cost-monitor.sh` | Check current spending | `./scripts/cost-monitor.sh` |
| `scripts/setup-student.ps1` | Student PC auto-setup | `.\setup-student.ps1 -StudentId 01 -ApiKey "key"` |

All bash scripts read from `config.env` in the project root. Copy `config.env.template` and fill in your values before running.

---

## Troubleshooting Quick Reference

| Symptom | Cause | Fix |
|---|---|---|
| SWA API returns 404 on `/api/admin*` | SWA reserves admin paths | Rename route (e.g., `/api/manage`) |
| Workflow email step fails with 401 | ACS HMAC auth issue | Use Node.js crypto, not bash openssl |
| Student gets 401 from APIM | Wrong auth header | APIM policy must extract from Bearer/api-key/Ocp headers |
| Student gets 404 from APIM | URL format mismatch | APIM policy must rewrite `/chat/completions` to `/deployments/{model}/chat/completions` |
| PowerShell script shows garbled text | Korean encoding issue | Script must be English-only |
| Cline shows empty config | Wrong config path | Write to `~/.cline/data/globalState.json` not `settings.json` |
| Email not received | Exchange license issue | Use ACS Email instead of Graph API |
| GitHub Actions workflow not triggered | `onboarding` label missing or workflow not on default branch | Check issue has `onboarding` label. Ensure `.github/workflows/student-onboarding.yml` is on `main` branch and workflow is enabled in Actions tab |
| `SubscriptionNotFound` from APIM | Student ID format mismatch (01 vs 1) | Ensure APIM subscriptions use 0-padded IDs (`sub-student-01`). `seq -w 1 50` handles this correctly |
| ACS email `403 Forbidden` | Email domain not connected to ACS resource | Portal > Communication Services > Domains > verify domain shows "Connected" status |
| `502 Bad Gateway` from SWA | `GITHUB_PAT` not set or expired | Check SWA > Configuration for GITHUB_PAT. Ensure PAT has `repo` scope and hasn't expired |
| APIM cannot be recreated after deletion | APIM soft-delete (48hr retention) | Purge first: `az apim deletedservice purge --service-name apim-{name}-ai --location {region}` |
| `MarketplaceTermsNotAccepted` on DeepSeek deploy | Marketplace terms not accepted | Accept terms in Portal: AI Foundry > Model catalog > DeepSeek > Deploy > Accept terms |

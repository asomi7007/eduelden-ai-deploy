#!/bin/bash
set -euo pipefail

# ============================================================
# Azure AI Foundry Vibe-Coding Lab — Full Deployment Script
# ============================================================
# Automates Phase 1-7 of INSTALL.md in one script.
# Requires: config.env in project root (copy from config.env.template)
#
# Usage:
#   ./scripts/deploy-all.sh              # Run all phases
#   ./scripts/deploy-all.sh --phase 4    # Run from Phase 4 onward
#   ./scripts/deploy-all.sh --dry-run    # Show what would be done
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load config
CONFIG_FILE="${PROJECT_ROOT}/config.env"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: config.env not found. Copy from template first:"
  echo "  cp config.env.template config.env"
  echo "  # Edit config.env with your values"
  exit 1
fi
source "$CONFIG_FILE"

# Validate required fields
REQUIRED_VARS="AZURE_SUBSCRIPTION_ID PROJECT_NAME ADMIN_EMAIL STUDENT_DOMAIN GITHUB_OWNER GITHUB_REPO"
for var in $REQUIRED_VARS; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in config.env"
    exit 1
  fi
done

# Parse arguments
START_PHASE=1
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --phase) START_PHASE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

APIM_GATEWAY="https://${APIM_NAME}.azure-api.net"

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] $*"
  else
    eval "$@"
  fi
}

echo "============================================"
echo "  Azure AI Foundry Vibe-Coding Lab Deploy"
echo "============================================"
echo "Project:  $PROJECT_NAME"
echo "RG:       $RESOURCE_GROUP ($RG_REGION)"
echo "APIM:     $APIM_NAME ($APIM_REGION)"
echo "Students: $STUDENT_COUNT"
echo "Budget:   \$$BUDGET_AMOUNT"
echo "GitHub:   $GITHUB_OWNER/$GITHUB_REPO"
echo "============================================"
echo ""

# ---- Phase 1: Resource Group & Budget ----
if [ "$START_PHASE" -le 1 ]; then
  echo "=== Phase 1: Resource Group & Budget ==="

  run_cmd az group create --name "$RESOURCE_GROUP" --location "$RG_REGION" --output none

  run_cmd az consumption budget create \
    --budget-name "$BUDGET_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --amount "$BUDGET_AMOUNT" --time-grain Monthly \
    --start-date "$(date +%Y-%m-01)" \
    --end-date "$(date -d '+6 months' +%Y-%m-01 2>/dev/null || date -v+6m +%Y-%m-01)" \
    --category Cost || echo "  (Budget may already exist — check Portal for alert thresholds)"

  echo "  >> Set alert thresholds (${BUDGET_ALERT_THRESHOLDS}) in Azure Portal"
  echo "  Phase 1 complete."
  echo ""
fi

# ---- Phase 2: AI Foundry Model Deployments ----
if [ "$START_PHASE" -le 2 ]; then
  echo "=== Phase 2: AI Foundry Model Deployments ==="

  echo "  Verifying AI resource..."
  run_cmd az cognitiveservices account show \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --query "{name:name, region:location, kind:kind}" -o table

  echo "  [1/4] Deploying $GPT_MINI_DEPLOYMENT ($GPT_MINI_MODEL, ${GPT_MINI_TPM}K TPM)..."
  run_cmd az cognitiveservices account deployment create \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$GPT_MINI_DEPLOYMENT" \
    --model-name "$GPT_MINI_MODEL" --model-version "latest" \
    --model-format OpenAI \
    --sku-name Standard --sku-capacity "$GPT_MINI_TPM"

  echo "  [2/4] Deploying $GPT_FULL_DEPLOYMENT ($GPT_FULL_MODEL, ${GPT_FULL_TPM}K TPM)..."
  run_cmd az cognitiveservices account deployment create \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$GPT_FULL_DEPLOYMENT" \
    --model-name "$GPT_FULL_MODEL" --model-version "latest" \
    --model-format OpenAI \
    --sku-name Standard --sku-capacity "$GPT_FULL_TPM"

  echo "  [3/4] Deploying $DEEPSEEK_DEPLOYMENT_1 ($DEEPSEEK_MODEL)..."
  echo "  >> NOTE: Accept marketplace terms in Portal first if not done yet"
  run_cmd az cognitiveservices account deployment create \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$DEEPSEEK_DEPLOYMENT_1" \
    --model-name "$DEEPSEEK_MODEL" --model-version "latest" \
    --model-format OpenAI \
    --sku-name Standard --sku-capacity 1 || echo "  (DeepSeek may need marketplace terms — see INSTALL.md)"

  echo "  [4/4] Deploying $DEEPSEEK_DEPLOYMENT_2 ($DEEPSEEK_MODEL)..."
  run_cmd az cognitiveservices account deployment create \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --deployment-name "$DEEPSEEK_DEPLOYMENT_2" \
    --model-name "$DEEPSEEK_MODEL" --model-version "latest" \
    --model-format OpenAI \
    --sku-name Standard --sku-capacity 1 || echo "  (DeepSeek may need marketplace terms — see INSTALL.md)"

  echo "  Phase 2 complete."
  echo ""
fi

# ---- Phase 3: Entra ID & RBAC ----
if [ "$START_PHASE" -le 3 ]; then
  echo "=== Phase 3: Entra ID & RBAC ==="

  echo "  Creating security group: $SECURITY_GROUP"
  run_cmd az ad group create --display-name "$SECURITY_GROUP" \
    --mail-nickname "ai-class-students" --output none 2>/dev/null || echo "  (Group may already exist)"

  GROUP_ID=$(az ad group show --group "$SECURITY_GROUP" --query id -o tsv 2>/dev/null || echo "")
  if [ -n "$GROUP_ID" ]; then
    echo "  Adding students to group..."
    for i in $(seq -w 1 "$STUDENT_COUNT"); do
      USER_ID=$(az ad user show --id "${i}@${STUDENT_DOMAIN}" --query id -o tsv 2>/dev/null || echo "")
      if [ -n "$USER_ID" ]; then
        run_cmd az ad group member add --group "$GROUP_ID" --member-id "$USER_ID" 2>/dev/null || true
      fi
    done

    echo "  Assigning Cognitive Services User role..."
    AI_RESOURCE_ID=$(az cognitiveservices account show \
      --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
    run_cmd az role assignment create \
      --assignee-object-id "$GROUP_ID" \
      --role "Cognitive Services User" \
      --scope "$AI_RESOURCE_ID" 2>/dev/null || echo "  (Role may already be assigned)"
  fi

  echo "  Creating service principal: $SERVICE_PRINCIPAL"
  SP_OUTPUT=$(az ad sp create-for-rbac --name "$SERVICE_PRINCIPAL" \
    --role Contributor \
    --scopes "/subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
    --sdk-auth 2>/dev/null || echo "{}")

  if [ "$SP_OUTPUT" != "{}" ]; then
    echo "$SP_OUTPUT" > "${PROJECT_ROOT}/.secrets/azure-credentials.json"
    echo "  Service principal saved to .secrets/azure-credentials.json"
  fi

  echo "  Phase 3 complete."
  echo ""
fi

# ---- Phase 4: APIM Setup ----
if [ "$START_PHASE" -le 4 ]; then
  echo "=== Phase 4: APIM Setup ==="
  echo "  WARNING: APIM provisioning takes 30-45 minutes."

  # Check if APIM already exists
  APIM_STATE=$(az apim show --name "$APIM_NAME" --resource-group "$RESOURCE_GROUP" \
    --query provisioningState -o tsv 2>/dev/null || echo "NotFound")

  if [ "$APIM_STATE" = "NotFound" ]; then
    echo "  Creating APIM instance (this will take 30-45 minutes)..."
    run_cmd az apim create --name "$APIM_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --publisher-email "$ADMIN_EMAIL" \
      --publisher-name "$ORG_NAME" \
      --sku-name Developer \
      --location "$APIM_REGION"
  elif [ "$APIM_STATE" = "Succeeded" ]; then
    echo "  APIM already exists and is ready."
  else
    echo "  APIM exists but state is: $APIM_STATE. Waiting..."
    while [ "$APIM_STATE" != "Succeeded" ]; do
      sleep 30
      APIM_STATE=$(az apim show --name "$APIM_NAME" --resource-group "$RESOURCE_GROUP" \
        --query provisioningState -o tsv 2>/dev/null || echo "Pending")
      echo "    State: $APIM_STATE"
    done
  fi

  echo "  Getting Azure OpenAI key..."
  AOAI_KEY=$(az cognitiveservices account keys list \
    --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
    --query key1 -o tsv)

  echo "  Registering Named Value: real-azure-openai-key"
  run_cmd az apim nv create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --named-value-id real-azure-openai-key \
    --display-name "Azure OpenAI Key" \
    --value "$AOAI_KEY" --secret true 2>/dev/null || echo "  (Named Value may already exist)"

  echo "  Creating OpenAI API..."
  run_cmd az apim api create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id openai-api --display-name "OpenAI API" \
    --path openai \
    --service-url "https://${AI_RESOURCE_NAME}.openai.azure.com/openai" \
    --protocols https --subscription-required false 2>/dev/null || echo "  (API may already exist)"

  run_cmd az apim api operation create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id openai-api --operation-id openai-post \
    --display-name "POST OpenAI" --method POST --url-template "/*" 2>/dev/null || true

  run_cmd az apim api operation create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id openai-api --operation-id openai-get \
    --display-name "GET OpenAI" --method GET --url-template "/*" 2>/dev/null || true

  echo "  Creating DeepSeek API..."
  run_cmd az apim api create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id deepseek-api --display-name "DeepSeek API" \
    --path deepseek \
    --service-url "https://${AI_RESOURCE_NAME}.openai.azure.com/openai" \
    --protocols https --subscription-required false 2>/dev/null || echo "  (API may already exist)"

  run_cmd az apim api operation create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id deepseek-api --operation-id deepseek-post \
    --display-name "POST DeepSeek" --method POST --url-template "/*" 2>/dev/null || true

  run_cmd az apim api operation create --service-name "$APIM_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --api-id deepseek-api --operation-id deepseek-get \
    --display-name "GET DeepSeek" --method GET --url-template "/*" 2>/dev/null || true

  echo "  Creating $STUDENT_COUNT student subscriptions..."
  for i in $(seq -w 1 "$STUDENT_COUNT"); do
    run_cmd az apim subscription create --service-name "$APIM_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --subscription-id "sub-student-${i}" \
      --display-name "Student ${i}" \
      --scope "/apis" --state active --output none 2>/dev/null || true
  done

  echo "  >> Apply APIM policies via Portal or REST API (see PRD.md Section 4.3)"
  echo "  Phase 4 complete."
  echo ""
fi

# ---- Phase 5: ACS Email ----
if [ "$START_PHASE" -le 5 ]; then
  echo "=== Phase 5: Azure Communication Services (Email) ==="

  run_cmd az communication create --name "$ACS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location Global --data-location Korea 2>/dev/null || echo "  (ACS may already exist)"

  echo "  Getting ACS connection string..."
  ACS_CONN=$(az communication list-key --name "$ACS_NAME" \
    --resource-group "$RESOURCE_GROUP" --query primaryConnectionString -o tsv 2>/dev/null || echo "")

  if [ -n "$ACS_CONN" ]; then
    echo "  >> Save as GitHub secret: ACS_CONNECTION_STRING"
    echo "  >> Complete Email domain setup in Portal (see INSTALL.md Phase 5)"
  fi

  echo "  Phase 5 complete."
  echo ""
fi

# ---- Phase 6: GitHub Repository Setup ----
if [ "$START_PHASE" -le 6 ]; then
  echo "=== Phase 6: GitHub Repository Setup ==="

  echo "  Setting GitHub secrets..."
  if [ -f "${PROJECT_ROOT}/.secrets/azure-credentials.json" ]; then
    run_cmd gh secret set AZURE_CREDENTIALS < "${PROJECT_ROOT}/.secrets/azure-credentials.json"
  else
    echo "  >> AZURE_CREDENTIALS: set manually from .secrets/azure-credentials.json"
  fi

  if [ -n "${ACS_CONN:-}" ]; then
    run_cmd gh secret set ACS_CONNECTION_STRING --body "$ACS_CONN"
  fi
  if [ -n "${ACS_SENDER_ADDRESS:-}" ]; then
    run_cmd gh secret set ACS_SENDER_ADDRESS --body "$ACS_SENDER_ADDRESS"
  fi
  if [ -n "${CLASS_PASSCODE:-}" ]; then
    run_cmd gh secret set CLASS_PASSCODE --body "$CLASS_PASSCODE"
  fi

  echo "  Setting GitHub repository variables..."
  run_cmd gh variable set RG_NAME --body "$RESOURCE_GROUP" 2>/dev/null || true
  run_cmd gh variable set APIM_NAME --body "$APIM_NAME" 2>/dev/null || true
  run_cmd gh variable set AI_RESOURCE_NAME --body "$AI_RESOURCE_NAME" 2>/dev/null || true
  run_cmd gh variable set BUDGET_NAME --body "$BUDGET_NAME" 2>/dev/null || true
  run_cmd gh variable set STUDENT_DOMAIN --body "$STUDENT_DOMAIN" 2>/dev/null || true
  run_cmd gh variable set APIM_GATEWAY --body "$APIM_GATEWAY" 2>/dev/null || true

  echo "  Creating labels..."
  gh label create onboarding --color 0E8A16 2>/dev/null || true
  gh label create done --color 1D76DB 2>/dev/null || true
  gh label create rejected --color D93F0B 2>/dev/null || true
  gh label create error --color B60205 2>/dev/null || true
  gh label create pending --color FBCA04 2>/dev/null || true
  gh label create cost-alert --color FF6600 2>/dev/null || true
  gh label create urgent --color E11D48 2>/dev/null || true

  echo "  Phase 6 complete."
  echo ""
fi

# ---- Phase 7: Static Web App ----
if [ "$START_PHASE" -le 7 ]; then
  echo "=== Phase 7: Static Web App Deployment ==="

  run_cmd az staticwebapp create --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --source "https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" \
    --branch main \
    --app-location "/docs" \
    --api-location "/api" \
    --location "$SWA_REGION" 2>/dev/null || echo "  (SWA may already exist)"

  echo "  Setting SWA environment variables..."
  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    run_cmd az staticwebapp appsettings set --name "$SWA_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --setting-names \
        "GITHUB_REPO=${GITHUB_OWNER}/${GITHUB_REPO}" \
        "CLASS_PASSCODE=${CLASS_PASSCODE:-}" \
        "ADMIN_PASSWORD=${ADMIN_PASSWORD}" 2>/dev/null || true
    echo "  >> Set GITHUB_PAT manually in SWA Configuration (Portal)"
  fi

  echo "  Phase 7 complete."
  echo ""
fi

echo "============================================"
echo "  Deployment complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Apply APIM policies (see PRD.md Section 4.3)"
echo "  2. Complete ACS Email domain setup in Portal"
echo "  3. Set GITHUB_PAT in SWA Configuration"
echo "  4. Run end-to-end test (see INSTALL.md Phase 8)"
echo ""
echo "SWA URL: https://$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostname -o tsv 2>/dev/null || echo '{check-portal}')"
echo "APIM Gateway: $APIM_GATEWAY"

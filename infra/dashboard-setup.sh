#!/bin/bash
###############################################################################
# dashboard-setup.sh
# APIM Monitoring Dashboard — Infrastructure Setup
#
# Prerequisites:
#   - Azure CLI logged in (az login)
#   - Contributor role on the subscription
#   - API Management service already provisioned
###############################################################################

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SUBSCRIPTION_ID="3354f2f5-e261-49af-9ead-2c6938f447a3"
RESOURCE_GROUP="rg-powerplatform-billing"
APIM_NAME="apim-eduelden-ai"
LOG_ANALYTICS_WORKSPACE="eduelden-ai-resource-logs"
LOCATION="koreacentral"

echo "=== APIM Monitoring Dashboard Setup ==="
echo "Subscription: $SUBSCRIPTION_ID"
echo "Resource Group: $RESOURCE_GROUP"
echo "APIM: $APIM_NAME"
echo "Log Analytics: $LOG_ANALYTICS_WORKSPACE"
echo ""

az account set --subscription "$SUBSCRIPTION_ID"

# ─── Step 1: Get Log Analytics Workspace ID ──────────────────────────────────
echo "[1/5] Fetching Log Analytics Workspace resource ID..."
LA_RESOURCE_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --query id -o tsv 2>/dev/null || true)

if [ -z "$LA_RESOURCE_ID" ]; then
  echo "ERROR: Log Analytics workspace '$LOG_ANALYTICS_WORKSPACE' not found in '$RESOURCE_GROUP'."
  echo "Trying to find it in the subscription..."
  LA_RESOURCE_ID=$(az monitor log-analytics workspace list \
    --subscription "$SUBSCRIPTION_ID" \
    --query "[?name=='$LOG_ANALYTICS_WORKSPACE'].id" -o tsv)
  if [ -z "$LA_RESOURCE_ID" ]; then
    echo "FATAL: Cannot find Log Analytics workspace. Exiting."
    exit 1
  fi
fi
echo "  Found: $LA_RESOURCE_ID"

LA_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --ids "$LA_RESOURCE_ID" \
  --query customerId -o tsv)
echo "  Workspace GUID: $LA_WORKSPACE_ID"

# ─── Step 2: Configure APIM Diagnostic Settings ─────────────────────────────
echo ""
echo "[2/5] Configuring APIM diagnostic settings → Log Analytics..."

APIM_RESOURCE_ID=$(az apim show \
  --name "$APIM_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

# Check if diagnostic setting already exists
EXISTING_DIAG=$(az monitor diagnostic-settings list \
  --resource "$APIM_RESOURCE_ID" \
  --query "[?name=='apim-to-loganalytics'].name" -o tsv 2>/dev/null || true)

if [ -n "$EXISTING_DIAG" ]; then
  echo "  Diagnostic setting 'apim-to-loganalytics' already exists. Skipping."
else
  az monitor diagnostic-settings create \
    --name "apim-to-loganalytics" \
    --resource "$APIM_RESOURCE_ID" \
    --workspace "$LA_RESOURCE_ID" \
    --logs '[
      {"category": "GatewayLogs", "enabled": true, "retentionPolicy": {"enabled": false, "days": 0}},
      {"category": "WebSocketConnectionLogs", "enabled": false, "retentionPolicy": {"enabled": false, "days": 0}}
    ]' \
    --metrics '[
      {"category": "AllMetrics", "enabled": true, "retentionPolicy": {"enabled": false, "days": 0}}
    ]'
  echo "  Diagnostic settings created successfully."
fi

# ─── Step 3: Verify/Create Managed Identity for SWA ─────────────────────────
echo ""
echo "[3/5] Verifying Managed Identity / Service Principal for APIM access..."

# Check if a service principal already exists for the dashboard app
SP_NAME="sp-dashboard-eduelden-ai"
SP_EXISTS=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)

if [ -n "$SP_EXISTS" ]; then
  echo "  Service principal '$SP_NAME' already exists (appId: $SP_EXISTS)."
else
  echo "  Creating service principal '$SP_NAME'..."
  SP_OUTPUT=$(az ad sp create-for-rbac \
    --name "$SP_NAME" \
    --role "API Management Service Reader Role" \
    --scopes "$APIM_RESOURCE_ID" \
    --query "{appId: appId, tenant: tenant}" -o json)
  echo "  Service principal created."
  echo "  IMPORTANT: Store the credentials securely. They were output only once."
  echo "  $SP_OUTPUT"
fi

# Assign Log Analytics Reader role
echo "  Assigning 'Log Analytics Reader' role on workspace..."
az role assignment create \
  --assignee "$SP_NAME" \
  --role "Log Analytics Reader" \
  --scope "$LA_RESOURCE_ID" \
  --only-show-errors 2>/dev/null || echo "  (Role already assigned or assignee not found — verify manually)"

# Assign API Management Service Contributor for subscription management
echo "  Assigning 'API Management Service Contributor' role on APIM..."
az role assignment create \
  --assignee "$SP_NAME" \
  --role "API Management Service Contributor" \
  --scope "$APIM_RESOURCE_ID" \
  --only-show-errors 2>/dev/null || echo "  (Role already assigned or assignee not found — verify manually)"

# ─── Step 4: Display Required App Settings ───────────────────────────────────
echo ""
echo "[4/5] Required Azure Function App Settings (environment variables):"
echo ""
echo "  AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
echo "  AZURE_RESOURCE_GROUP=$RESOURCE_GROUP"
echo "  APIM_SERVICE_NAME=$APIM_NAME"
echo "  LOG_ANALYTICS_WORKSPACE_ID=$LA_WORKSPACE_ID"
echo "  ADMIN_TOKEN=<generate-a-secure-token>"
echo "  ADMIN_PASSWORD=<set-admin-password>"
echo "  ADMIN_EMAIL=admin@eldensoluton.kr"
echo ""
echo "  Set these in SWA Application Settings (Azure Portal > Static Web App > Configuration)."

# ─── Step 5: Install API npm dependencies ────────────────────────────────────
echo ""
echo "[5/5] Installing API npm dependencies..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/../api"

if [ -d "$API_DIR" ]; then
  cd "$API_DIR"
  npm install @azure/identity @azure/monitor-query --save
  echo "  Dependencies installed: @azure/identity, @azure/monitor-query"
else
  echo "  WARNING: api/ directory not found at $API_DIR. Install manually:"
  echo "    cd api && npm install @azure/identity @azure/monitor-query"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Set the environment variables in Azure SWA Configuration"
echo "  2. Verify APIM GatewayLogs are flowing to Log Analytics (may take 5-10 min)"
echo "  3. Add the APIM outbound policy for token usage capture (see deploy checklist)"
echo "  4. Push to main to trigger the dashboard-deploy workflow"

#!/bin/bash
set -euo pipefail

# Load config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$(dirname "$SCRIPT_DIR")/config.env"
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
else
  echo "WARNING: config.env not found. Using defaults."
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-powerplatform-billing}"
BUDGET_NAME="${BUDGET_NAME:-eduelden-ai-budget}"
AI_RESOURCE_NAME="${AI_RESOURCE_NAME:-eduelden-ai-resource}"
THRESHOLD_WARN=80

echo "=== Azure AI Foundry Cost Monitor ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

BUDGET=$(az consumption budget show \
  --budget-name "$BUDGET_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output json 2>/dev/null || echo "{}")

AMOUNT=$(echo "$BUDGET" | jq -r '.amount // 800')
CURRENT=$(echo "$BUDGET" | jq -r '.currentSpend.amount // 0')
UNIT=$(echo "$BUDGET" | jq -r '.currentSpend.unit // "USD"')

if [ "$CURRENT" = "null" ]; then CURRENT=0; fi

PERCENT=$(echo "scale=1; $CURRENT * 100 / $AMOUNT" | bc 2>/dev/null || echo "0")

echo "Budget: \$$AMOUNT $UNIT"
echo "Current Spend: \$$CURRENT $UNIT ($PERCENT%)"

if (( $(echo "$PERCENT > $THRESHOLD_WARN" | bc -l 2>/dev/null || echo 0) )); then
  echo "WARNING: Spend exceeds ${THRESHOLD_WARN}% threshold!"
  exit 1
fi

echo ""
echo "=== Model Deployment Status ==="
az cognitiveservices account deployment list \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "[].{name:name,model:properties.model.name,state:properties.provisioningState}" \
  --output table

echo ""
echo "=== Done ==="

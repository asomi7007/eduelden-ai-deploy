#!/bin/bash
set -euo pipefail

SUB_ID="3354f2f5-e261-49af-9ead-2c6938f447a3"
RG="rg-powerplatform-billing"
BUDGET_NAME="eduelden-ai-budget"
THRESHOLD_WARN=80

echo "=== Azure AI Foundry 비용 모니터 ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

BUDGET=$(az consumption budget show \
  --budget-name "$BUDGET_NAME" \
  --resource-group "$RG" \
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
echo "=== 모델별 배포 상태 ==="
az cognitiveservices account deployment list \
  --name eduelden-ai-resource --resource-group "$RG" \
  --query "[].{name:name,model:properties.model.name,state:properties.provisioningState}" \
  --output table

echo ""
echo "=== 완료 ==="

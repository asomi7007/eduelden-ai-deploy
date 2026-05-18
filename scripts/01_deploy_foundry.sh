#!/bin/bash
set -euo pipefail

RG="rg-powerplatform-billing"
RESOURCE="eduelden-ai-resource"

echo "=== AI Foundry 모델 배포 스크립트 ==="

# gpt-5.5 (고품질, TPM 50K)
echo "[1/4] gpt-5.5 배포..."
az cognitiveservices account deployment create \
  --name "$RESOURCE" --resource-group "$RG" \
  --deployment-name gpt-55 \
  --model-name gpt-5.5 --model-version "2026-04-24" \
  --model-format OpenAI \
  --sku-capacity 50 --sku-name GlobalStandard

# gpt-5.4-mini (범용, TPM 100K)
echo "[2/4] gpt-5.4-mini 배포..."
az cognitiveservices account deployment create \
  --name "$RESOURCE" --resource-group "$RG" \
  --deployment-name gpt-54-mini \
  --model-name gpt-5.4-mini --model-version "2026-03-17" \
  --model-format OpenAI \
  --sku-capacity 100 --sku-name GlobalStandard

# DeepSeek-V4-Flash x2
echo "[3/4] DeepSeek-V4-Flash #1 배포..."
az cognitiveservices account deployment create \
  --name "$RESOURCE" --resource-group "$RG" \
  --deployment-name deepseek-v4-flash-1 \
  --model-name DeepSeek-V4-Flash --model-version "2026-04-23" \
  --model-format DeepSeek \
  --sku-capacity 1 --sku-name GlobalStandard

echo "[4/4] DeepSeek-V4-Flash #2 배포..."
az cognitiveservices account deployment create \
  --name "$RESOURCE" --resource-group "$RG" \
  --deployment-name deepseek-v4-flash-2 \
  --model-name DeepSeek-V4-Flash --model-version "2026-04-23" \
  --model-format DeepSeek \
  --sku-capacity 1 --sku-name GlobalStandard

echo "=== 배포 완료 ==="
az cognitiveservices account deployment list \
  --name "$RESOURCE" --resource-group "$RG" \
  --query "[].{name:name,model:properties.model.name,state:properties.provisioningState}" \
  --output table

#!/bin/bash
set -euo pipefail

# Load config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$(dirname "$SCRIPT_DIR")/config.env"
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
else
  echo "WARNING: config.env not found. Using defaults."
  RESOURCE_GROUP="${RESOURCE_GROUP:-rg-powerplatform-billing}"
  AI_RESOURCE_NAME="${AI_RESOURCE_NAME:-eduelden-ai-resource}"
fi

echo "=== AI Foundry Model Deployment ==="
echo "Resource: $AI_RESOURCE_NAME"
echo "RG: $RESOURCE_GROUP"

# GPT high-quality model
echo "[1/4] Deploying ${GPT_FULL_DEPLOYMENT:-gpt-55} (${GPT_FULL_MODEL:-gpt-5.5}, ${GPT_FULL_TPM:-50}K TPM)..."
az cognitiveservices account deployment create \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --deployment-name "${GPT_FULL_DEPLOYMENT:-gpt-55}" \
  --model-name "${GPT_FULL_MODEL:-gpt-5.5}" --model-version "latest" \
  --model-format OpenAI \
  --sku-capacity "${GPT_FULL_TPM:-50}" --sku-name Standard

# GPT fast model
echo "[2/4] Deploying ${GPT_MINI_DEPLOYMENT:-gpt-54-mini} (${GPT_MINI_MODEL:-gpt-5.4-mini}, ${GPT_MINI_TPM:-100}K TPM)..."
az cognitiveservices account deployment create \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --deployment-name "${GPT_MINI_DEPLOYMENT:-gpt-54-mini}" \
  --model-name "${GPT_MINI_MODEL:-gpt-5.4-mini}" --model-version "latest" \
  --model-format OpenAI \
  --sku-capacity "${GPT_MINI_TPM:-100}" --sku-name Standard

# DeepSeek x2 (round-robin)
echo "[3/4] Deploying ${DEEPSEEK_DEPLOYMENT_1:-deepseek-v4-flash-1}..."
az cognitiveservices account deployment create \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --deployment-name "${DEEPSEEK_DEPLOYMENT_1:-deepseek-v4-flash-1}" \
  --model-name "${DEEPSEEK_MODEL:-DeepSeek-V4-Flash}" --model-version "latest" \
  --model-format OpenAI \
  --sku-capacity 1 --sku-name Standard

echo "[4/4] Deploying ${DEEPSEEK_DEPLOYMENT_2:-deepseek-v4-flash-2}..."
az cognitiveservices account deployment create \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --deployment-name "${DEEPSEEK_DEPLOYMENT_2:-deepseek-v4-flash-2}" \
  --model-name "${DEEPSEEK_MODEL:-DeepSeek-V4-Flash}" --model-version "latest" \
  --model-format OpenAI \
  --sku-capacity 1 --sku-name Standard

echo "=== Deployment Complete ==="
az cognitiveservices account deployment list \
  --name "$AI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "[].{name:name,model:properties.model.name,state:properties.provisioningState}" \
  --output table

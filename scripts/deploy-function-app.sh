#!/bin/bash
# Azure Function App 배포 스크립트
# 온보딩 페이지 백엔드 API (GitHub PAT을 안전하게 보관)

set -euo pipefail

RG="rg-powerplatform-billing"
LOCATION="koreacentral"
FUNC_NAME="func-eduelden-onboard"
STORAGE_NAME="stedueldenfunc"  # 24자 이하, 소문자+숫자

echo "=== Azure Function App 배포 ==="

# 1. Storage Account 생성 (Functions에 필수)
echo "[1/4] Storage Account 생성..."
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none

# 2. Function App 생성 (Consumption plan = 무료 티어)
echo "[2/4] Function App 생성..."
az functionapp create \
  --name "$FUNC_NAME" \
  --resource-group "$RG" \
  --storage-account "$STORAGE_NAME" \
  --consumption-plan-location "$LOCATION" \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux \
  --output none

# 3. CORS 설정
echo "[3/4] CORS 설정..."
az functionapp cors add \
  --name "$FUNC_NAME" \
  --resource-group "$RG" \
  --allowed-origins "https://asomi7007.github.io" "http://localhost:3000" \
  --output none

# 4. 앱 설정 (환경변수)
echo "[4/4] 환경변수 설정..."
echo "⚠️  아래 값을 직접 설정해주세요:"
echo ""
echo "az functionapp config appsettings set \\"
echo "  --name $FUNC_NAME \\"
echo "  --resource-group $RG \\"
echo "  --settings \\"
echo "    GITHUB_PAT=ghp_YOUR_TOKEN \\"
echo "    GITHUB_REPO=asomi7007/eduelden-ai-deploy \\"
echo "    ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD \\"
echo "    CLASS_PASSCODE='!!ed7788'"
echo ""
echo "=== Function App URL: https://${FUNC_NAME}.azurewebsites.net ==="
echo "=== 배포: cd api && func azure functionapp publish ${FUNC_NAME} ==="

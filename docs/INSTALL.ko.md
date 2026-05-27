# 설치 매뉴얼: Azure AI Foundry 바이브코딩 실습 환경

> 전체 플랫폼을 처음부터 구축하는 단계별 가이드예요.
> Phase 순서대로 진행하세요. 건너뛰지 마세요.

---

## 사전 준비

- Owner 권한이 있는 Azure 구독
- Azure CLI 2.50+ 설치 및 로그인 (`az login`) — `az --version`으로 확인
- GitHub 계정 + `gh` CLI 2.0+ 설치 — `gh --version`으로 확인
- 학생 계정이 미리 생성된 도메인 (`01@도메인` ~ `50@도메인`)
- Node.js 18.x 또는 20.x LTS (SWA API 개발용) — `node --version`으로 확인
- PowerShell 5.1+ (학생 설정 스크립트에 필요) — `$PSVersionTable.PSVersion`으로 확인

---

## 빠른 시작 (자동 배포)

각 Phase를 수동으로 따라가는 대신, 한 번에 모두 배포하고 싶다면:

### 1. 설정

```bash
cp config.env.template config.env
# config.env를 조직에 맞는 값으로 편집하세요
```

### 2. 배포

```bash
chmod +x scripts/deploy-all.sh
./scripts/deploy-all.sh
```

### 3. 특정 Phase부터 재개

```bash
./scripts/deploy-all.sh --phase 4    # Phase 4부터 재개
./scripts/deploy-all.sh --dry-run    # 실행하지 않고 미리보기
```

> 자동 스크립트는 Phase 1-7을 처리해요. 다음 작업은 직접 해야 해요:
>
> - APIM 정책 수동 적용 (Phase 4 — PRD.ko.md 섹션 4.3 참고)
> - Portal에서 ACS Email 도메인 설정 완료 (Phase 5)
> - SWA 구성에서 `GITHUB_PAT` 설정 (Phase 7)
> - 대시보드 SWA 별도 배포 (Phase 7b)
> - 엔드투엔드 테스트 실행 (Phase 8)

단계별로 직접 제어하고 싶다면, 아래 수동 Phase를 계속 진행하세요.

---

## Phase 1: 리소스 그룹 및 예산

```bash
# 1. 리소스 그룹 생성 또는 확인
az group create --name rg-{name} --location koreacentral

# 2. 예산 생성 ($800, 월별)
az consumption budget create \
  --budget-name "eduelden-ai-budget" \
  --resource-group rg-{name} \
  --amount 800 --time-grain Monthly \
  --start-date $(date +%Y-%m-01) --end-date $(date -d "+6 months" +%Y-%m-01) \
  --category Cost

# 3. 알림 임계값 추가 (50%, 80%, 95%) -- Azure Portal에서 설정 필요
# Portal > Cost Management > Budgets > ai-class-budget > Alert conditions
```

---

## Phase 2: AI Foundry 설정

```bash
# 1. 기존 AI Foundry 리소스 확인
az cognitiveservices account show \
  --name {ai-resource-name} \
  --resource-group rg-{name}

# 2. 사용 가능한 모델 확인
az cognitiveservices account list-models \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --query "[].{model:model.name, version:model.version}" -o table

# 3. 모델 배포 (카탈로그 확인 후 모델명 조정)
# GPT 모델 (범용, 빠름)
az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name gpt-54-mini \
  --model-name gpt-5.4-mini \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 100

# GPT 모델 (고품질)
az cognitiveservices account deployment create \
  --name {ai-resource-name} \
  --resource-group rg-{name} \
  --deployment-name gpt-55 \
  --model-name gpt-5.5 \
  --model-version "latest" \
  --model-format OpenAI \
  --sku-name Standard --sku-capacity 50

# DeepSeek (마켓플레이스 모델 — 약관 동의 필요)
# 중요: CLI 배포 전에 Azure Portal에서 약관을 수락하세요:
#   1. Portal > AI Foundry > 모델 카탈로그 > "DeepSeek-V4-Flash" 검색
#   2. "배포" 클릭 > 마켓플레이스 약관 수락
#   3. Portal 배포를 취소하세요 (CLI로 배포하거나 Portal 배포를 그대로 사용)
#   4. CLI에서 "MarketplaceTermsNotAccepted" 오류 발생 시, 1-2단계를 먼저 완료하세요
#
# 부하 분산을 위해 2개 인스턴스 배포:
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

## Phase 3: Entra ID 및 RBAC

```bash
# 1. 보안 그룹 생성
az ad group create --display-name AI-Class-Students-{name} \
  --mail-nickname ai-class-students

# 2. 학생을 그룹에 추가 (01-50 반복)
GROUP_ID=$(az ad group show --group "AI-Class-Students-{name}" --query id -o tsv)
for i in $(seq -w 1 50); do
  USER_ID=$(az ad user show --id "${i}@{domain}" --query id -o tsv 2>/dev/null)
  if [ -n "$USER_ID" ]; then
    az ad group member add --group $GROUP_ID --member-id $USER_ID
    echo "Added ${i}@{domain}"
  fi
done

# 3. Cognitive Services User 역할 할당
AI_RESOURCE_ID=$(az cognitiveservices account show \
  --name {ai-resource-name} --resource-group rg-{name} --query id -o tsv)
az role assignment create \
  --assignee-object-id $GROUP_ID \
  --role "Cognitive Services User" \
  --scope $AI_RESOURCE_ID

# 4. GitHub Actions용 서비스 주체 생성
az ad sp create-for-rbac --name github-actions-{name} \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-{name} \
  --sdk-auth
# 출력된 JSON을 저장하세요 -- AZURE_CREDENTIALS 시크릿이 될 거예요
# 참고: --sdk-auth는 Azure CLI 2.30+에서 더 이상 사용되지 않으며 경고가 표시돼요.
# 이것은 정상이에요 — 출력 JSON 형식은 azure/login@v2에서 여전히 필요해요.
# 사용 중단 경고를 무시하거나, 보다 현대적인 방식인 OpenID Connect
# 페더레이션 자격 증명으로 마이그레이션을 고려하세요.
```

---

## Phase 4: APIM 설정

```bash
# 1. APIM 인스턴스 생성 (약 30분 소요)
az apim create --name apim-{name}-ai \
  --resource-group rg-{name} \
  --publisher-email admin@{domain} \
  --publisher-name "{org-name}" \
  --sku-name Developer \
  --location {region}

# ⚠️ 중요: APIM 프로비저닝에 30-45분이 소요돼요.
# 프로비저닝이 완료될 때까지 2단계로 넘어가지 마세요.
# 상태 확인:
az apim show --name apim-{name}-ai --resource-group rg-{name} \
  --query provisioningState -o tsv
# 출력이 "Succeeded"가 될 때까지 기다리세요.

# 2. Azure OpenAI 키 가져오기 및 Named Value로 등록
AOAI_KEY=$(az cognitiveservices account keys list \
  --name {ai-resource-name} --resource-group rg-{name} \
  --query key1 -o tsv)

# 키를 APIM Named Value로 등록 (정책에서 {{aoai-api-key}}로 참조)
# ARM API를 통해 시크릿 Named Value 생성
APIM_RESOURCE_ID="/subscriptions/{subscription-id}/resourceGroups/rg-{name}/providers/Microsoft.ApiManagement/service/apim-{name}-ai"
az rest --method put \
  --url "https://management.azure.com${APIM_RESOURCE_ID}/namedValues/aoai-api-key?api-version=2023-09-01-preview" \
  --body "{\"properties\":{\"displayName\":\"aoai-api-key\",\"value\":\"$AOAI_KEY\",\"secret\":true}}"

# 2.5 진단 로그 설정 — Resource-specific 모드 활성화 (Log Analytics 쿼리에 필수)
az monitor diagnostic-settings create --name "apim-to-loganalytics" \
  --resource "apim-{name}-ai" --resource-group "rg-{name}" \
  --resource-type "Microsoft.ApiManagement/service" \
  --workspace "eduelden-ai-resource-logs" \
  --export-to-resource-specific true \
  --logs '[{"category":"GatewayLogs","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

# 3. OpenAI API 생성
az apim api create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api --display-name "OpenAI API" \
  --path openai \
  --service-url "https://{ai-resource-name}.openai.azure.com/openai" \
  --protocols https --subscription-required false

# 4. 범용 오퍼레이션 생성
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api \
  --operation-id openai-all \
  --display-name "All OpenAI" \
  --method POST --url-template "/*"

# 4b. GET 오퍼레이션 추가 (Cline이 조회할 수 있는 /models 엔드포인트용)
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id openai-api \
  --operation-id openai-get \
  --display-name "GET OpenAI" \
  --method GET --url-template "/*"

# 5. DeepSeek API 생성 (같은 패턴, 다른 경로)
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

# 5b. DeepSeek GET 오퍼레이션 추가 (Cline이 조회할 수 있는 /models 엔드포인트용)
az apim api operation create --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --api-id deepseek-api \
  --operation-id deepseek-get \
  --display-name "GET DeepSeek" \
  --method GET --url-template "/*"

# 6. APIM 정책 적용 -- 전체 XML은 PRD.ko.md 섹션 4.3 참고
# Azure Portal > APIM > APIs > openai-api > Inbound processing > Code editor 사용
# 또는 az rest를 사용하여 프로그래밍 방식으로 PUT

# 7. 학생 구독 생성 (50개)
for i in $(seq -w 1 50); do
  az apim subscription create --service-name apim-{name}-ai \
    --resource-group rg-{name} \
    --subscription-id "sub-student-${i}" \
    --display-name "Student ${i}" \
    --scope "/apis" --state active
done
```

### APIM 정책 적용

APIM 정책의 핵심 사항:

- **Named Value 참조**: Azure OpenAI 키는 `set-header` 요소에서 `{{aoai-api-key}}`로 참조됩니다 (하드코딩 금지).
- **파라미터 제거**: 다음 6개 파라미터는 **모든 모델 요청**에서 일괄 제거됩니다 (gpt-55만이 아닌 전체 모델):
  `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`

```powershell
# REST API를 통한 정책 적용 (PowerShell 예시)
$token = (az account get-access-token --query accessToken -o tsv)
$headers = @{Authorization="Bearer $token"; "Content-Type"="application/json"}

$policy = @'
<policies>
  <inbound>
    <base />
    <!-- 전체 정책 XML은 PRD.ko.md 섹션 4.3 참고 -->
    <!-- 포함 필수: 다중 헤더 인증, URL 재작성, 속도 제한 -->
    <!-- 키 주입: <set-header name="api-key"><value>{{aoai-api-key}}</value></set-header> -->
    <!-- 전체 모델 파라미터 제거: prediction, stream_options, service_tier, store, metadata, reasoning_effort -->
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

## Phase 5: Azure Communication Services (이메일)

```bash
# 1. ACS 리소스 생성
az communication create --name acs-{name}-email \
  --resource-group rg-{name} \
  --location Global --data-location Korea

# 2. Email Communication Service 생성 (Portal 필요 — 상세 단계)
# 2a단계: Portal > "Email Communication Services" 검색 > 만들기
#          이름: acs-{name}-email-svc, 데이터 위치: Korea
# 2b단계: 생성 후 > "도메인 프로비전" > "Azure 관리형 도메인 추가"
# 2c단계: Communication Services 리소스로 이동 > "도메인" > "도메인 연결"
#          > 2b단계에서 만든 도메인 선택
# 2d단계: MailFrom 주소에서 발신자 확인: donotreply@{guid}.azurecomm.net

# 3. 연결 문자열 가져오기
ACS_CONN=$(az communication list-key --name acs-{name}-email \
  --resource-group rg-{name} --query primaryConnectionString -o tsv)
# GitHub 시크릿으로 저장: ACS_CONNECTION_STRING
```

---

## Phase 6: GitHub 저장소 설정

```bash
# 1. 저장소 생성
gh repo create {owner}/eduelden-ai-deploy --public

# 2. 클론 및 구조 설정
git clone https://github.com/{owner}/eduelden-ai-deploy.git
cd eduelden-ai-deploy

# 3. 디렉터리 구조 생성
mkdir -p docs api/src/functions scripts .github/workflows .github/ISSUE_TEMPLATE

# 4. API 초기화 (Azure Functions v4)
cd api && npm init -y
npm install @azure/functions
# 함수 파일 복사: slots.js, onboard.js, cancel.js, admin.js

# 5. GitHub 시크릿 설정
gh secret set AZURE_CREDENTIALS < azure-credentials.json
gh secret set ACS_CONNECTION_STRING --body "$ACS_CONN"
gh secret set ACS_SENDER_ADDRESS --body "donotreply@{guid}.azurecomm.net"
gh secret set CLASS_PASSCODE --body "your-passcode"

# 6. 라벨 생성
gh label create onboarding --color 0E8A16
gh label create done --color 1D76DB
gh label create rejected --color D93F0B
gh label create error --color B60205
gh label create pending --color FBCA04
gh label create cost-alert --color FF6600
gh label create urgent --color E11D48
```

---

## Phase 7: Static Web App 배포 (온보딩)

```bash
# 1. SWA 생성 (Portal 또는 CLI로)
az staticwebapp create --name swa-{name}-onboard \
  --resource-group rg-{name} \
  --source https://github.com/{owner}/eduelden-ai-deploy \
  --branch main \
  --app-location "/docs" \
  --api-location "/api" \
  --location eastus2

# 2. SWA 환경 변수 설정
az staticwebapp appsettings set --name swa-{name}-onboard \
  --resource-group rg-{name} \
  --setting-names \
    GITHUB_PAT="{your-pat}" \
    GITHUB_REPO="{owner}/eduelden-ai-deploy" \
    CLASS_PASSCODE="{your-passcode}" \
    ADMIN_PASSWORD="{your-admin-password}"

# 3. docs/에 staticwebapp.config.json이 있는지 확인
cat docs/staticwebapp.config.json
# navigationFallback + /api/* anonymous 라우트가 포함되어야 함

# 4. 코드 푸시 -- SWA가 GitHub에서 자동 배포
git add . && git commit -m "Initial setup" && git push
```

---

## Phase 7b: 대시보드 SWA 배포

관리자 대시보드(`swa-{name}-dashboard`)는 온보딩 SWA와는 별도의 SWA예요.
`dashboard/` 폴더의 React + Vite 소스를 `dashboard-deploy.yml` GitHub Actions 워크플로우가
`main` 브랜치 push 시마다 자동으로 빌드하여 배포해요.

```bash
# 1. 대시보드 SWA 생성 (Free 티어, eastasia 리전)
az staticwebapp create --name swa-{name}-dashboard \
  --resource-group rg-{name} \
  --location eastasia

# 2. 배포 토큰 가져오기
SWA_DASHBOARD_TOKEN=$(az staticwebapp secrets list \
  --name swa-{name}-dashboard \
  --resource-group rg-{name} \
  --query properties.apiKey -o tsv)

# 3. 토큰을 GitHub Secret으로 등록 (dashboard-deploy.yml에서 사용)
gh secret set AZURE_SWA_DASHBOARD_TOKEN --body "$SWA_DASHBOARD_TOKEN"

# 4. 대시보드 애플리케이션 설정 (환경 변수 11개)
az staticwebapp appsettings set --name swa-{name}-dashboard \
  --resource-group rg-{name} \
  --setting-names \
    ADMIN_PASSWORD="{your-admin-password}" \
    ADMIN_TOKEN="{your-admin-token}" \
    AZURE_SUBSCRIPTION_ID="{subscription-id}" \
    AZURE_RESOURCE_GROUP="rg-{name}" \
    APIM_SERVICE_NAME="apim-{name}-ai" \
    AI_RESOURCE_NAME="{ai-resource-name}" \
    GITHUB_PAT="{your-pat}" \
    GITHUB_REPO="{owner}/eduelden-ai-deploy" \
    LOG_ANALYTICS_WORKSPACE_ID="{workspace-id}" \
    LOG_ANALYTICS_KEY="{workspace-key}" \
    COST_BUDGET_NAME="eduelden-ai-budget"

# 5. main에 푸시 -- dashboard-deploy.yml이 dashboard/ 폴더를 자동 배포
git add . && git commit -m "Add dashboard" && git push
```

**주의사항**:

- 대시보드는 SWA의 내장 `Authorization` 헤더 처리와 충돌을 피하기 위해 `Authorization: Bearer` 대신 `X-Admin-Token` 헤더로 인증해요.
- `dashboard-deploy.yml` 워크플로우는 `main` push 시 트리거되며, `dashboard/` 폴더에서 `npm run build`로 빌드해요.
- 대시보드 URL 확인: `az staticwebapp show --name swa-{name}-dashboard --resource-group rg-{name} --query defaultHostname -o tsv`

---

## Phase 8: 엔드투엔드 테스트

```bash
# 1. SWA URL 방문
# https://{random-name}.azurestaticapps.net

# 2. 테스트 학생 입력 (ID: 01, email: your-email@test.com, 패스코드)

# 3. 확인 사항:
#    - 'onboarding' 라벨이 붙은 GitHub Issue 생성됨
#    - Actions 워크플로우 성공적으로 완료됨
#    - 모든 자격 증명이 포함된 이메일 수신됨
#    - setup-student.ps1 다운로드 작동함
#    - 스크립트가 VS Code + Cline 설치함
#    - Cline이 APIM에 연결되어 AI 응답을 받음

# 4. 3개 모델 모두 테스트:
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

## 헬퍼 스크립트

| 스크립트 | 용도 | 사용법 |
|---|---|---|
| `scripts/deploy-all.sh` | 전체 자동 배포 (Phase 1-7) | `./scripts/deploy-all.sh` |
| `scripts/01_deploy_foundry.sh` | AI 모델만 배포 | `./scripts/01_deploy_foundry.sh` |
| `scripts/02_manage_keys.sh` | 학생 APIM 키 관리 | `./scripts/02_manage_keys.sh {create\|export\|list\|disable\|enable\|regenerate}` |
| `scripts/cost-monitor.sh` | 현재 지출 확인 | `./scripts/cost-monitor.sh` |
| `scripts/setup-student.ps1` | 학생 PC 자동 설정 | `.\setup-student.ps1 -StudentId 01 -ApiKey "key"` |

모든 bash 스크립트는 프로젝트 루트의 `config.env`를 읽어요. 실행 전에 `config.env.template`을 복사하고 값을 채우세요.

### setup-student.ps1 — 설치 내용

이 스크립트는 학생 Windows PC에서 실행되며 다음을 설치해요:

1. VS Code (미설치 시)
2. Cline 확장 (`saoudrizwan.claude-dev`)
3. Cline 설정 (`~/.cline/data/globalState.json`) — APIM 엔드포인트 + 학생 API 키 포함
4. **Power BI MCP** — exe를 다운로드하고 Cline MCP 설정에 등록하여 AI 에디터에서 Power BI를 직접 사용할 수 있게 해요. transport 오류 방지를 위해 npm/npx가 아닌 exe를 직접 실행하도록 등록해야 해요.

---

## 문제 해결 빠른 참조

| 증상 | 원인 | 해결 방법 |
|---|---|---|
| SWA API가 `/api/admin*`에서 404 반환 | SWA가 admin 경로를 예약 | 라우트 이름 변경 (예: `/api/manage`) |
| 워크플로우 이메일 단계에서 401 실패 | ACS HMAC 인증 문제 | bash openssl 대신 Node.js crypto 사용 |
| 학생이 APIM에서 401 받음 | 잘못된 인증 헤더 | APIM 정책이 Bearer/api-key/Ocp 헤더에서 추출해야 함 |
| 학생이 APIM에서 404 받음 | URL 형식 불일치 | APIM 정책이 `/chat/completions`을 `/deployments/{model}/chat/completions`으로 재작성해야 함 |
| PowerShell 스크립트에 깨진 글자 표시 | 한국어 인코딩 문제 | 스크립트는 영문만 사용 |
| Cline에 빈 설정 표시 | 잘못된 설정 경로 | `settings.json`이 아닌 `~/.cline/data/globalState.json`에 작성 |
| 이메일이 수신되지 않음 | Exchange 라이선스 문제 | Graph API 대신 ACS Email 사용 |
| GitHub Actions 워크플로우 트리거 안 됨 | `onboarding` 라벨 누락 또는 워크플로우가 기본 브랜치에 없음 | Issue에 `onboarding` 라벨이 있는지 확인. `.github/workflows/student-onboarding.yml`이 `main` 브랜치에 있고 Actions 탭에서 워크플로우가 활성화되어 있는지 확인 |
| APIM에서 `SubscriptionNotFound` | 학생 ID 형식 불일치 (01 vs 1) | APIM 구독이 0-패딩된 ID를 사용하는지 확인 (`sub-student-01`). `seq -w 1 50`이 이를 올바르게 처리함 |
| ACS 이메일 `403 Forbidden` | 이메일 도메인이 ACS 리소스에 연결되지 않음 | Portal > Communication Services > 도메인 > 도메인이 "연결됨" 상태인지 확인 |
| SWA에서 `502 Bad Gateway` | `GITHUB_PAT`이 설정되지 않았거나 만료됨 | SWA > 구성에서 GITHUB_PAT 확인. PAT에 `repo` 범위가 있고 만료되지 않았는지 확인 |
| 삭제 후 APIM 재생성 불가 | APIM 일시 삭제 (48시간 보존) | 먼저 제거: `az apim deletedservice purge --service-name apim-{name}-ai --location {region}` |
| DeepSeek 배포 시 `MarketplaceTermsNotAccepted` | 마켓플레이스 약관 미수락 | Portal에서 약관 수락: AI Foundry > 모델 카탈로그 > DeepSeek > 배포 > 약관 수락 |
| 올바른 비밀번호에도 대시보드 API가 401 반환 | SWA가 `Authorization` 헤더를 가로챔 | 대시보드는 `Authorization: Bearer` 대신 `X-Admin-Token` 헤더로 인증 |
| Log Analytics에서 APIM GatewayLogs가 0건 | 진단 설정이 Resource-specific 모드가 아님 | `--export-to-resource-specific true` 옵션으로 진단 설정 재생성 (Phase 4 2.5단계) |
| 학생이 APIM에서 gpt-55로 403 또는 400 받음 | 요청 본문에 지원되지 않는 파라미터 포함 | APIM 정책이 전체 모델에 대해 `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort` 제거하는지 확인 |
| Cline에서 Power BI MCP transport 오류 | MCP 서버가 exe 대신 npm 래퍼로 실행됨 | MCP 설정에 Power BI MCP exe 경로를 직접 등록; `npx` 또는 `npm exec` 사용 금지 |

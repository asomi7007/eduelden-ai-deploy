# 기술 아키텍처 해설: 서빙 · 배포 · 관리 · 사용

> 이 문서는 시스템이 **왜 이렇게 동작하는지** 기술적 배경과 설계 근거를 설명합니다.  
> "무엇을 설치하라"가 아니라 "왜 이 구조인가"에 초점을 맞춥니다.

---

## 1. 서빙 (Serving) — 요청이 처리되는 과정

### 1.1 전체 요청 흐름

```text
학생 PC (VS Code + Cline)
    │
    │  POST /openai/v1/chat/completions
    │  Header: Authorization: Bearer <APIM구독키>
    │  Body: {"model": "gpt-54-mini", "messages": [...]}
    │
    ▼
Azure APIM (apim-eduelden-ai.azure-api.net)
    │
    │  ① 구독 키 검증 (subscription-key 또는 Bearer 토큰)
    │  ② Rate Limit 확인 (10/분, 200/일)
    │  ③ 요청 Body에서 model 필드 추출
    │  ④ URL 재작성: /v1/chat/completions → /deployments/{model}/chat/completions
    │  ⑤ 불필요 파라미터 제거 (prediction, stream_options 등 6개)
    │  ⑥ Authorization 헤더를 백엔드 API 키로 교체
    │
    ▼
Azure OpenAI (eduelden-ai-resource.openai.azure.com)
    │
    │  응답 생성 후 반환
    │
    ▼
APIM → 학생 PC (응답 전달)
```

### 1.2 APIM이 하는 일 — 6단계 인바운드 처리

APIM 정책(XML)이 요청을 받으면 6가지 변환을 순서대로 수행합니다.

**① 인증 검증**

학생은 APIM 구독 키를 `Authorization: Bearer` 헤더로 보냅니다. APIM은 이 키가 유효한 구독에 속하는지 확인하고, 유효하지 않으면 `401 Unauthorized`를 반환합니다.

**② Rate Limit**

```xml
<rate-limit calls="10" renewal-period="60" />
<quota calls="200" renewal-period="86400" />
```

분당 10회, 일 200회를 초과하면 `429 Too Many Requests`를 반환합니다. 이 제한은 학생 1명(구독 키 1개) 단위로 적용됩니다. 50명이 동시에 사용해도 서로 영향을 주지 않습니다.

왜 이 숫자인가? Cline은 한 번의 코딩 세션에서 보통 5~15회 API 호출을 합니다. 분당 10회면 일반적인 사용에는 충분하고, 스크립트로 무한 루프를 돌리는 사고를 막을 수 있습니다. 일 200회면 3시간 워크숍에서 자유롭게 사용하기에 넉넉합니다.

**③ 모델 이름 추출**

```xml
<set-variable name="modelName" 
  value="@(context.Request.Body.As<JObject>()["model"]?.ToString() ?? "gpt-54-mini")" />
```

요청 Body의 `model` 필드에서 배포 이름을 꺼냅니다. Cline이 `{"model": "gpt-54-mini"}`를 보내면 `gpt-54-mini`를 추출합니다.

**④ URL 재작성**

Cline(OpenAI 호환 클라이언트)은 이렇게 보냅니다:

```text
POST /openai/v1/chat/completions
```

Azure OpenAI는 이걸 기대합니다:

```text
POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
```

APIM 정책이 URL 경로를 재작성해서 이 차이를 메웁니다. 학생은 표준 OpenAI 형식만 알면 되고, Azure의 배포 기반 URL 구조를 몰라도 됩니다.

왜 이게 필요한가? Azure OpenAI는 모델을 "배포(deployment)" 단위로 관리합니다. 같은 모델을 다른 이름으로 여러 번 배포할 수 있어서, URL에 배포 이름이 들어가야 합니다. 하지만 대부분의 OpenAI 호환 도구(Cline, Continue, Cursor 등)는 Body의 `model` 필드만 사용합니다. APIM이 이 간극을 자동으로 채워줍니다.

**⑤ 불필요 파라미터 제거**

```xml
<set-body>@{
    var body = context.Request.Body.As<JObject>();
    body.Remove("prediction");
    body.Remove("stream_options");
    body.Remove("service_tier");
    body.Remove("store");
    body.Remove("metadata");
    body.Remove("reasoning_effort");
    return body.ToString();
}</set-body>
```

Cline은 OpenAI API 전체 스펙에 맞춰 파라미터를 보내는데, Azure OpenAI는 일부를 지원하지 않습니다. 지원하지 않는 파라미터가 포함되면 `400 Bad Request` 또는 `403`을 반환합니다.

특히 `prediction` 파라미터는 GPT-5.5 모델에서 `unsupported_parameter` 오류를 유발했습니다. 이 정책은 **모든 모델**에 적용되어, 어떤 모델을 사용하든 안전합니다.

**⑥ 백엔드 키 주입**

```xml
<set-header name="api-key" exists-action="override">
    <value>{{aoai-api-key}}</value>
</set-header>
```

학생의 APIM 구독 키를 제거하고, 진짜 Azure OpenAI API 키를 주입합니다. 이 키는 APIM Named Value(`aoai-api-key`)에 `secret=true`로 저장되어 있어서:

- 정책 XML 소스 코드에 키가 노출되지 않습니다
- Git 히스토리에도 남지 않습니다
- Azure Portal에서 중앙 관리하고, 정책 수정 없이 키를 교체할 수 있습니다

### 1.3 DeepSeek 라우팅

DeepSeek V4 Flash는 Azure OpenAI가 아닌 별도 Serverless 엔드포인트입니다. 학생이 Base URL을 `/deepseek/v1`로 바꾸면 APIM이 다른 백엔드로 라우팅합니다.

DeepSeek은 2개 인스턴스를 배포하고 APIM 라운드로빈으로 분산합니다. Serverless 배포는 콜드 스타트(10~30초)가 있어서, 2개를 번갈아 쓰면 하나가 워밍업되는 동안 다른 하나가 응답할 수 있습니다.

### 1.4 SWA 서빙 구조

두 개의 Azure Static Web Apps가 각각 다른 역할을 합니다:

| SWA | 도메인 | 프론트엔드 | 백엔드 API |
|-----|--------|-----------|-----------|
| `swa-eduelden-onboard` | `icy-wave-0ca02f20f.7.azurestaticapps.net` | `docs/index.html` (온보딩 폼) | `api/src/functions/` (slots, onboard, cancel, manage) |
| `swa-eduelden-dashboard` | `calm-beach-02d18ca00.7.azurestaticapps.net` | `dashboard/` (React + Vite) | `api/src/functions/` (dashboard-overview, daily, students, control, alerts, health) |

왜 SWA를 2개로 나눴는가? 하나의 SWA에서 두 프론트엔드를 서빙하려면 URL 라우팅이 복잡해집니다. 온보딩은 정적 HTML 1장이고 대시보드는 React SPA이므로, 빌드 파이프라인과 라우팅 규칙이 완전히 다릅니다. 분리하면 각각 독립적으로 배포하고 관리할 수 있습니다.

두 SWA는 **같은 `api/` 폴더를 백엔드로 공유**합니다. Azure Functions는 SWA에 내장되어 있어서 별도 서버 비용이 없습니다.

---

## 2. 배포 (Deployment) — 코드가 운영 환경에 도달하는 과정

### 2.1 배포 파이프라인 개요

```text
개발자 git push (main 브랜치)
    │
    ├─► azure-static-web-apps-*.yml  → 온보딩 SWA 자동 배포
    ├─► dashboard-deploy.yml         → 대시보드 SWA 자동 배포
    └─► (수동 트리거)
        ├─► student-onboarding.yml   → 학생 온보딩 처리
        ├─► key-management.yml       → APIM 키 관리
        └─► cost-monitor.yml         → 비용 모니터링 (매일 09:00 KST)
```

### 2.2 SWA 자동 배포

GitHub에 push하면 Azure Static Web Apps가 자동으로 빌드하고 배포합니다.

**온보딩 SWA**:

```yaml
app_location: "/docs"          # 프론트엔드 소스 (정적 HTML)
api_location: "/api"           # Azure Functions 소스
output_location: ""            # 빌드 불필요 (정적 파일)
```

**대시보드 SWA**:

```yaml
app_location: "/dashboard"     # React 소스
api_location: "/api"           # Azure Functions 소스 (공유)
output_location: "dist"        # Vite 빌드 결과물
```

대시보드는 React + Vite이므로 빌드 단계가 있습니다. SWA가 `npm install && npm run build`를 자동 실행하고 `dist/` 폴더를 배포합니다.

### 2.3 배포 토큰과 시크릿

SWA 배포에는 배포 토큰이 필요합니다. 이 토큰은 GitHub Secret에 저장됩니다:

| Secret | 용도 |
|--------|------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_*` | 온보딩 SWA 배포 토큰 (SWA 생성 시 자동 등록) |
| `AZURE_SWA_DASHBOARD_TOKEN` | 대시보드 SWA 배포 토큰 (수동 등록 필요) |

왜 대시보드 토큰만 수동인가? 온보딩 SWA는 Azure Portal에서 GitHub 연결 시 자동으로 워크플로우와 시크릿이 생성됩니다. 대시보드 SWA는 별도로 추가한 것이라 수동으로 토큰을 등록해야 합니다.

### 2.4 APIM 배포

APIM Developer SKU는 프로비저닝에 **30~45분**이 걸립니다. 이 시간 동안 API 호출이 불가능합니다.

```bash
az apim create --name apim-eduelden-ai \
  --resource-group rg-powerplatform-billing \
  --publisher-name "EduElden" \
  --publisher-email "admin@eldensoluton.kr" \
  --sku-name Developer
```

왜 Developer SKU인가? Consumption SKU는 요청당 과금이라 50명이 활발히 사용하면 비용이 예측 불가능합니다. Developer SKU는 월 ~$50 고정 비용으로 무제한 요청을 처리합니다. Production에서는 Basic 이상을 사용하지만, 교육 환경에서는 Developer로 충분합니다.

### 2.5 APIM 정책 배포

APIM 정책은 XML 파일로 관리됩니다. Azure REST API로 업로드합니다:

```bash
az rest --method put \
  --url "https://management.azure.com/.../apis/openai-api/policies/policy?api-version=2022-08-01" \
  --body @policy.xml
```

정책에서 백엔드 키를 참조할 때 `{{aoai-api-key}}`(Named Value)를 사용합니다. Named Value는 별도 API로 생성합니다:

```bash
az rest --method put \
  --url ".../namedValues/aoai-api-key?api-version=2022-08-01" \
  --body '{"properties":{"displayName":"aoai-api-key","value":"실제키","secret":true}}'
```

`secret: true`로 설정하면 Azure Portal에서도 값이 마스킹되어 표시됩니다.

### 2.6 진단 로깅 배포

APIM 사용량을 모니터링하려면 진단 설정을 활성화해야 합니다.

```bash
az monitor diagnostic-settings create \
  --name "apim-to-loganalytics" \
  --resource "/subscriptions/.../apim-eduelden-ai" \
  --workspace "/subscriptions/.../eduelden-ai-resource-logs" \
  --export-to-resource-specific true \
  --logs '[{"category":"GatewayLogs","enabled":true}]'
```

**핵심: `--export-to-resource-specific true`**

이 옵션이 없으면 로그가 `AzureDiagnostics` 테이블(레거시)에 쌓입니다. 이 옵션을 켜면 `ApiManagementGatewayLogs` 테이블(전용)에 쌓입니다. 전용 테이블은:

- 컬럼 이름이 명확합니다 (`ResponseCode` vs `responseCode_d`)
- `ApimSubscriptionId` 필드가 있어서 학생별 필터링이 가능합니다
- 쿼리 성능이 더 좋습니다

우리 시스템은 양쪽 모드 전환 과정에서 데이터가 양쪽에 나뉘어 있어서, KQL 쿼리에서 `union isfuzzy=true`로 두 테이블을 합쳐서 조회합니다.

### 2.7 학생 PC 배포 (setup-student.ps1)

학생 PC 환경 설정은 PowerShell 스크립트로 자동화됩니다:

```text
setup-student.ps1 실행
    │
    ├─ [1/4] VS Code 설치 (없으면 다운로드 + 사일런트 설치)
    ├─ [2/4] Cline 확장 설치 (code --install-extension)
    ├─ [3/4] API 설정
    │   ├─ config.json 생성 (~/.ai-class/)
    │   ├─ 환경변수 AI_CLASS_API_KEY 등록
    │   ├─ Cline globalState.json에 프로바이더 설정 주입
    │   ├─ Cline secrets.json에 API 키 저장
    │   └─ Power BI MCP exe 설치 + Cline MCP 설정
    └─ [4/4] API 연결 테스트
```

**Power BI MCP는 왜 exe 직접 실행인가?**

제네릭 래퍼 패키지(`@microsoft/powerbi-modeling-mcp`)를 npx로 실행하면, 래퍼가 플랫폼을 감지하면서 stdout에 일반 텍스트를 먼저 출력합니다:

```text
Detected platform: win32, architecture: x64
Using @microsoft/powerbi-modeling-mcp-win32-x64 version...
```

MCP는 stdio 전송을 사용하는데, stdout에 JSON-RPC가 아닌 텍스트가 섞이면 프로토콜이 오염됩니다. Cline이 이 텍스트를 JSON으로 파싱하려다 실패하고, 서버 연결을 재시작합니다. 재시작 과정에서 이전 서버 ID가 무효화되어 `No connection found for server: crNxvd` 같은 오류가 발생합니다.

해결: 플랫폼별 패키지(`@microsoft/powerbi-modeling-mcp-win32-x64`)를 npm으로 설치하고, exe를 직접 실행합니다. exe는 즉시 JSON-RPC를 시작하므로 stdout 오염이 없습니다.

**npm stderr 문제**

PowerShell에서 `$ErrorActionPreference = "Stop"`을 설정하면, 외부 프로그램(npm)이 stderr에 무엇이든 쓰면 종료 오류로 처리합니다. npm은 성공해도 `npm notice`를 stderr에 출력하므로, 스크립트가 중단됩니다.

해결: `try { & npm install ... 2>&1 | Out-Null } catch {}` — stderr를 stdout에 합치고 버립니다. 실제 설치 성공 여부는 `Test-Path $powerBiMcpExe`로 확인합니다.

**한글 경로 mojibake 문제**

일부 MCP 클라이언트나 터미널은 UTF-8 한글 경로를 Latin-1로 잘못 저장합니다 (예: `C:\Users\허석` → `C:\Users\í—ˆì„`). `Repair-Utf8MojibakePath` 함수가 Latin-1 → UTF-8 역변환을 시도하여 실제 존재하는 경로로 복구합니다.

---

## 3. 관리 (Management) — 운영 중 모니터링과 제어

### 3.1 관리자 대시보드

대시보드는 React + Vite로 구축된 SPA이며, 6개 페이지로 구성됩니다:

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 로그인 | `/` | X-Admin-Token 입력 |
| 전체 개요 | `/overview` | 총 요청 수, 예상 비용, 예산 게이지, 모델별 분석 |
| 학생 목록 | `/students` | 학생별 요청 수, 마지막 활동 시간 |
| 학생 상세 | `/students/:id` | 시간별/일별 사용량 차트 |
| 일괄 제어 | `/control` | 키 활성화/정지, 일괄 작업 |
| 알림 설정 | `/alerts` | 예산 임계값 알림 설정 |

### 3.2 대시보드 인증 — 왜 X-Admin-Token인가

처음에는 표준 `Authorization: Bearer` 헤더를 사용했습니다. 하지만 Azure SWA는 내장 인증(EasyAuth) 기능 때문에 인바운드 `Authorization` 헤더를 가로채서 365자짜리 자체 토큰으로 덮어씁니다. 백엔드 Azure Function이 받는 `Authorization` 헤더는 관리자가 보낸 값이 아니라 SWA가 만든 값입니다.

```text
관리자 → Authorization: Bearer my-secret-token
                    ↓ SWA가 가로챔
백엔드 ← Authorization: Bearer eyJ0eXAiOi...(365자 SWA 토큰)
```

이 동작은 SWA의 설계상 의도이며 비활성화할 수 없습니다. 해결책으로 커스텀 헤더 `X-Admin-Token`을 사용합니다. SWA는 커스텀 헤더를 건드리지 않으므로, 원본 값이 그대로 백엔드에 도달합니다.

### 3.3 데이터 수집 — Log Analytics KQL

대시보드 API는 Log Analytics에 KQL(Kusto Query Language) 쿼리를 보내서 APIM 사용량 데이터를 조회합니다.

**듀얼 테이블 union 전략**

APIM 진단 로그는 시점에 따라 두 테이블에 나뉘어 있습니다:

| 테이블 | 시기 | 특징 |
|--------|------|------|
| `AzureDiagnostics` | 레거시 모드 (Resource-specific 전환 전) | 컬럼명에 `_s`, `_d` 접미사, `ApimSubscriptionId` 없음 |
| `ApiManagementGatewayLogs` | Resource-specific 모드 (전환 후) | 명확한 컬럼명, `ApimSubscriptionId` 있음 |

두 테이블을 union하여 전체 기간의 데이터를 조회합니다:

```kql
let UnifiedLogs = union isfuzzy=true
  (ApiManagementGatewayLogs
   | project TimeGenerated, 
             ResponseCode=toint(ResponseCode),
             RequestSize=tolong(RequestSize), 
             ResponseSize=tolong(ResponseSize),
             BackendUrl=Url, 
             TotalTimeMs=toreal(TotalTime),
             ApimSubscriptionId=tostring(ApimSubscriptionId)),
  (AzureDiagnostics
   | where Category == 'GatewayLogs'
   | project TimeGenerated, 
             ResponseCode=toint(responseCode_d),
             RequestSize=tolong(requestSize_d), 
             ResponseSize=tolong(responseSize_d),
             BackendUrl=backendUrl_s, 
             TotalTimeMs=toreal(DurationMs),
             ApimSubscriptionId="unknown");
```

`AzureDiagnostics` 행은 `ApimSubscriptionId`가 없으므로 `"unknown"`으로 채웁니다. 학생별 분석은 Resource-specific 전환 이후 데이터에서만 정확합니다.

### 3.4 비용 추정

실제 Azure 청구 데이터는 24~48시간 지연이 있습니다. 대시보드는 APIM 로그의 요청/응답 바이트 크기로 토큰 수를 추정하고, 모델별 단가를 적용합니다:

| 모델 | 입력 ($/1K 토큰) | 출력 ($/1K 토큰) |
|------|:---:|:---:|
| gpt-54-mini | $0.0004 | $0.0016 |
| gpt-55 | $0.005 | $0.015 |
| deepseek-v4-flash | $0.00014 | $0.00028 |

토큰 추정: `바이트 수 ÷ 4 ≈ 토큰 수` (영문 기준 대략적 근사치)

이 추정은 정확하지 않지만, 실시간 트렌드를 파악하기에는 충분합니다. 정확한 비용은 Azure Cost Management의 일일 리포트(`cost-monitor.yml`)로 확인합니다.

### 3.5 캐싱

Log Analytics 쿼리는 비용과 시간이 들므로, 결과를 5분간 인메모리 캐시합니다:

```javascript
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분
const _cache = new Map(); // key → { data, expiresAt }
```

5분 TTL은 대시보드 새로고침 주기와 비슷합니다. 강사가 대시보드를 계속 새로고침해도 Log Analytics에 과도한 쿼리가 발생하지 않습니다. 강제 새로고침이 필요하면 `clearCache()` 함수를 호출합니다.

### 3.6 학생 키 관리

APIM 구독 키는 세 가지 상태를 가집니다:

| 상태 | API 호출 | 용도 |
|------|----------|------|
| `active` | ✅ 가능 | 정상 사용 |
| `suspended` | ❌ 차단 | 수업 종료 후 일시 정지 |
| `cancelled` | ❌ 영구 차단 | 문제 학생 키 폐기 |

대시보드의 일괄 제어 페이지에서 상태를 변경할 수 있습니다. GitHub Actions의 `key-management.yml`로도 가능합니다.

키 회전(재발급)은 APIM REST API로 수행합니다. 기존 키는 즉시 무효화되고 새 키가 발급됩니다. 학생에게 새 키를 다시 안내해야 합니다.

### 3.7 예산 모니터링

3단계 알림 체계:

| 단계 | 임계값 | 금액 | 알림 대상 |
|------|--------|------|----------|
| 1단계 | 50% | $400 | admin@eldensoluton.kr |
| 2단계 | 80% | $640 | admin@eldensoluton.kr |
| 3단계 | 95% | $760 | admin@eldensoluton.kr |

추가로 `cost-monitor.yml`이 매일 09:00 KST에 실행되어 Azure Cost Management API에서 실제 비용을 조회하고, GitHub Issue로 리포트를 생성합니다.

---

## 4. 사용자 사용 (User Experience) — 학생이 경험하는 흐름

### 4.1 온보딩 흐름

```text
① 강사가 온보딩 URL + 패스코드 공유
    ↓
② 학생이 웹 페이지에서 학번 + 이메일 + 패스코드 입력
    ↓
③ SWA API가 GitHub Issue 생성 (라벨: onboarding)
    ↓
④ GitHub Actions 자동 실행:
   - 패스코드 검증
   - APIM에서 해당 학생의 구독 키 조회
   - ACS로 환영 이메일 발송
   - Issue를 'done' 라벨로 닫기
    ↓
⑤ 학생이 이메일 수신 (API 키 + 설정 안내 포함)
    ↓
⑥ PowerShell 스크립트 실행 → 자동 설정 완료
    ↓
⑦ VS Code에서 Cline으로 AI 코딩 시작
```

왜 GitHub Issues인가? 별도 데이터베이스 없이 온보딩 상태를 추적할 수 있습니다. Issue 자체가 요청 기록이고, 라벨이 상태 머신 역할을 합니다 (`onboarding` → `processing` → `done` 또는 `error`). GitHub Actions가 Issue 이벤트에 반응하므로 별도 웹훅 서버가 필요 없습니다.

### 4.2 이메일 발송 — 왜 ACS인가

처음에는 Microsoft Graph API로 이메일을 보내려 했습니다. Graph API는 Microsoft 365 사용자 계정(`admin@eldensoluton.kr`)에서 직접 발송하므로 가장 자연스럽습니다.

하지만 Entra ID 테넌트에 Exchange Online 라이선스가 없거나 비활성화되면 Graph API의 `Mail.Send` 권한이 있어도 발송이 실패합니다. 이 환경에서는 Exchange 라이선스가 중단된 상태였습니다.

Azure Communication Services(ACS) Email은:

- Exchange 라이선스가 필요 없습니다
- 첫 1,000통/월이 무료입니다
- HMAC-SHA256 인증으로 키 기반 발송이 가능합니다

ACS 발송 주소는 `DoNotReply@{ACS도메인}`이 됩니다. 학교 도메인으로 보내려면 커스텀 도메인을 등록해야 하지만, 교육 환경에서는 기본 도메인으로 충분합니다.

### 4.3 모델 선택 — 학생의 관점

학생은 3개 모델을 사용할 수 있으며, Cline 설정에서 Base URL과 Model ID를 바꿔서 전환합니다:

| 모델 | Base URL | Model ID | 특성 |
|------|----------|----------|------|
| GPT-5.4-mini (기본) | `/openai/v1` | `gpt-54-mini` | 빠른 응답, 일반 코딩에 적합 |
| GPT-5.5 | `/openai/v1` | `gpt-55` | 높은 품질, 복잡한 작업에 적합, 느림 |
| DeepSeek V4 Flash | `/deepseek/v1` | `deepseek-v4-flash` | 대안 모델, 다른 관점 |

왜 3개인가? GPT-5.4-mini는 빠르고 저렴해서 일상적인 코딩에 적합합니다. GPT-5.5는 복잡한 아키텍처 설계나 버그 분석에 더 나은 결과를 줍니다. DeepSeek은 완전히 다른 모델 아키텍처이므로, GPT 계열이 막히거나 다른 접근이 필요할 때 유용합니다.

학생 입장에서 모델 전환은 Cline 설정에서 값 2개를 바꾸는 것입니다. API 키는 동일합니다.

### 4.4 Power BI MCP — AI가 Power BI를 직접 제어

MCP(Model Context Protocol)를 통해 Cline이 Power BI Desktop에 직접 연결합니다:

```text
Cline (AI 에이전트)
    │ MCP stdio (JSON-RPC)
    ▼
powerbi-modeling-mcp.exe
    │ localhost:{포트}
    ▼
Power BI Desktop (열려 있는 .pbix 파일)
```

AI가 할 수 있는 일:

- 테이블 스키마 조회
- DAX 수식 실행
- 측정값(Measure) 생성/수정
- 관계(Relationship) 설정
- 계산 열(Calculated Column) 추가

왜 exe 직접 실행인가? (앞서 설명한 stdout 오염 문제) npx 래퍼가 플랫폼 감지 메시지를 stdout에 출력하면 MCP JSON-RPC 전송이 깨집니다. exe를 직접 실행하면 즉시 깨끗한 JSON-RPC 세션이 시작됩니다.

### 4.5 Cline 설정 자동화의 한계

`setup-student.ps1`은 대부분의 설정을 자동화하지만, **Cline API 프로바이더/키/모델은 자동화할 수 없습니다**. 이유:

Cline은 API 설정을 VS Code의 내부 SQLite DB(`state.vscdb`)와 SecretStorage에 저장합니다. 이 저장소는 VS Code Extension API를 통해서만 접근 가능하고, 외부에서 파일을 직접 쓸 수 없습니다.

반면 MCP 서버 설정은 `cline_mcp_settings.json` 파일에 저장되므로 스크립트로 주입할 수 있습니다.

스크립트는 바탕화면에 `CLINE_API_SETUP.txt` 파일을 생성하여, 학생이 Cline UI에서 수동 입력할 값을 안내합니다.

---

## 5. 보안 계층 정리

전체 시스템의 보안은 8개 계층으로 구성됩니다:

| 계층 | 구간 | 방식 | 설명 |
|:---:|------|------|------|
| 1 | 학생 → 온보딩 SWA | 수업 패스코드 | 수업 참여자만 신청 가능 |
| 2 | SWA API → GitHub | PAT 토큰 | repo scope로 Issue CRUD |
| 3 | GitHub Actions → Azure | 서비스 주체 (RBAC) | Contributor 역할, 리소스 그룹 범위 |
| 4 | GitHub Actions → ACS | 연결 문자열 (HMAC-SHA256) | 이메일 발송 인증 |
| 5 | 학생 → APIM | APIM 구독 키 | 학생별 개별 키, Rate Limit 적용 |
| 6 | APIM → Azure OpenAI | Named Value `{{aoai-api-key}}` | 정책에서 안전 참조, 소스 코드 미노출 |
| 7 | 관리자 → 대시보드 | X-Admin-Token 커스텀 헤더 | SWA Authorization 헤더 충돌 회피 |
| 8 | APIM 인바운드 정책 | 파라미터 자동 제거 | 백엔드 오류 방지 (보안 부수 효과) |

핵심 원칙: **학생은 절대로 진짜 Azure OpenAI 키를 볼 수 없습니다.** APIM이 학생의 키를 검증한 뒤, 백엔드에는 Named Value에서 가져온 진짜 키를 주입합니다.

---

## 6. 시행착오에서 배운 것

이 시스템을 구축하면서 발견한 문제들과 해결 과정입니다. 같은 구조를 만들 때 참고하세요.

| # | 문제 | 발견 경위 | 해결 |
|---|------|----------|------|
| 1 | SWA가 `/api/admin*` 경로를 예약함 | `POST /api/admin` 호출 시 404 반환 | 라우트를 `/api/manage`로 변경 |
| 2 | SWA가 Authorization 헤더를 덮어씀 | 대시보드 로그인이 항상 실패 | `X-Admin-Token` 커스텀 헤더 사용 |
| 3 | Graph API 이메일 발송 실패 | Exchange Online 라이선스 비활성화 | ACS Email로 전환 |
| 4 | APIM 진단 로그가 안 보임 | 대시보드에 3일간 데이터 0건 | Resource-specific 모드로 전환 + KQL union |
| 5 | Cline에서 gpt-55 요청 시 400/403 | `prediction` 파라미터를 Azure OpenAI가 거부 | APIM 정책에서 6개 파라미터 자동 제거 |
| 6 | Power BI MCP 연결 끊김 | `No connection found for server` 반복 | npx → exe 직접 실행 |
| 7 | npm stderr로 스크립트 중단 | `npm notice` 출력 → ErrorActionPreference=Stop | `try/catch` + `2>&1 \| Out-Null` |
| 8 | APIM 정책 XML에 API 키 하드코딩 | Git 히스토리에 키 노출 위험 | Named Value `{{aoai-api-key}}` 사용 |
| 9 | APIM 삭제 후 같은 이름 재생성 불가 | 48시간 soft-delete 보존 기간 | `az apim deletedservice purge` 명령 |
| 10 | 한글 사용자명 경로 깨짐 | 바탕화면 경로를 못 찾음 | `Repair-Utf8MojibakePath` 함수 |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../README.md) | 프로젝트 소개 + 빠른 시작 |
| [PRD.md](PRD.md) / [PRD.ko.md](PRD.ko.md) | 제품 요구사항 전체 스펙 |
| [INSTALL.md](INSTALL.md) / [INSTALL.ko.md](INSTALL.ko.md) | 단계별 설치 매뉴얼 |
| [USER-GUIDE.md](USER-GUIDE.md) / [USER-GUIDE.ko.md](USER-GUIDE.ko.md) | 강사/학생 운영 가이드 |
| [budget-plan.md](budget-plan.md) | 예산 계획 상세 |
| [resource-cleanup.md](resource-cleanup.md) | 수업 후 리소스 정리 절차 |

# PRD: Azure AI Foundry 바이브코딩 실습 플랫폼

> **목적**: 이 문서는 LLM 에이전트 또는 엔지니어가 전체 시스템을 처음부터 재현할 수 있도록 하기 위한 문서예요. 시행착오 없이 구축할 수 있게 모든 세부사항을 담고 있어요.

---

## 1. 제품 개요

Azure AI Foundry 바이브코딩 수업을 위한 **셀프서비스 학생 온보딩 플랫폼**이에요. 학생(최대 50명)이 웹 페이지를 방문해서 학번과 이메일을 입력하면, 자동으로 다음을 받게 돼요:
- APIM 구독 키 (3개 AI 모델에 통합 접근)
- 설정 안내와 PowerShell 자동 설정 스크립트가 포함된 환영 이메일
- 사전 구성된 VS Code + Cline 확장으로 바로 AI 코딩 시작

### 핵심 설계 결정

| 결정 사항 | 선택 | 이유 |
|---|---|---|
| API 게이트웨이 | Azure APIM (Developer SKU) | 학생당 하나의 키, 속도 제한, 백엔드 키 숨기기 |
| 이메일 발송 | Azure Communication Services (ACS) Email | Graph API는 Exchange 라이선스 필요; ACS는 바로 사용 가능 |
| 온보딩 백엔드 | GitHub Issues + Actions | 무료, 추적 가능, 이벤트 기반 파이프라인 |
| 프론트엔드 호스팅 | Azure Static Web Apps (SWA) — 2개 인스턴스 | `swa-{name}-onboard` (학생 온보딩) + `swa-eduelden-dashboard` (관리자 모니터링) |
| 관리자 대시보드 | React + Vite SWA (`swa-eduelden-dashboard`) | 실시간 사용량 모니터링, 학생별 쿼터 제어, 예산 알림 |
| 학생 IDE | VS Code + Cline 확장 | OpenAI 호환 프로바이더가 APIM 프록시를 지원 |
| 스크립트 언어 | PowerShell (.ps1) | Windows 학생 PC에 기본 설치 |
| Power BI MCP | Windows 네이티브 exe (`@microsoft/powerbi-modeling-mcp-win32-x64`) | npx 래퍼가 stdout에 텍스트를 출력해 MCP JSON-RPC 트랜스포트를 깨뜨림 |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        학생 흐름                                     │
│                                                                      │
│  학생 브라우저 ──► SWA 온보딩 (docs/index.html)                       │
│       │                    │                                         │
│       │              SWA API (Azure Functions)                       │
│       │              ├─ GET  /api/slots     → 사용 가능 슬롯 표시     │
│       │              ├─ POST /api/onboard   → GitHub Issue 생성      │
│       │              ├─ POST /api/cancel     → 온보딩 취소            │
│       │              └─ POST /api/manage     → 관리자 대시보드        │
│       │                    │                                         │
│       │              GitHub Issue (label: onboarding)                │
│       │                    │                                         │
│       │              GitHub Actions 워크플로우                        │
│       │              ├─ 패스코드 검증                                 │
│       │              ├─ Azure 로그인 → APIM 구독 키 조회              │
│       │              ├─ ACS로 환영 이메일 발송 (HMAC-SHA256)          │
│       │              └─ 'done' 라벨로 Issue 닫기                     │
│       │                                                              │
│       ▼                                                              │
│  학생 이메일 ──► setup-student.ps1 다운로드                           │
│       │              ├─ VS Code 설치 (없을 경우)                     │
│       │              ├─ Cline 확장 설치                               │
│       │              ├─ Power BI MCP 설치 (Windows 네이티브 exe)      │
│       │              ├─ Cline MCP 설정 자동 구성 (VS Code             │
│       │              │   globalStorage, powerbi 서버 등록)            │
│       │              ├─ Cline 설정 작성 (globalState + secrets)       │
│       │              └─ API 연결 테스트                               │
│       │                                                              │
│       ▼                                                              │
│  VS Code + Cline ──► APIM 게이트웨이 ──► Azure OpenAI / DeepSeek    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     관리자 대시보드 흐름                              │
│                                                                      │
│  관리자 브라우저 ──► SWA 대시보드 (swa-eduelden-dashboard)            │
│       │                    │                                         │
│       │              대시보드 API (Azure Functions)                   │
│       │              ├─ GET /api/dashboard-overview  → 통계 카드     │
│       │              ├─ GET /api/dashboard-daily     → 일별 차트     │
│       │              ├─ GET /api/dashboard-students  → 학생 목록     │
│       │              ├─ POST /api/dashboard-control  → 일괄 제어     │
│       │              ├─ GET/POST /api/dashboard-alerts → 알림 설정   │
│       │              └─ GET /api/dashboard-health    → 헬스 체크     │
│       │                    │                                         │
│       │              Log Analytics (KQL)                             │
│       │              └─ ApiManagementGatewayLogs (+ AzureDiagnostics │
│       │                   union으로 레거시 데이터 포함)               │
│       │                    │                                         │
│       │              APIM Management API                             │
│       │              └─ 구독 상태 / 키 관리                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 맵

```
eduelden-ai-deploy/
├── config.env.template             # 배포 설정 템플릿
├── config.env                      # 사용자 설정 (git에서 제외)
├── docs/                           # SWA 프론트엔드
│   ├── index.html                  # 온보딩 UI (학생 + 관리자)
│   └── staticwebapp.config.json    # SWA 라우팅 설정
├── dashboard/                      # 관리자 대시보드 (React + Vite SWA)
│   ├── src/
│   │   ├── pages/                  # 6개 페이지: Login, Overview, Students,
│   │   │                           #   StudentDetail, BulkControl, Alerts
│   │   ├── components/             # 재사용 가능한 UI 컴포넌트
│   │   ├── api/                    # API 클라이언트 함수 (fetch 래퍼)
│   │   └── context/                # React 컨텍스트 (인증, 테마)
│   ├── index.html
│   └── vite.config.js
├── api/                            # SWA 백엔드 (Azure Functions v4, Node.js)
│   └── src/
│       ├── functions/
│       │   ├── slots.js                # GET /api/slots - 온보딩 현황 표시
│       │   ├── onboard.js              # POST /api/onboard - GitHub Issue 생성
│       │   ├── cancel.js               # POST /api/cancel - 온보딩 취소
│       │   ├── admin.js                # POST /api/manage - 관리자 대시보드
│       │   ├── dashboard-overview.js   # GET /api/dashboard-overview
│       │   ├── dashboard-daily.js      # GET /api/dashboard-daily
│       │   ├── dashboard-students.js   # GET /api/dashboard-students
│       │   ├── dashboard-control.js    # POST /api/dashboard-control
│       │   ├── dashboard-alerts.js     # GET/POST /api/dashboard-alerts
│       │   └── dashboard-health.js     # GET /api/dashboard-health
│       └── lib/
│           ├── log-analytics.js        # KQL 쿼리 + 5분 캐시
│           └── azure-client.js         # APIM Management API 클라이언트
├── .github/
│   ├── workflows/
│   │   ├── student-onboarding.yml      # 핵심: Issue → 키 → 이메일 파이프라인
│   │   ├── key-management.yml          # APIM 키 회전
│   │   ├── cost-monitor.yml            # 일일 비용 리포트
│   │   └── dashboard-deploy.yml        # 대시보드 SWA 배포
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml  # Issue 템플릿
├── scripts/
│   ├── deploy-all.sh               # 전체 자동 배포 (Phase 1-7)
│   ├── 01_deploy_foundry.sh        # AI 모델 배포
│   ├── 02_manage_keys.sh           # APIM 키 관리
│   ├── cost-monitor.sh             # 비용 모니터링
│   └── setup-student.ps1           # 학생 PC 자동 설정 (영문)
├── events/                         # 이벤트/워크숍별 설정
│   └── powerbi-mcp-20260530/       # Power BI MCP 워크숍 (2026-05-30)
│       ├── setup-powerbi-mcp.ps1   # 워크숍 전용 설치 (PBI Desktop, MCP exe, 실습파일)
│       ├── config.json             # 행사 설정
│       ├── email-template.html     # 사전 안내 이메일 템플릿
│       └── files/실습파일.pbix      # 실습용 Power BI 파일
└── ai-class-starter/               # 학생용 스타터 프로젝트
```

---

## 3. 필요한 Azure 리소스

### 3.1 리소스 목록

| 리소스 | 타입 | SKU/티어 | 리전 | 비용 |
|---|---|---|---|---|
| 리소스 그룹 | `rg-{name}` | -- | 아무 곳 | 무료 |
| AI Foundry 리소스 | `{name}-ai-resource` | S0 | 대상 모델을 지원하는 리전 | 종량제 |
| AI Foundry 프로젝트 | `{name}-ai` | -- | 리소스와 동일 | 무료 |
| APIM | `apim-{name}-ai` | Developer | 리소스와 동일 리전 | ~$50/월 |
| SWA (온보딩) | `swa-{name}-onboard` | Free | 아무 곳 | 무료 |
| SWA (대시보드) | `swa-eduelden-dashboard` | Free | 아무 곳 | 무료 |
| ACS | `acs-{name}-email` | Free | 아무 곳 | 무료 (첫 1,000통) |
| ACS Email 서비스 | `acs-{name}-email-svc` | -- | ACS와 동일 | 무료 |

### 3.2 모델 배포 (AI Foundry 내)

| 배포 이름 | 모델 | TPM | 용도 |
|---|---|---|---|
| `gpt-54-mini` | GPT-5.4-mini (또는 동급) | 100K | 기본: 빠르고 범용적 |
| `gpt-55` | GPT-5.5 (또는 동급) | 50K | 고품질, 복잡한 작업 |
| `deepseek-v4-flash-1` | DeepSeek-V4-Flash | Serverless | 대안 모델 (인스턴스 1) |
| `deepseek-v4-flash-2` | DeepSeek-V4-Flash | Serverless | 대안 모델 (인스턴스 2) |

> **참고**: 모델 이름은 Azure 배포 이름이며, 실제 모델 식별자가 아니에요. 배포 전에 `az cognitiveservices account list-models` 명령으로 AI Foundry 카탈로그에서 사용 가능한 모델을 확인하세요.

> **학생용 모델 ID**: 학생은 Cline에서 모델 ID로 `deepseek-v4-flash`를 사용해요. APIM 정책이 내부적으로 라운드로빈을 통해 `deepseek-v4-flash-1` 또는 `deepseek-v4-flash-2`로 라우팅해요. 학생은 두 개의 인스턴스에 대해 알 필요가 없어요.

### 3.3 Entra ID

| 항목 | 값 |
|---|---|
| 학생 계정 | `01@{domain}` ~ `50@{domain}` (사전 생성) |
| 보안 그룹 | `AI-Class-Students-{name}` |
| RBAC 역할 | AI 리소스에 `Cognitive Services User` |
| 서비스 주체 | `github-actions-{name}` (GitHub Actions용) |

---

## 4. APIM 구성 (중요)

### 4.1 API

| API 이름 | 경로 | 백엔드 |
|---|---|---|
| `openai-api` | `/openai` | `https://{ai-resource}.openai.azure.com/openai` |
| `deepseek-api` | `/deepseek` | 동일 (정책에서 `set-backend-service`로 분기) |

> **Base URL 참고**: Cline의 "OpenAI Compatible" 프로바이더는 설정된 Base URL에 자동으로 `/v1`을 추가해요. 학생은 Cline에서 `https://apim-{name}-ai.azure-api.net/openai/v1`을 Base URL로 입력해요. APIM API 경로는 `/openai`이지만, 학생이 실제로 사용하는 전체 URL에는 Cline이 추가하는 `/v1` 접미사가 포함돼요.

### 4.2 구독

- 50개 구독: `sub-student-01` ~ `sub-student-50`
- 각 구독은 두 API 모두에 대한 접근 권한
- 구독 요구 사항: 두 API 모두 **비활성화** (인증은 정책에서 처리)

### 4.3 인바운드 정책 (중요 -- Cline 호환성)

APIM 정책은 **네 가지 문제**와 미지원 파라미터 제거를 처리해야 해요:

#### 문제 1: 다중 헤더 인증
Cline은 `Authorization: Bearer <key>`를 보내고, curl은 `api-key`나 `Ocp-Apim-Subscription-Key`를 보낼 수 있어요. 정책은 세 가지 모두를 받아야 해요:

```xml
<set-variable name="auth-key" value="@{
  var auth = context.Request.Headers.GetValueOrDefault("Authorization","");
  if(auth.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)) {
    return auth.Substring(7).Trim();
  }
  var ak = context.Request.Headers.GetValueOrDefault("api-key","");
  if(!string.IsNullOrEmpty(ak)) { return ak; }
  return context.Request.Headers.GetValueOrDefault("Ocp-Apim-Subscription-Key","");
}" />
```

#### 문제 2: URL 형식 변환
Cline (OpenAI SDK)은 프로바이더 설정에 따라 다음 두 가지 URL 패턴 중 하나를 보낼 수 있어요:
- `POST /openai/v1/chat/completions` (`/v1` 포함 — Cline이 자동으로 추가)
- `POST /openai/chat/completions` (`/v1` 없이)

Azure OpenAI가 기대하는 형식: `POST /openai/deployments/{model}/chat/completions?api-version=2024-10-21`

정책은 두 패턴 모두를 처리해야 해요. 조건문은 `/chat/completions`을 포함하면서 `/deployments/`를 포함하지 않는지 확인하는데, 이 방식은 `/v1`이 있든 없든 모두 동작해요:

```xml
<choose>
  <when condition="@(context.Request.Url.Path.Contains("/chat/completions")
                     && !context.Request.Url.Path.Contains("/deployments/"))">
    <set-variable name="reqBody" value="@(context.Request.Body.As<JObject>(preserveContent: true))" />
    <set-variable name="modelName" value="@{
      var body = (JObject)context.Variables["reqBody"];
      return body["model"]?.ToString() ?? "gpt-54-mini";
    }" />
    <rewrite-uri template="@("/deployments/" + (string)context.Variables["modelName"]
                              + "/chat/completions")" copy-unmatched-params="true" />
    <set-query-parameter name="api-version" exists-action="override">
      <value>2024-10-21</value>
    </set-query-parameter>
  </when>
</choose>
```

#### 문제 3: 백엔드 키 주입
학생의 인증 헤더를 제거하고 진짜 Azure OpenAI 키를 주입해요. 키는 정책 XML에 평문으로 삽입하지 않고 Named Value(`{{aoai-api-key}}`)로 저장해요:

```xml
<set-header name="api-key" exists-action="override">
  <value>{{aoai-api-key}}</value>
</set-header>
<set-header name="Authorization" exists-action="delete" />
<set-header name="Ocp-Apim-Subscription-Key" exists-action="delete" />
```

> **보안 참고**: `{{aoai-api-key}}`(APIM Named Value)를 사용하면 키가 Azure에서 중앙 관리되고, 정책 소스 코드나 Git 히스토리에 절대 노출되지 않아요. Azure Portal에서 Named Value만 교체하면 정책 XML을 수정할 필요가 없어요.

#### 문제 5: 미지원 파라미터 제거
Cline 및 기타 OpenAI 호환 클라이언트가 보내는 파라미터 중 Azure OpenAI가 지원하지 않는 것들을 정책에서 제거해요:

제거 대상 파라미터: `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`

```xml
<!-- 요청 본문에서 미지원 필드 제거 -->
<set-body>@{
  var body = context.Request.Body.As<JObject>(preserveContent: false);
  string[] unsupported = { "prediction", "stream_options", "service_tier",
                            "store", "metadata", "reasoning_effort" };
  foreach (var key in unsupported) { body.Remove(key); }
  return body.ToString();
}</set-body>
```

#### 문제 4: DeepSeek 로드 밸런싱
두 개의 DeepSeek 인스턴스(`deepseek-v4-flash-1`과 `deepseek-v4-flash-2`)는 APIM 인바운드 정책에서 라운드로빈으로 부하 분산돼요:

```xml
<!-- DeepSeek API inbound policy addition -->
<set-variable name="ds-instance" value="@{
  return new Random(context.RequestId.GetHashCode()).Next(2) == 0 
    ? "deepseek-v4-flash-1" : "deepseek-v4-flash-2";
}" />
```

### 4.4 속도 제한

```xml
<rate-limit-by-key calls="10" renewal-period="60"
                   counter-key="@((string)context.Variables["auth-key"])" />
<quota-by-key calls="200" renewal-period="86400"
              counter-key="@((string)context.Variables["auth-key"])" />
```

---

## 5. GitHub Actions 워크플로우 -- 학생 온보딩 파이프라인

### 5.1 트리거
- `issues.opened` 이벤트 + `onboarding` 라벨

### 5.2 단계

1. **파싱 및 검증** (`actions/github-script@v7`)
   - Issue 본문에서 `PASSCODE`, `STUDENT_ID`, `EMAIL` 추출
   - 패스코드가 `CLASS_PASSCODE` 시크릿과 일치하는지 확인
   - 학번(01-50) 및 이메일 형식 검증
   - 실패 시: Issue에 코멘트 후 `rejected` 라벨로 닫기

2. **Azure 로그인** (`azure/login@v2`)
   - `AZURE_CREDENTIALS` 시크릿 (서비스 주체 JSON) 사용

3. **APIM 키 조회** (bash `az rest`)
   - `POST .../subscriptions/sub-student-{id}/listSecrets`
   - `::add-mask::`로 키 마스킹

4. **환영 이메일 발송** (`actions/github-script@v7` + Node.js crypto)
   - HMAC-SHA256 인증으로 ACS Email REST API 호출
   - HTML 이메일 내용: 자격 증명, 자동 설정 안내, 수동 설정 가이드, 3개 모델 구성

5. **Issue 닫기** - `done` 라벨과 요약 코멘트 추가

### 5.3 필요한 GitHub Secrets

| Secret | 값 | 출처 |
|---|---|---|
| `AZURE_CREDENTIALS` | 서비스 주체 JSON | `az ad sp create-for-rbac` |
| `ACS_CONNECTION_STRING` | ACS 연결 문자열 | Azure Portal > ACS > Keys |
| `ACS_SENDER_ADDRESS` | `donotreply@{guid}.azurecomm.net` | ACS Email > MailFrom 주소 |
| `CLASS_PASSCODE` | 학생 패스코드 | 커스텀 (예: `!!ed7788`) |

### 5.4 SWA 환경 변수

| 변수 | 값 |
|---|---|
| `GITHUB_PAT` | Personal Access Token (repo + issues 범위) |
| `GITHUB_REPO` | `{owner}/{repo}` |
| `CLASS_PASSCODE` | GitHub Secret과 동일 |
| `ADMIN_PASSWORD` | 관리자 대시보드 비밀번호 |

---

## 6. ACS Email -- HMAC-SHA256 인증

ACS REST API는 HMAC-SHA256 서명된 요청이 필요해요. `openssl`은 null 바이트가 있는 바이너리 키를 제대로 처리하지 못하기 때문에 **반드시 Node.js**를 사용해야 해요 (bash가 아닌).

```javascript
const crypto = require('crypto');
const endpoint = connStr.match(/endpoint=([^;]+)/)[1].replace(/\/$/, '');
const accessKey = connStr.match(/accesskey=(.*)/)[1];
const host = endpoint.replace('https://', '');

const url = new URL(`${endpoint}/emails:send?api-version=2023-03-31`);
const dateStr = new Date().toUTCString();
const contentHash = crypto.createHash('sha256').update(body).digest('base64');
const pathAndQuery = url.pathname + url.search;
const stringToSign = `POST\n${pathAndQuery}\n${dateStr};${host};${contentHash}`;
const signature = crypto.createHmac('sha256', Buffer.from(accessKey, 'base64'))
  .update(stringToSign).digest('base64');

// 헤더:
// x-ms-date: dateStr
// x-ms-content-sha256: contentHash
// Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}
// repeatability-request-id: crypto.randomUUID()
// repeatability-first-sent: dateStr
```

---

## 7. SWA 라우팅 -- 중요한 주의사항

Azure Static Web Apps는 **`/api/admin*` 경로를 내부적으로 예약**하고 있어요. `admin`으로 시작하는 API 엔드포인트는 모두 404를 반환해요.

**해결 방법**: 대체 라우트 이름을 사용하세요 (예: `/api/adminlist` 대신 `/api/manage`).

`staticwebapp.config.json`:
```json
{
  "navigationFallback": { "rewrite": "/index.html" },
  "routes": [
    { "route": "/api/*", "allowedRoles": ["anonymous"] }
  ]
}
```

---

## 8. 학생 설정 스크립트 (setup-student.ps1)

### 8.1 수행 작업

1. **VS Code**: 설치 여부 확인 → 없으면 다운로드 및 자동 설치
2. **Cline 확장**: `code --install-extension saoudrizwan.claude-dev --force`
3. **Power BI MCP**: `@microsoft/powerbi-modeling-mcp-win32-x64` Windows 네이티브 exe 설치
   - `npx`가 아닌 네이티브 exe를 사용하는 이유: `npx`가 stdout에 시작 텍스트를 출력해서 MCP JSON-RPC 트랜스포트를 깨뜨림
4. **Cline MCP 설정**: VS Code의 globalStorage(`cline_mcp_settings.json`)에 Power BI MCP 서버를 등록해서 Cline이 자동으로 인식하게 함
5. **API 설정**: `~/.ai-class/config.json`에 3개 모델 설정 작성
6. **Cline 자동 설정**: `~/.cline/data/globalState.json`과 `secrets.json`에 작성
7. **연결 테스트**: APIM을 통해 테스트 요청 전송

### 8.2 Cline 설정 위치 (중요)

Cline은 API 설정을 VS Code `settings.json`에서 읽지 **않아요**.

| 파일 | 내용 |
|---|---|
| `~/.cline/data/globalState.json` | `actModeApiProvider`, `openAiCompatibleBaseUrl`, `openAiCompatibleModelId` |
| `~/.cline/data/secrets.json` | `openAiCompatibleApiKey` |

### 8.3 스크립트는 반드시 영문으로

PowerShell 스크립트를 GitHub에서 `Invoke-WebRequest`로 다운로드하면 비ASCII 문자의 인코딩이 깨져요. 한국어 Windows의 `cp949` / UTF-8 인코딩 충돌을 피하려면 **모든 출력 문자열은 영문으로만** 작성해야 해요.

---

## 9. 관리자 대시보드 (swa-eduelden-dashboard)

### 9.1 개요

온보딩 SWA와 별도로 배포되는 독립형 React + Vite SWA예요. 토큰 사용량 실시간 모니터링, 학생별 쿼터 관리, 예산 알림 기능을 제공해요.

### 9.2 페이지

| 페이지 | 라우트 | 설명 |
|---|---|---|
| Login | `/login` | 관리자 토큰 입력 (sessionStorage에 저장) |
| Overview | `/` | 통계 카드, 예산 게이지, 일별 사용량 차트, Top 5 학생 |
| Student List | `/students` | 50명 학생 테이블 (검색 및 정렬) |
| Student Detail | `/students/:id` | 토큰 히스토리 차트, 모델 비율 파이, 쿼터 편집, 정지 토글 |
| Bulk Control | `/control` | 전체 쿼터 리셋 / 전체 정지 / 전체 활성화 |
| Alert Settings | `/alerts` | 3단계 예산 임계값, 학생별 임계값, 관리자 이메일 |

### 9.3 인증

대시보드는 모든 API 호출에 커스텀 `X-Admin-Token` HTTP 헤더를 사용해요. 표준 `Authorization: Bearer` 헤더는 사용하지 **않아요**. Azure SWA의 내장 인증이 `Authorization` 헤더를 가로채서 재작성하기 때문에 백엔드 함수에서 사용할 수 없기 때문이에요.

흐름:
1. 관리자가 `/login` 페이지에서 토큰을 입력
2. 토큰이 `sessionStorage`에 저장됨
3. 모든 대시보드 API 호출에 `X-Admin-Token: <token>` 헤더를 포함
4. 대시보드 API 함수가 `req.headers['x-admin-token']`을 읽어서 `DASHBOARD_ADMIN_TOKEN` 환경 변수와 비교

### 9.4 데이터 소스

| 계층 | 세부사항 |
|---|---|
| 원시 로그 | APIM `GatewayLogs` 진단 설정 → Log Analytics 워크스페이스 |
| 진단 모드 | `logAnalyticsDestinationType: Dedicated` (Resource-specific 모드) |
| 기본 테이블 | `ApiManagementGatewayLogs` (신규, Resource-specific) |
| 레거시 테이블 | `AzureDiagnostics` (클래식 모드, 과거 데이터 보존용) |
| KQL 전략 | `union ApiManagementGatewayLogs, AzureDiagnostics`로 두 테이블 모두 커버 |
| 캐시 | `api/src/lib/log-analytics.js`에서 KQL 결과를 5분간 캐시 |

### 9.5 대시보드 API 환경 변수

| 변수 | 값 |
|---|---|
| `DASHBOARD_ADMIN_TOKEN` | 대시보드 인증용 시크릿 토큰 |
| `LOG_ANALYTICS_WORKSPACE_ID` | Log Analytics 워크스페이스 GUID |
| `AZURE_CLIENT_ID` | 서비스 주체 클라이언트 ID (Log Analytics 쿼리용) |
| `AZURE_CLIENT_SECRET` | 서비스 주체 시크릿 |
| `AZURE_TENANT_ID` | Entra ID 테넌트 ID |
| `APIM_SERVICE_NAME` | `apim-eduelden-ai` |
| `APIM_RESOURCE_GROUP` | `rg-powerplatform-billing` |
| `AZURE_SUBSCRIPTION_ID` | Azure 구독 ID |

### 9.6 배포

별도의 GitHub Actions 워크플로우: `.github/workflows/dashboard-deploy.yml`
- 트리거: `main` 브랜치에 push (경로: `dashboard/**` 또는 `api/**`), 또는 수동 디스패치
- 빌드: `dashboard/`에서 `npm run build` → `dashboard/dist/`로 출력
- 배포: `Azure/static-web-apps-deploy@v1` (`app_location: dashboard`, `api_location: api`)

---

## 10. APIM 진단 로깅

APIM에서 Resource-specific 진단 로깅 모드를 사용해요. 이렇게 하면 `ApiManagementGatewayLogs` 전용 테이블로 로그가 저장돼요.

기존 `AzureDiagnostics` 테이블에도 과거 데이터가 있을 수 있으므로, KQL 쿼리에서 `union`으로 두 테이블을 모두 조회해요.

---

## 11. 온보딩 프론트엔드 (SWA)

싱글 페이지 HTML 앱 (`docs/index.html`)으로 구성돼요:
- **학생 패널**: 학번(01-50), 이메일, 패스코드 입력 → 제출
- **슬롯 그리드**: 50개 슬롯의 사용 가능/대기 중/완료 상태 표시 (실시간, `/api/slots` 통해)
- **관리자 패널**: 비밀번호 보호, 모든 온보딩 항목과 통계 표시
- **취소**: 학생이 본인의 온보딩을 직접 취소 가능

### API 엔드포인트

| 메서드 | 경로 | 인증 | 용도 |
|---|---|---|---|
| GET | `/api/slots` | 없음 | 슬롯 가용성 그리드 |
| POST | `/api/onboard` | 패스코드 | 온보딩 요청 제출 |
| POST | `/api/cancel` | 패스코드 또는 관리자 | 온보딩 취소 |
| GET/POST | `/api/manage` | 관리자 비밀번호 | 관리자 대시보드 데이터 |

### 레이스 컨디션 처리

`onboard.js`는 생성 후 중복 검사를 포함해요:
- Issue 생성 후, 동일 학번의 모든 열린 Issue를 다시 조회
- 중복이 발견되면 가장 낮은 Issue 번호(먼저 생성된 것)만 유지
- 나중에 생성된 중복 Issue는 `rejected` 라벨로 닫기

---

## 12. 배운 교훈 / 주의사항

| # | 주의사항 | 해결 방법 |
|---|---|---|
| 1 | SWA가 `/api/admin*`을 예약함 | `/api/manage` 라우트 이름 사용 |
| 2 | Graph API에 Exchange 라이선스 필요 | ACS Email로 대체 |
| 3 | bash에서 ACS HMAC 처리 시 null 바이트 문제 | Node.js `crypto` 모듈 사용 |
| 4 | `raw.githubusercontent.com`은 `text/plain`으로 서빙 | PowerShell `Invoke-WebRequest`를 기본 다운로드 방법으로 제공 |
| 5 | `.ps1`에 한국어 넣으면 다운로드 시 깨짐 | 스크립트 출력은 모두 영문으로만 |
| 6 | Cline은 `Authorization: Bearer`를 보내는데, APIM은 `Ocp-Apim-Subscription-Key`를 기대 | 정책에서 모든 인증 헤더로부터 추출 |
| 7 | Cline은 `/chat/completions`을 보내는데, Azure는 `/deployments/{model}/chat/completions`을 기대 | 정책에서 URL 재작성 + `api-version` 주입 |
| 8 | Cline 설정은 VS Code `settings.json`에 없음 | `~/.cline/data/globalState.json` + `secrets.json`에 작성 |
| 9 | APIM 구독 검증이 정책보다 먼저 실행됨 | `subscriptionRequired` 비활성화, 정책에서 검증 |
| 10 | `AZURE_CREDENTIALS`는 유효한 JSON이어야 함 | `az ad sp create-for-rbac --sdk-auth` 형식 사용 |
| 11 | GitHub Actions Azure 로그인 방식이 워크플로우마다 다름 | `student-onboarding`은 `azure/login@v2` 사용, 나머지는 수동 `az login` 사용. 유지보수를 위해 통일 고려 |
| 12 | `az ad sp create-for-rbac --sdk-auth`가 deprecated됨 | `--sdk-auth` 플래그는 경고를 표시하지만 `azure/login@v2`에 필요한 올바른 JSON 형식을 생성함. 경고를 무시하거나, OpenID Connect 페더레이션 자격 증명으로 전환 |
| 13 | SWA가 `Authorization` 헤더를 가로챔 | 대시보드에서 `X-Admin-Token` 커스텀 헤더를 대신 사용 |
| 14 | Power BI MCP의 npx 래퍼가 stdout 노이즈를 출력함 | Windows 네이티브 exe(`@microsoft/powerbi-modeling-mcp-win32-x64`)를 사용해 MCP JSON-RPC 트랜스포트 오염을 방지 |
| 15 | APIM 진단 로그가 기본적으로 AzureDiagnostics에 저장됨 | `logAnalyticsDestinationType: Dedicated`를 설정해 `ApiManagementGatewayLogs` 테이블 사용; KQL에서 두 테이블을 union으로 조회해 과거 데이터도 커버 |
| 16 | Azure OpenAI가 알 수 없는 요청 파라미터를 거부함 | APIM 정책에서 `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`를 요청 본문에서 제거 |
| 17 | APIM 정책 XML에 Azure OpenAI 키를 평문으로 넣으면 보안 위험 | Named Value `{{aoai-api-key}}`로 저장; 소스 코드에 키를 포함하지 않고 정책에서 참조 |

---

## 13. 예산 및 비용 관리

| 항목 | 예산 | 비고 |
|---|---|---|
| GPT 모델 | $700 | TPM 제한 |
| DeepSeek | $70 | 서버리스 종량제 |
| APIM | ~$50/월 | Developer SKU |
| 버퍼 | $30 | -- |
| **합계** | **$800** | 예산 `eduelden-ai-budget`에서 50%, 80%, 95% 단계별 알림 |

`cost-monitor.yml`을 통한 비용 모니터링 (매일 오전 09:00 KST 실행, 예산 `eduelden-ai-budget` 확인).

---

## 14. 보안 모델

| 계층 | 메커니즘 |
|---|---|
| 학생 → SWA API | 수업 패스코드 (공유 비밀) |
| SWA API → GitHub | PAT 토큰 (repo 범위) |
| GitHub Actions → Azure | 서비스 주체 (RBAC) |
| GitHub Actions → ACS | 연결 문자열 (HMAC-SHA256) |
| 학생 → APIM | APIM 구독 키 (학생별 개별) |
| APIM → Azure OpenAI | Named Value `{{aoai-api-key}}`를 통한 실제 API 키 (Azure Portal에서 관리, 소스 코드에 미포함) |
| 관리자 대시보드 | `X-Admin-Token` 커스텀 헤더를 `DASHBOARD_ADMIN_TOKEN` 환경 변수와 비교 |
| 온보딩 관리자 패널 | SWA 환경 변수의 별도 관리자 비밀번호 |

**절대 평문으로 노출하지 마세요**: APIM 구독 키, Azure OpenAI 키, 서비스 주체 시크릿, ACS 연결 문자열, 대시보드 관리자 토큰.

> **참고**: API 함수는 현재 개발 편의를 위해 `Access-Control-Allow-Origin: *`을 사용하고 있어요. 프로덕션 환경에서는 `staticwebapp.config.json`에서 SWA 도메인으로 제한하거나, API 코드에서 `Origin` 헤더를 검증하세요.

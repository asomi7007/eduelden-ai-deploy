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
| 프론트엔드 호스팅 | Azure Static Web Apps (SWA) | Free 티어, 내장 API (Azure Functions), 자동 배포 |
| 학생 IDE | VS Code + Cline 확장 | OpenAI 호환 프로바이더가 APIM 프록시를 지원 |
| 스크립트 언어 | PowerShell (.ps1) | Windows 학생 PC에 기본 설치 |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        학생 흐름                                     │
│                                                                      │
│  학생 브라우저 ──► SWA 프론트엔드 (docs/index.html)                   │
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
│       │              ├─ Cline 설정 작성 (globalState + secrets)       │
│       │              └─ API 연결 테스트                               │
│       │                                                              │
│       ▼                                                              │
│  VS Code + Cline ──► APIM 게이트웨이 ──► Azure OpenAI / DeepSeek    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 컴포넌트 맵

```
eduelden-ai-deploy/
├── docs/                           # SWA 프론트엔드
│   ├── index.html                  # 온보딩 UI (학생 + 관리자)
│   └── staticwebapp.config.json    # SWA 라우팅 설정
├── api/                            # SWA 백엔드 (Azure Functions v4, Node.js)
│   └── src/functions/
│       ├── slots.js                # GET /api/slots - 온보딩 현황 표시
│       ├── onboard.js              # POST /api/onboard - GitHub Issue 생성
│       ├── cancel.js               # POST /api/cancel - 온보딩 취소
│       └── admin.js                # POST /api/manage - 관리자 대시보드
├── .github/
│   ├── workflows/
│   │   ├── student-onboarding.yml  # 핵심: Issue → 키 → 이메일 파이프라인
│   │   ├── key-management.yml      # APIM 키 회전
│   │   └── cost-monitor.yml        # 일일 비용 리포트
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml  # Issue 템플릿
├── scripts/
│   └── setup-student.ps1           # 학생 PC 자동 설정 (영문)
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
| SWA | `swa-{name}-onboard` | Free | 아무 곳 | 무료 |
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

### 4.2 구독

- 50개 구독: `sub-student-01` ~ `sub-student-50`
- 각 구독은 두 API 모두에 대한 접근 권한
- 구독 요구 사항: 두 API 모두 **비활성화** (인증은 정책에서 처리)

### 4.3 인바운드 정책 (중요 -- Cline 호환성)

APIM 정책은 **세 가지 문제**를 해결해야 해요:

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
Cline (OpenAI SDK)이 보내는 형식: `POST /openai/chat/completions` (본문에 `model` 포함)
Azure OpenAI가 기대하는 형식: `POST /openai/deployments/{model}/chat/completions?api-version=2024-10-21`

정책이 URL을 다시 작성해요:

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
학생의 인증 헤더를 제거하고 진짜 Azure OpenAI 키를 주입해요:

```xml
<set-header name="api-key" exists-action="override">
  <value>{{real-azure-openai-key}}</value>
</set-header>
<set-header name="Authorization" exists-action="delete" />
<set-header name="Ocp-Apim-Subscription-Key" exists-action="delete" />
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
3. **API 설정**: `~/.ai-class/config.json`에 3개 모델 설정 작성
4. **Cline 자동 설정**: `~/.cline/data/globalState.json`과 `secrets.json`에 작성
5. **연결 테스트**: APIM을 통해 테스트 요청 전송

### 8.2 Cline 설정 위치 (중요)

Cline은 API 설정을 VS Code `settings.json`에서 읽지 **않아요**.

| 파일 | 내용 |
|---|---|
| `~/.cline/data/globalState.json` | `actModeApiProvider`, `openAiCompatibleBaseUrl`, `openAiCompatibleModelId` |
| `~/.cline/data/secrets.json` | `openAiCompatibleApiKey` |

### 8.3 스크립트는 반드시 영문으로

PowerShell 스크립트를 GitHub에서 `Invoke-WebRequest`로 다운로드하면 비ASCII 문자의 인코딩이 깨져요. 한국어 Windows의 `cp949` / UTF-8 인코딩 충돌을 피하려면 **모든 출력 문자열은 영문으로만** 작성해야 해요.

---

## 9. 온보딩 프론트엔드 (SWA)

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
| POST | `/api/manage` | 관리자 비밀번호 | 관리자 대시보드 데이터 |

### 레이스 컨디션 처리

`onboard.js`는 생성 후 중복 검사를 포함해요:
- Issue 생성 후, 동일 학번의 모든 열린 Issue를 다시 조회
- 중복이 발견되면 가장 낮은 Issue 번호(먼저 생성된 것)만 유지
- 나중에 생성된 중복 Issue는 `rejected` 라벨로 닫기

---

## 10. 배운 교훈 / 주의사항

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

---

## 11. 예산 및 비용 관리

| 항목 | 예산 | 비고 |
|---|---|---|
| GPT 모델 | $700 | TPM 제한 |
| DeepSeek | $70 | 서버리스 종량제 |
| APIM | ~$50/월 | Developer SKU |
| 버퍼 | $30 | -- |
| **합계** | **$800** | 50%, 80%, 95% 단계별 예산 알림 |

`cost-monitor.yml`을 통한 비용 모니터링 (매일 오전 09:00 KST 실행).

---

## 12. 보안 모델

| 계층 | 메커니즘 |
|---|---|
| 학생 → SWA API | 수업 패스코드 (공유 비밀) |
| SWA API → GitHub | PAT 토큰 (repo 범위) |
| GitHub Actions → Azure | 서비스 주체 (RBAC) |
| GitHub Actions → ACS | 연결 문자열 (HMAC-SHA256) |
| 학생 → APIM | APIM 구독 키 (학생별 개별) |
| APIM → Azure OpenAI | 실제 API 키 (정책에서 주입, 절대 노출 안 됨) |
| 관리자 대시보드 | 별도 관리자 비밀번호 |

**절대 평문으로 노출하지 마세요**: APIM 구독 키, Azure OpenAI 키, 서비스 주체 시크릿, ACS 연결 문자열.

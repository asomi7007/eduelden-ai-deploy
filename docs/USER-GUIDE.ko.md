# 사용자 가이드: Azure AI Foundry 바이브코딩 실습 플랫폼

> 플랫폼을 운영하는 강사와 사용하는 학생을 위한 가이드예요.

---

## 파트 1: 강사 가이드

### 1.1 일상 운영

#### 수업 시작 시
1. 관리자 대시보드 열기: `https://calm-beach-02d18ca00.7.azurestaticapps.net`
2. 로그인: `X-Admin-Token` 커스텀 헤더를 사용해요 (SWA가 `Authorization` 헤더를 덮어쓰기 때문에 별도 헤더를 사용해요)
3. 대시보드 6개 페이지를 활용하세요:
   - **로그인** — 관리자 토큰 입력
   - **전체 개요** — 예산 게이지, 모델별 사용량
   - **학생 목록** — 전체 학생 현황
   - **학생 상세** — 시간별 차트
   - **일괄 제어** — 키 활성화/정지
   - **알림 설정** — 비용 알림 임계값 관리
4. 학생에게 온보딩 URL과 패스코드 공유

#### 수업 중
- 슬롯 그리드로 온보딩 진행 상황 모니터링 (자동 새로고침)
- GitHub Issues에서 `error`나 `pending` 라벨 확인
- 관리자 대시보드 **개요 페이지**에서 실시간 모니터링:
  - 총 요청 수, 예상 비용, 예산 게이지, 모델별 분석
- 관리자 대시보드 **학생 페이지**에서 학생별 사용량과 마지막 활동 시간 확인

#### 수업 종료 시
- 비용 확인: GitHub Actions > `cost-monitor.yml` > Run workflow
- 필요시 학생 키 비활성화 (아래 키 관리 참고)

### 1.2 학생 온보딩 흐름

```
학생이 SWA URL 방문
    ↓
입력: 학번 (01-50) + 이메일 + 패스코드
    ↓
시스템이 GitHub Issue 생성 (label: onboarding)
    ↓
GitHub Actions 워크플로우:
  1. 패스코드 검증
  2. 해당 학생의 APIM 구독 키 조회
  3. ACS로 환영 이메일 발송
  4. 'done' 라벨로 Issue 닫기
    ↓
학생이 이메일 수신:
  - Azure 계정 자격 증명
  - API 키와 Base URL
  - PowerShell 설정 명령어
  - 수동 설정 안내
```

> **참고**: GitHub Free 플랜은 동시 워크플로우 작업 20개를 허용해요. 50명의 학생이 
> 동시에 신청하면 일부는 대기열에 들어가요 (2-5분 지연). 10명씩 그룹으로 나눠서 
> 신청하도록 안내하는 것을 권장해요.

### 1.3 관리자 대시보드

모니터링 대시보드(`swa-eduelden-dashboard`)는 학생 온보딩 SWA와 분리된 별도의 React 앱이에요. 다음 URL에서 접근할 수 있어요:

```
https://calm-beach-02d18ca00.7.azurestaticapps.net
```

#### 로그인
1. 대시보드 URL로 이동하세요
2. 관리자 토큰 입력 (SWA 환경변수 `ADMIN_TOKEN`으로 설정)
3. **Login** 클릭 — 토큰은 브라우저 세션에 저장돼요 (탭 간 공유 안 됨)

#### 대시보드 페이지

| 페이지 | 할 수 있는 것 |
|---|---|
| **개요** | 오늘 총 토큰 사용량, 예산 게이지 ($800 중 %), 최근 30일 일별 사용량 바 차트, Top 5 학생 |
| **학생 목록** | 50명 전체 조회, 학번 또는 이름으로 검색, 사용량/쿼터/상태 기준 정렬 |
| **학생 상세** | 학생별 토큰 이력 차트, 모델 사용 비율 (GPT-mini / GPT / DeepSeek), 일일 쿼터 조정, 구독 정지/재활성화 |
| **일괄 제어** | 전체 학생 쿼터 초기화, 50명 전체 정지, 전체 활성화 |
| **알림 설정** | 3단계 예산 알림 임계값 (기본: 50%/80%/95%), 학생별 일일 토큰 임계값, 관리자 알림 이메일 관리 |

#### 데이터 최신성
대시보드 데이터는 Log Analytics (APIM GatewayLogs)에서 가져와요. API 계층에서 **5분간 캐시**돼요. 수동 새로고침 버튼은 없어요 — 5분 기다리면 새 데이터가 표시돼요.

### 1.4 키 관리

#### 학생 키 회전
```bash
# GitHub Actions를 통해
# Actions > key-management.yml > Run workflow
# 입력: student ID, action: regenerate-student

# CLI를 통해
az rest --method POST \
  --url "https://management.azure.com/subscriptions/{sub-id}/resourceGroups/rg-{name}/providers/Microsoft.ApiManagement/service/apim-{name}-ai/subscriptions/sub-student-{id}/regeneratePrimaryKey?api-version=2022-08-01"
```

#### 학생 키 비활성화
```bash
az apim subscription update --service-name apim-{name}-ai \
  --resource-group rg-{name} \
  --subscription-id sub-student-{id} \
  --state suspended
```

#### 전체 키 일괄 비활성화
```bash
for i in $(seq -w 1 50); do
  az apim subscription update --service-name apim-{name}-ai \
    --resource-group rg-{name} \
    --subscription-id "sub-student-${i}" \
    --state suspended
done
```

### 1.4 비용 모니터링

- **대시보드**: 관리자 대시보드 개요 페이지에서 예산 게이지와 실시간 예상 비용을 확인할 수 있어요
- **자동**: `cost-monitor.yml`이 매일 오전 09:00 KST에 실행
- **예산 알림**: $800의 50%, 80%, 95%에서 관리자에게 이메일
- **수동 확인**:
  ```bash
  az consumption usage list --resource-group rg-{name} \
    --start-date $(date -d "-7 days" +%Y-%m-%d) \
    --end-date $(date +%Y-%m-%d) \
    --query "[].{service:instanceName, cost:pretaxCost}" -o table
  ```

### 1.5 학생 온보딩 취소

**방법 A: 학생이 직접 취소** - SWA 온보딩 페이지에서 (패스코드 필요)

**방법 B: 관리자가 취소** - 관리자 패널 또는 API를 통해:
```bash
curl -X POST "https://{swa-url}/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"01","isAdmin":true,"adminPw":"admin-password"}'
```

### 1.6 수업 후 정리

전체 절차는 `docs/resource-cleanup.md`를 참고하세요. 주요 단계:
1. 모든 APIM 구독 일시 중단
2. 모델 배포 삭제
3. APIM 인스턴스 삭제 (~$50/월 비용 중단)
4. 선택적으로 전체 리소스 그룹 삭제

> **경고**: APIM 삭제 후 48시간 동안 일시 삭제(soft-delete) 상태로 유지돼요. 
> 이 기간 동안 같은 이름으로 APIM을 다시 만들 수 없어요.
> 즉시 제거하려면: `az apim deletedservice purge --service-name apim-{name}-ai --location {region}`

---

## 파트 2: 학생 가이드

### 2.1 시작하기 (자동 설정)

#### 1단계: 온보딩 신청
1. 강사가 알려준 온보딩 페이지를 방문하세요
2. 사용 가능한 학번 (01-50)을 선택하세요
3. 이메일 주소를 입력하세요
4. 수업 패스코드를 입력하세요
5. "Apply" 버튼을 클릭하세요
6. 이메일을 확인하세요 (스팸 폴더도 확인해 주세요)

#### 2단계: 설정 스크립트 다운로드 및 실행

> **중요**: VS Code가 아직 설치되어 있지 않다면 PowerShell을 **관리자 권한**으로 
> 실행하세요 (PowerShell 우클릭 > "관리자 권한으로 실행"). VS Code가 이미 설치되어 
> 있다면 일반 사용자 권한으로 충분해요.

PowerShell을 열고 아래 명령어를 붙여넣으세요:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/{owner}/{repo}/main/scripts/setup-student.ps1" -OutFile setup-student.ps1
```

스크립트 실행 (이메일에서 받은 값으로 교체하세요):
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-student.ps1 -StudentId {YOUR_ID} -ApiKey "{YOUR_KEY}"
```

스크립트가 자동으로 수행하는 작업:
- VS Code 설치 (아직 설치되어 있지 않은 경우)
- Cline 확장 설치
- API 설정 자동 구성
- 연결 테스트
- Power BI MCP 설치 (`C:\MCPServers\PowerBIModelingMCP\`) — Windows exe 직접 실행 (npx 아님)
- Cline MCP 설정에 Power BI 서버 등록

> **참고**: 스크립트 실행 중 VS Code가 열려 있었다면, 스크립트 완료 후 VS Code를 재시작하거나 `Ctrl+Shift+P` → "Reload Window"를 실행하는 것을 권장해요.

#### 3단계: 코딩 시작
1. VS Code를 열어요
2. 왼쪽 사이드바에서 Cline 아이콘을 클릭하세요
3. "Hello!" 같은 메시지를 입력하면 AI 응답을 받을 수 있어요
4. 바이브 코딩을 시작하세요!

### 2.2 수동 설정 (자동 설정이 실패한 경우)

#### VS Code 설치
다운로드: https://code.visualstudio.com/download

#### Cline 확장 설치
1. VS Code를 열어요
2. `Ctrl+Shift+X` (확장) 누르기
3. `Cline` 검색
4. **Cline** (by saoudrizwan) 설치

#### Cline 설정
1. 왼쪽 사이드바에서 Cline 아이콘 클릭
2. **"Bring my own API key"** 선택
3. **API Provider**: `OpenAI Compatible` 선택
4. 다음을 입력하세요:
   - **Base URL**: `https://apim-{name}-ai.azure-api.net/openai/v1`
   - **API Key**: (이메일에서 받은 키)
   - **Model ID**: `gpt-54-mini`
5. **Continue** 클릭

### 2.3 모델 전환하기

3개의 AI 모델을 사용할 수 있어요. Cline 설정 (톱니바퀴 아이콘)에서 변경하세요:

| 모델 | Base URL | Model ID | 적합한 용도 |
|---|---|---|---|
| **GPT-5.4-mini** (기본) | `https://apim-{name}-ai.azure-api.net/openai/v1` | `gpt-54-mini` | 일반 코딩, 빠른 응답 |
| **GPT-5.5** | `https://apim-{name}-ai.azure-api.net/openai/v1` | `gpt-55` | 복잡한 작업, 높은 품질 |
| **DeepSeek V4** | `https://apim-{name}-ai.azure-api.net/deepseek/v1` | `deepseek-v4-flash` | 다른 관점의 답변 |

> **중요**: GPT와 DeepSeek는 **다른 Base URL**을 사용해요 (`/openai/v1` vs `/deepseek/v1`). DeepSeek로 전환할 때 Base URL도 꼭 변경하세요.

### 2.4 속도 제한

| 제한 | 값 |
|---|---|
| 분당 요청 수 | 10회 |
| 일일 요청 수 | 200회 |

제한에 도달하면 1분(분당 제한) 또는 다음 날(일일 제한)까지 기다려 주세요.
오류 메시지: `429 Too Many Requests`

### 2.5 문제 해결

| 문제 | 해결 방법 |
|---|---|
| "401 Unauthorized" | API 키가 올바른지 확인하세요. 이메일에서 다시 복사해 보세요. |
| "404 Resource not found" | Base URL이 `/v1`로 끝나는지 확인하세요. Model ID가 정확히 일치하는지 확인하세요. |
| "429 Too Many Requests" | 속도 제한에 도달했어요. 1분 기다린 후 다시 시도하세요. |
| Cline이 응답하지 않음 | 인터넷 연결을 확인하세요. Retry 버튼을 클릭해 보세요. |
| 스크립트가 실행되지 않음 | 먼저 `Set-ExecutionPolicy Bypass -Scope Process -Force`를 실행하세요 |
| 설치 후 VS Code를 찾을 수 없음 | PowerShell을 닫고 다시 열어서 PATH를 갱신하세요 |
| Cline이 설정을 읽지 못함 | 설정 파일의 UTF-8 BOM 문제. 다시 저장: `[IO.File]::WriteAllText("$env:USERPROFILE\.cline\data\globalState.json", (Get-Content ... -Raw), [Text.UTF8Encoding]::new($false))` |
| DeepSeek 첫 요청이 매우 느림 | 서버리스 콜드 스타트 (10-30초). 첫 요청에서 정상적인 현상이에요. 기다린 후 재시도하세요. Cline 타임아웃을 60초 이상으로 설정하세요 |
| 온보딩 완료된 학생을 취소함 | 취소는 Issue만 닫고 APIM 키는 비활성화하지 않아요. key-management 워크플로우에서 `disable-student` 액션을 실행하여 키도 비활성화하세요 |
| gpt-55 파라미터 오류 (400/403) | APIM이 지원되지 않는 파라미터(`prediction`, `stream_options`, `service_tier`, `store`, `metadata`)를 자동 제거해요. 이미 적용됨. 계속 실패하면 APIM 정책을 확인하세요. |
| Power BI MCP "No connection found" | npx 래퍼가 stdout에 일반 텍스트를 출력하여 MCP 프로토콜을 오염시켜요. exe 직접 실행을 사용하세요: `C:\MCPServers\PowerBIModelingMCP\powerbi-modeling-mcp.exe` 존재 확인. 없으면 `setup-student.ps1`을 재실행하세요. |
| 대시보드에 데이터 0건 | APIM 진단이 Resource-specific 모드여야 해요. `az monitor diagnostic-settings list`로 확인하세요. KQL이 양쪽 테이블을 union으로 조회해요. |
| 대시보드 로그인 401 | SWA가 `Authorization` 헤더를 덮어써요. `X-Admin-Token` 커스텀 헤더를 사용하세요. SWA 설정의 `ADMIN_TOKEN` 환경변수를 확인하세요. |

---

## 부록 A: 아키텍처 빠른 참조

```
학생 브라우저
    ↓ HTTPS
Azure Static Web App (프론트엔드 + API)
    ↓ GitHub API
GitHub Issues + Actions
    ↓ ACS Email
학생 이메일
    ↓ PowerShell 스크립트
VS Code + Cline
    ↓ HTTPS (Authorization: Bearer)
Azure APIM (속도 제한 + URL 재작성 + 키 주입)
    ↓ api-key 헤더
Azure OpenAI / DeepSeek (AI 모델)
```

## 부록 B: 전체 자격 증명 참조

| 자격 증명 | 사용 위치 | 저장 위치 |
|---|---|---|
| 수업 패스코드 | 학생 온보딩 폼 | GitHub Secret + SWA 환경 변수 |
| 관리자 비밀번호 | 관리자 대시보드 | SWA 환경 변수 |
| GitHub PAT | SWA API → GitHub Issues | SWA 환경 변수. 필요한 범위: `repo` (또는 세분화: Issues R/W + Contents R) |
| AZURE_CREDENTIALS | GitHub Actions → Azure | GitHub Secret |
| ACS_CONNECTION_STRING | GitHub Actions → 이메일 | GitHub Secret |
| ACS_SENDER_ADDRESS | 이메일 발신 주소 | GitHub Secret |
| APIM 구독 키 | 학생 → APIM | 학생별 생성, 이메일로 발송 |
| Azure OpenAI 키 | APIM → Azure OpenAI | APIM Named Value `{{aoai-api-key}}` (secret=true) |
| 관리자 토큰 | 대시보드 로그인 | SWA 환경변수 `ADMIN_TOKEN`, `X-Admin-Token` 헤더로 전송 |
| AZURE_SWA_DASHBOARD_TOKEN | 대시보드 SWA 배포 | GitHub Secret |

## 부록 C: APIM 정책의 모델 설정

APIM 정책은 OpenAI 호환 형식(Cline이 보내는 것)과 Azure OpenAI 형식(백엔드가 기대하는 것) 사이의 변환을 처리해요:

```
Cline이 보내는 형식:                    APIM이 변환하는 형식:
POST /openai/v1/chat/completions  →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
POST /openai/chat/completions     →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
Body: {"model":"gpt-54-mini",...}     (model을 본문에서 추출하여 URL 경로에 주입)
```

이렇게 하면 학생들이 Azure의 배포 기반 URL 구조를 몰라도 표준 OpenAI 호환 클라이언트를 사용할 수 있어요.

#### 파라미터 자동 제거

APIM 인바운드 정책이 Azure OpenAI에서 지원하지 않는 파라미터를 요청 본문에서 자동으로 제거해요:

- `prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`

Cline이 이러한 파라미터를 보낼 때 발생하는 400/403 오류를 방지하기 위한 조치예요. 학생 입장에서는 별도 설정 없이 자동으로 처리돼요.

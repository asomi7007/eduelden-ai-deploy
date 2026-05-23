# 사용자 가이드: Azure AI Foundry 바이브코딩 실습 플랫폼

> 플랫폼을 운영하는 강사와 사용하는 학생을 위한 가이드예요.

---

## 파트 1: 강사 가이드

### 1.1 일상 운영

#### 수업 시작 시
1. 관리자 대시보드 열기: `https://{swa-url}` → Admin 섹션으로 스크롤
2. 관리자 비밀번호 입력 → 온보딩 통계 확인
3. 학생에게 온보딩 URL과 패스코드 공유

#### 수업 중
- 슬롯 그리드로 온보딩 진행 상황 모니터링 (자동 새로고침)
- GitHub Issues에서 `error`나 `pending` 라벨 확인
- Azure Portal > APIM > Analytics에서 API 사용량 모니터링

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

### 1.3 키 관리

#### 학생 키 회전
```bash
# GitHub Actions를 통해
# Actions > key-management.yml > Run workflow
# 입력: student ID, action: rotate

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
| **GPT-5.4-mini** (기본) | `.../openai/v1` | `gpt-54-mini` | 일반 코딩, 빠른 응답 |
| **GPT-5.5** | `.../openai/v1` | `gpt-55` | 복잡한 작업, 높은 품질 |
| **DeepSeek V4** | `.../deepseek/v1` | `deepseek-v4-flash` | 다른 관점의 답변 |

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
| GitHub PAT | SWA API → GitHub Issues | SWA 환경 변수 |
| AZURE_CREDENTIALS | GitHub Actions → Azure | GitHub Secret |
| ACS_CONNECTION_STRING | GitHub Actions → 이메일 | GitHub Secret |
| ACS_SENDER_ADDRESS | 이메일 발신 주소 | GitHub Secret |
| APIM 구독 키 | 학생 → APIM | 학생별 생성, 이메일로 발송 |
| Azure OpenAI 키 | APIM → Azure OpenAI | APIM 정책에 내장 |

## 부록 C: APIM 정책의 모델 설정

APIM 정책은 OpenAI 호환 형식(Cline이 보내는 것)과 Azure OpenAI 형식(백엔드가 기대하는 것) 사이의 변환을 처리해요:

```
Cline이 보내는 형식:                    APIM이 변환하는 형식:
POST /openai/v1/chat/completions  →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
POST /openai/chat/completions     →  POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
Body: {"model":"gpt-54-mini",...}     (model을 본문에서 추출하여 URL 경로에 주입)
```

이렇게 하면 학생들이 Azure의 배포 기반 URL 구조를 몰라도 표준 OpenAI 호환 클라이언트를 사용할 수 있어요.

# Techive의 여덟 번째 발표  with 광주과학기술원 — 강사 런북

- 일시: 2026-11-07 (토)
- 강사: 허석
- 인원: 40명 (APIM 구독 키는 50개: `sub-student-01` ~ `sub-student-50`)
- 구성: VS Code + Power BI Desktop + GitHub Copilot(BYOK, Custom Endpoint)
- 이벤트 ID: `kimi-copilot-20261107-gwangju`

## 1. 인프라 / 쿼터 정보

| 항목 | 값 |
|---|---|
| 게이트웨이 | `https://apim-eduelden-ai-v2.azure-api.net/openai/v1` (APIM Basic v2, `apim-eduelden-ai-v2`) |
| 리소스 그룹 / 구독 | `rg-eduelden-hub` / `08bfa8d7-3cb6-42d6-8214-18e784777a56` |
| 모델 | `gpt-5.4-mini` 주력 + `Kimi-K3.1-Pro` 선택 (그 외 모델명은 400 거부) |
| GPT 쿼터 | 기존 4M TPM / 4,000 RPM + 추가 10M TPM / 10,000 RPM = 합계 14M TPM / 14,000 RPM |
| Kimi 쿼터 | 각 테넌트 100K TPM / 100 RPM = 합계 200K TPM / 200 RPM |
| 학생별 제한 | 구독 ID별 분당 30회 / 일 500회, 두 모델·primary/secondary 키 합산 |
| 출력 토큰 | `max_tokens`를 `max_completion_tokens`로 통합하고 최대 4096으로 제한 |
| 인증 | APIM native subscription key (`Ocp-Apim-Subscription-Key` 헤더) |
| API 방식 | Chat Completions만 지원 (`/responses`는 400) |

> 합계 용량은 테넌트별 한도를 더한 값이며 단일 요청이 두 테넌트의 용량을 합쳐 쓰지는 않습니다. 주력 GPT도 긴 대화·MCP 결과와 순간적인 요청 집중으로 429가 발생할 수 있습니다. Kimi는 GPT보다 처리 여유가 훨씬 작으므로 40명 공통 주력 모델로 사용하지 않습니다.

### 테넌트별 학생 배정

| 테넌트 | 리소스 | GPT 실제 배포명 | GPT 비율 | Kimi 실제 배포명 |
|---|---|---|---|---|
| 기존 | `ai-poc-sandbox-resource` (`eastus2`) | `gpt-5.4-mini` | 2/7 | `Kimi-K3.1-Pro` |
| 추가 | `asomi-4512-resource` (`westus3`) | `gpt-5.4-mini-1` | 5/7 | `Kimi-K3.1-Pro` |

- GPT 배정 산식: 첫 N명 중 기존 테넌트 인원 = `round(N × 4 / 14)`. 40명은 기존 11명·추가 29명, 50명은 기존 14명·추가 36명입니다.
- Kimi는 처리 용량이 같아 1:1입니다. 40명은 각 20명, 50명은 각 25명입니다.
- 번호별 배정은 누적 반올림 차이로 계산해 작은 번호부터 신청해도 비율을 분산합니다. 01번은 GPT 추가·Kimi 기존, 02번은 GPT 기존·Kimi 추가입니다.
- 배정은 모델별로 고정되며 재시도·키 회전 후에도 유지됩니다. 취소로 중간 번호가 비면 실제 활성 인원의 비율은 다소 달라질 수 있습니다.
- 학생은 공통 모델 ID·공통 게이트웨이 주소·기존 APIM 키를 사용합니다. 추가 테넌트의 GPT 배포명은 게이트웨이가 바꾸므로 메일 JSON을 `gpt-5.4-mini-1`로 변경하지 않습니다.
- 기존 테넌트는 Managed Identity, 추가 테넌트는 비밀 Named Value `workshop-secondary-key`의 리소스 키로 인증합니다. 백엔드 키는 학생에게 전달하지 않습니다.
- 응답의 `X-Workshop-Tenant` 헤더는 `primary` 또는 `secondary`입니다. 429의 `Retry-After`·모델 rate-limit 헤더도 확인합니다. 자동 테넌트 전환이나 서버 재시도는 하지 않습니다.
- GPT의 Chat Completions 호출은 `reasoning_effort=none`으로 전달해 도구 호출과 빠른 응답을 우선합니다. 학생 공급자는 **Custom Endpoint / Chat Completions**를 유지합니다. 제공된 Foundry `/responses` URL과 달리 이 게이트웨이에서는 `/responses`를 지원하지 않습니다.

### 라우팅 적용 및 복원

Windows PowerShell 7에서 다음 명령을 실행합니다. Cloud Shell에서는 같은 스크립트를 `pwsh -File ./scripts/deploy-workshop-routing.ps1`로 실행할 수 있습니다.

```powershell
.\scripts\deploy-workshop-routing.ps1                   # 변경 없이 배정과 적용 작업 미리 보기
.\scripts\deploy-workshop-routing.ps1 -Apply -SmokeTest # 승인 후 적용 + 12건 소량 검증 호출
.\scripts\deploy-workshop-routing.ps1 -SmokeTest        # 정책을 바꾸지 않고 현재 게이트웨이만 검증
```

- [공통 설정](../../infra/workshop-routing.js)이 메일 모델 목록·배정·[정책 XML](../../infra/apim-v2-kimi-policy.xml)을 생성합니다. 설정 변경 후 `node infra\workshop-routing.js --write`와 `npm test --prefix api`를 실행합니다.
- [적용 스크립트](../../scripts/deploy-workshop-routing.ps1)는 두 구독 로그인과 배포 모델·쿼터를 검증한 뒤에만 APIM을 수정합니다. 모델 쿼터가 달라졌으면 중단하므로 먼저 비율을 재계산합니다.
- 새 Azure 리소스·RBAC·구독 키는 만들거나 바꾸지 않습니다. 추가 백엔드와 비밀 Named Value만 저장하고 API 정책을 적용합니다. 키는 메모리에서만 다루며 출력하지 않습니다.
- 이전 API 정책은 `.secrets/workshop-policy-backup-YYYYMMDD-HHmmss.json`에 백업합니다. 실패 시 해당 백업의 `properties`를 기존 API 정책 ARM 주소에 PUT하여 복원합니다. 복원 전 승인과 대상 백업을 확인하고 비밀 Named Value는 임의로 삭제하지 않습니다.
- 검증은 01·02번으로 각 모델의 일반 텍스트·도구 호출·스트리밍을 확인합니다. 기대한 테넌트, 비어 있지 않은 응답·도구 인자, 스트림 종료까지 검사합니다. 실패 요청을 자동 재발송하지 않습니다. 40명 동시 부하 검증은 별도입니다.
- Kimi Pro 배포는 응답의 `model` 필드에 `Kimi-K3.1`을 반환하기도 합니다. 실제 배포 모델은 ARM에서 `Kimi-K3.1-Pro`로 검증하며 학생 설정의 모델 ID는 바꾸지 않습니다.

## 2. 사전 체크 (전날~당일 아침)

1. 신청 페이지 배포 확인: GitHub Actions의 `Onboard Page Deploy` 워크플로우 성공 여부 (시크릿 `AZURE_SWA_ONBOARD_TOKEN`).
2. GitHub 저장소에 `STUDENT_KEYS_JSON` 시크릿이 있고, 현재 APIM 키 50개와 일치하는지 확인합니다. 키를 재생성하면 이 시크릿도 갱신해야 합니다.
3. 신청 페이지 접속 후 이전 행사 신청 내역을 초기화합니다. (이전 신청이 남아 있으면 번호가 01부터 채워지지 않습니다.) 초기화 전에는 기존 이슈 목록과 수강 이력을 확인하세요.
4. **본인 이메일로 테스트 신청 1건** 수행
   - 메일이 도착하는지, 제목이 `[Techive의 여덟 번째 발표  with 광주과학기술원] NN번 — 접속 정보 및 설치 안내`인지 확인
   - 메일의 JSON을 `chatLanguageModels.json`에 붙여넣고 모델 피커에서 `GPT 5.4 mini` 선택 → "안녕하세요라고 답해줘" 응답 확인
   - 테스트 후 취소/재신청 탭 또는 관리자 탭에서 취소해 번호를 반납합니다.
5. APIM 429 모니터링 준비: Azure Portal > `apim-eduelden-ai-v2` > Monitoring(Metrics 또는 Logs)에서 응답 코드 429 건수를 확인할 수 있게 창을 띄워 둡니다.
6. 학생 공통 준비물 공지: Windows 노트북, GitHub 계정, VS Code / Power BI Desktop 설치.

### 수업 패스코드 변경

1. 신청 페이지의 **관리자** 탭에서 관리자 비밀번호로 로그인합니다.
2. **수업 패스코드 변경**에 새 코드와 확인 값을 입력합니다. 공백 없이 4~128자를 사용할 수 있습니다.
3. **패스코드 변경**을 누르고 저장 완료 안내를 확인한 다음, 새 코드를 수강생에게 알려주세요.

- 새 코드는 신청과 학생 취소에 바로 적용되며, 이전 코드는 더 이상 사용할 수 없습니다.
- 이미 접수된 신청의 메일 발송, 발급된 API 키, 관리자 비밀번호는 바뀌지 않습니다.
- 현재 코드와 새 코드는 응답·로그에 표시하지 않습니다. 코드를 잊으면 관리자 모드에서 다시 변경하세요.
- 설정은 비공개 저장소의 `class-settings` 이슈에 서명된 솔트·해시로 저장됩니다. 페이지 새로고침이나 API 재시작 후에도 유지되고, 신청 전체 초기화로는 지워지지 않습니다. 이 설정 이슈는 직접 수정하거나 삭제하지 마세요.
- 첫 변경 전에는 기존 `CLASS_PASSCODE` 환경변수를 사용합니다. API와 GitHub Actions에는 동일한 별도 `ONBOARDING_SIGNING_KEY`를 설정해야 합니다. 이 값은 수강생에게 공개하지 않으며, 변경 후에도 유지해야 합니다.
- 설정 이슈의 번호를 SWA 앱 설정과 GitHub Repository Variable의 `CLASS_PASSCODE_ISSUE_NUMBER`에 동일하게 지정합니다. 목록 반영 지연 없이 해당 이슈를 직접 읽고, 이슈가 없거나 손상되면 이전 코드로 되돌아가지 않고 오류를 반환합니다.

## 3. 학생 안내 순서 (당일)

1. **신청 페이지 URL + 패스코드 공지** (화면/QR 코드 공유). 학생은 이메일과 패스코드만 입력하면 번호가 자동 배정됩니다.
2. 학생이 **메일 수신** 확인 (신청 후 1~2분). 메일에는 엔드포인트 URL, API 키, 모델 ID, 설치 링크, 모델 등록 JSON, 실습 설명과 매뉴얼 URL이 들어 있습니다.
3. **설치**: VS Code → Power BI Desktop(Microsoft Store 권장) → GitHub Copilot 확장 설치 및 로그인 (Copilot Free 가능).
4. **모델 등록**: Copilot Chat > 모델 드롭다운 > `Manage Language Models...` > `Add Model` > **Custom Endpoint** → `chatLanguageModels.json`에 메일의 JSON 붙여넣기 → 저장 → 모델 피커에서 `GPT 5.4 mini` 선택. 필요하면 `Kimi K3.1 Pro`로 전환할 수 있습니다.
   - API type은 반드시 **Chat Completions** (Azure 공급자 선택 금지)
5. **확인 테스트**: 채팅에 "안녕하세요라고 답해줘" 입력 후 응답 확인.
6. **실습 시작**: [PBI_AGENT_QUEST · 한결전자(K-Retail) Power BI AI 에이전트 완전 자동화 매뉴얼](https://power-platform-users-korea.github.io/copilot-dev-days-seoul-2026/powerbi-agent/)에서 실습 패키지 ZIP을 내려받고 PBIP·MCP 준비 안내를 따라 진행합니다. 교육용 가상 데이터로 DAX 측정값 생성·검증, 보고서 작성과 화면 검수를 실습합니다.
   - 메일의 매뉴얼 URL 바로 아래에 [실습 패키지 다운로드 (ZIP)](https://power-platform-users-korea.github.io/copilot-dev-days-seoul-2026/powerbi-agent/kit/K_Retail_PowerBI_Agent_%EC%8B%A4%EC%8A%B5%ED%8C%A8%ED%82%A4%EC%A7%80_%ED%86%B5%ED%95%A9%EB%B3%B8.zip) 링크도 포함됩니다.

실습 안내는 새 신청의 환영 메일에 포함됩니다. 기존 신청자에게는 자동 재발송하지 않습니다.

## 4. 자주 발생하는 문제

| 증상 | 안내 |
|---|---|
| 429 | 학생별 분당 30회·일 500회 제한 또는 배정된 모델의 공유 TPM/RPM 초과. `Retry-After`를 따르고 대화·MCP 결과를 줄입니다. Kimi 사용 중이면 GPT로 전환합니다. |
| 400 `model_not_allowed` | 모델 ID를 `gpt-5.4-mini` 또는 `Kimi-K3.1-Pro`로 정확히 입력 |
| 400 (API type 안내) | API type이 Chat Completions인지 확인 (`/responses` 방식 사용 불가) |
| 401 | 메일 JSON의 `apiKey`와 `requestHeaders.Ocp-Apim-Subscription-Key` 값이 같은지 확인하고, 키를 바꾸지 않았는지 확인 |
| 이메일 중복 신청(409) | 이미 신청된 이메일. 메일함 확인 또는 취소/재신청 탭 이용 |
| 메일 미수신 | 스팸함 확인 → GitHub Issues의 `onboarding` 이슈와 Actions 실행 결과 확인 → 안 되면 백업 플랜 |

## 5. 장애 시 백업 플랜

신청 페이지, GitHub Actions, 메일 발송 중 하나라도 막히면 키를 수동으로 배포합니다.

1. 강사 PC의 `.secrets/student_keys_v2.csv` 파일에서 학생별 키를 확인합니다. (파일은 저장소에 커밋하지 않으며, 내용은 이 문서에 기록하지 않습니다.)
2. 학생에게 번호와 키를 1:1(메신저/종이 쪽지 등)로 전달합니다. 공개 화면이나 단체방에 키를 올리지 않습니다.
3. 학생은 메일 안내와 동일하게 JSON을 직접 작성합니다.
   - `url`: `https://apim-eduelden-ai-v2.azure-api.net/openai/v1/chat/completions`
   - 모델 ID: `gpt-5.4-mini` (주력) 또는 `Kimi-K3.1-Pro`, `apiType`: `chat-completions`
4. 키가 노출되었거나 오남용되면 Azure Portal에서 해당 `sub-student-NN` 구독을 일시 정지하거나 키를 재생성합니다.

## 6. 종료 후

- 행사 종료 후 APIM 구독 키 재생성 또는 정지, 비용 확인
- 신청 페이지 관리자 탭에서 전체 초기화 (다음 행사 대비)

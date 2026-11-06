# AI 바이브코딩 워크숍 (광주) — 강사 런북

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
| 모델 | `Kimi-K3.1-Pro` 단일 (다른 모델명은 400 거부) |
| 전체 쿼터 | 100K TPM / 100 RPM |
| 학생별 제한 | 분당 30회 / 일 500회 (초과 시 429 + `Retry-After` 헤더) |
| 출력 토큰 | `max_tokens`는 게이트웨이가 4096으로 제한 |
| 인증 | `Authorization: Bearer <키>` 또는 `api-key` 헤더 |
| API 방식 | Chat Completions만 지원 (`/responses`는 400) |

> 전체 RPM이 100이라 40명이 동시에 요청하면 429가 날 수 있습니다. 실습 중 "동시에 전송" 안내를 피하고, 429는 잠시 후 재시도하도록 안내하세요.

## 2. 사전 체크 (전날~당일 아침)

1. 신청 페이지 배포 확인: GitHub Actions의 `Onboard Page Deploy` 워크플로우 성공 여부 (시크릿 `AZURE_SWA_ONBOARD_TOKEN`).
2. 신청 페이지 접속 후 **관리자 탭 > 전체 초기화**로 이전 행사 신청 내역을 비웁니다. (이전 신청이 남아 있으면 번호가 01부터 채워지지 않습니다.)
3. **본인 이메일로 테스트 신청 1건** 수행
   - 메일이 도착하는지, 제목이 `[AI 워크숍] NN번 — 접속 정보 및 설치 안내`인지 확인
   - 메일의 JSON을 `chatLanguageModels.json`에 붙여넣고 모델 피커에서 `Kimi K3.1 Pro` 선택 → "안녕하세요라고 답해줘" 응답 확인
   - 테스트 후 취소/재신청 탭 또는 관리자 탭에서 취소해 번호를 반납합니다.
4. APIM 429 모니터링 준비: Azure Portal > `apim-eduelden-ai-v2` > Monitoring(Metrics 또는 Logs)에서 응답 코드 429 건수를 확인할 수 있게 창을 띄워 둡니다.
5. 학생 공통 준비물 공지: Windows 노트북, GitHub 계정, VS Code / Power BI Desktop 설치.

## 3. 학생 안내 순서 (당일)

1. **신청 페이지 URL + 패스코드 공지** (화면/QR 코드 공유). 학생은 이메일과 패스코드만 입력하면 번호가 자동 배정됩니다.
2. 학생이 **메일 수신** 확인 (신청 후 1~2분). 메일에는 엔드포인트 URL, API 키, 모델 ID, 설치 링크, 모델 등록 JSON이 들어 있습니다.
3. **설치**: VS Code → Power BI Desktop(Microsoft Store 권장) → GitHub Copilot 확장 설치 및 로그인 (Copilot Free 가능).
4. **모델 등록**: Copilot Chat > 모델 드롭다운 > `Manage Language Models...` > `Add Model` > **Custom Endpoint** → `chatLanguageModels.json`에 메일의 JSON 붙여넣기 → 저장 → 모델 피커에서 `Kimi K3.1 Pro` 선택.
   - API type은 반드시 **Chat Completions** (Azure 공급자 선택 금지)
5. **확인 테스트**: 채팅에 "안녕하세요라고 답해줘" 입력 후 응답 확인.

## 4. 자주 발생하는 문제

| 증상 | 안내 |
|---|---|
| 429 | 분당 30회 제한. 잠시 후 재시도 (`Retry-After` 헤더 참고) |
| 400 `model_not_allowed` | 모델 ID를 `Kimi-K3.1-Pro`로 정확히 입력 |
| 400 (API type 안내) | API type이 Chat Completions인지 확인 (`/responses` 방식 사용 불가) |
| 401 | 메일의 API 키와 JSON의 `apiKey` 값이 같은지 확인 |
| 이메일 중복 신청(409) | 이미 신청된 이메일. 메일함 확인 또는 취소/재신청 탭 이용 |
| 메일 미수신 | 스팸함 확인 → GitHub Issues의 `onboarding` 이슈와 Actions 실행 결과 확인 → 안 되면 백업 플랜 |

## 5. 장애 시 백업 플랜

신청 페이지, GitHub Actions, 메일 발송 중 하나라도 막히면 키를 수동으로 배포합니다.

1. 강사 PC의 `.secrets/student_keys_v2.csv` 파일에서 학생별 키를 확인합니다. (파일은 저장소에 커밋하지 않으며, 내용은 이 문서에 기록하지 않습니다.)
2. 학생에게 번호와 키를 1:1(메신저/종이 쪽지 등)로 전달합니다. 공개 화면이나 단체방에 키를 올리지 않습니다.
3. 학생은 메일 안내와 동일하게 JSON을 직접 작성합니다.
   - `url`: `https://apim-eduelden-ai-v2.azure-api.net/openai/v1/chat/completions`
   - 모델 ID: `Kimi-K3.1-Pro`, `apiType`: `chat-completions`
4. 키가 노출되었거나 오남용되면 Azure Portal에서 해당 `sub-student-NN` 구독을 일시 정지하거나 키를 재생성합니다.

## 6. 종료 후

- 행사 종료 후 APIM 구독 키 재생성 또는 정지, 비용 확인
- 신청 페이지 관리자 탭에서 전체 초기화 (다음 행사 대비)

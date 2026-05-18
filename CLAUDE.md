# Azure AI Foundry 바이브코딩 실습 환경 구축 — Claude Code 작업 컨텍스트

> 이 파일은 Claude Code가 새 세션 시작 시 자동으로 읽는 프로젝트 메모리예요.
> 사용자(허석, asomi70@gmail.com)와 함께 Azure AI Foundry 기반 학생 50명 실습 환경을
> Phase 0 → Phase 8 순서로 구축하는 중입니다.

---

## 프로젝트 개요

- **수업명**: Azure AI Foundry 바이브코딩 실습 (1차시)
- **수강생**: 50명 (01~50@eduelden.kr)
- **예산**: $800 USD (모델별: gpt 계열 $500 + $200, DeepSeek $70, 버퍼 $30)
- **학생 환경**: Windows + VS Code + Cline 확장(`saoudrizwan.claude-dev`)
- **이메일 발송**: Microsoft Graph API (SendGrid 안 씀)
- **작업 시작일**: 2026-05-19
- **사용자 GitHub**: asomi7007

## Azure 환경 (확정값)

| 항목 | 값 |
|---|---|
| 구독 ID | `3354f2f5-e261-49af-9ead-2c6938f447a3` |
| 테넌트 도메인 | `eduelden09outlook.onmicrosoft.com` |
| 디렉터리 | 기본 디렉터리 (eduelden.kr) |
| 리소스 그룹 | `rg-powerplatform-billing` (Korea Central) |
| Foundry 리소스 | `eduelden-ai-resource` (East US 2) |
| Foundry 프로젝트 | `eduelden-ai` |
| 프로젝트 엔드포인트 | `https://eduelden-ai-resource.services.ai.azure.com/api/projects/eduelden-ai` |
| OpenAI 엔드포인트 | `https://eduelden-ai-resource.openai.azure.com/openai/v1` |
| 관리자 이메일 | `admin@eldensoluton.kr` |
| App Insights | `eduelden-ai-resource-appinsights` |
| Log Analytics | `eduelden-ai-resource-logs` |
| Fabric Capacity | `capfabriceduelden` |

## 학생 계정 현황 (이미 존재)

- `01@eduelden.kr` ~ `52@eduelden.kr` (총 86명 중 학생용 50명 = 01~50)
- 초기 비밀번호: `Eduelden2025!` (첫 로그인 시 변경)
- 보안그룹 `AI-Class-Students-Eduelden` — **아직 미생성**

## 아직 만들어지지 않은 것 (다음 작업)

- [ ] Cost Management 예산 $800 + 알림 3단계
- [ ] 모델 배포 3종 (실제 카탈로그 확인 후 모델명 확정 필요)
- [ ] APIM 인스턴스 `apim-eduelden-ai` (Developer SKU)
- [ ] Entra ID 보안그룹 + RBAC + Graph API 앱 등록
- [ ] GitHub repo `asomi7007/eduelden-ai-deploy` (Private)
- [ ] GitHub Actions 워크플로우 4종 (student-onboarding, key-management, cost-monitor 등)
- [ ] PowerShell 학생 자동 설정 스크립트 `setup-student.ps1`
- [ ] 실습 스타터 프로젝트 `ai-class-starter`

## 모델 정책 (사용자 확정사항)

- 가이드 문서에 적힌 모델명(`gpt-5.5`, `gpt-5.4-mini`, `DeepSeek-V4-Flash`)은 사용자가
  Azure AI Foundry 카탈로그에서 직접 확인한 실제 배포 가능 모델로 가정.
- **Phase 2 첫 단계에서 `az cognitiveservices account list-models`로 카탈로그 재확인 필수.**
- 만약 카탈로그에 없으면 사용자와 다시 의논해 대체 모델 선정.
- gpt 계열 1개(고품질·느림, TPM 50K), gpt-mini 계열 1개(범용·빠름, TPM 100K),
  DeepSeek-V4-Flash × 2개 배포(APIM 라운드로빈으로 동접 분산).

## APIM 정책 (학생 1키 → 3개 모델 접근)

- Rate Limit: 분당 10회, 일 200회 (Quota)
- 학생 구독 키: `sub-student-01` ~ `sub-student-50`
- Base URL 경로 분기:
  - `/{gateway}/openai` → Azure OpenAI 모델
  - `/{gateway}/deepseek` → DeepSeek 라운드로빈
- 학생은 Cline에서 Base URL + Model ID만 바꿔서 모델 전환, 키는 동일

## 작업 진행 방식 (사용자 합의 사항)

1. **Phase 0부터 순서대로** 진행. 건너뛰지 않음.
2. **MCP 도구 우선 사용** — Azure MCP 또는 GitHub MCP로 가능한 건 직접 실행.
3. MCP로 안 되거나 위험한 작업(대량 계정 생성, 비용 발생 배포)은 **반드시 사용자에게
   먼저 명령어를 보여주고 승인 받은 뒤 실행**.
4. 각 Phase 끝나면 사용자에게 결과 요약하고 다음 Phase 진행 의사 확인.

## 작업 목록 (Phase별)

`HANDOVER.md`의 "Phase별 체크리스트" 섹션 참고. Claude Code에서 TodoWrite 도구로
프로젝트 시작 시 재생성하세요.

## 코딩/문서 규칙

- 한국어로 응답 (사용자가 한국어 사용 중).
- 위험한 작업(`az ... delete`, `--force`, 권한 변경, 비용 발생 리소스 생성) 전에는
  반드시 사용자 확인.
- 비밀(시크릿, 키, 클라이언트 시크릿)은 **절대로 평문으로 chat에 출력 금지**.
  파일로 저장하거나 ENV 참조만.
- 모든 스크립트는 Cloud Shell(Bash) 또는 Windows PowerShell 양쪽 호환 명시.

## 참고 문서

- 원본 가이드: 사용자가 1차시 가이드 docx 업로드함 (`Azure_AI_Foundry_바이브코딩_가이드_1차시_2026-5-19-.docx`)
- 가이드 모델명(`gpt-5.5` 등)은 실제 카탈로그와 다를 수 있음 — Phase 2에서 재확인.

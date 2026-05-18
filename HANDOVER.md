# Cowork → Claude Code 핸드오프 문서

> Cowork 모드에서 시작한 작업을 로컬 Claude Code로 이관하면서 모든 컨텍스트를 정리한 문서.
> Claude Code 새 세션에서 **첫 프롬프트로 이 파일을 읽고 다음 단계를 진행**하세요.

---

## TL;DR — Claude Code에게 줄 첫 프롬프트

```
이 폴더의 CLAUDE.md와 HANDOVER.md를 읽고, Phase별 체크리스트를 TodoWrite로 등록한 다음
Phase 0부터 시작해줘. Azure MCP가 연결되어 있는지 먼저 mcp list로 확인하고,
연결되어 있으면 그걸로 az 명령을 실행해. 안 되면 사용자에게 Cloud Shell에서 실행할
명령어를 보여주고 결과를 받아서 진행해.
```

---

## 지금까지 한 일 (Cowork 세션 요약)

1. ✅ 가이드 docx 파일 분석 — 8개 Phase, 50명 학생, $800 예산, 3개 모델 구조 파악
2. ✅ 가이드 vs 실제 환경 차이 식별:
   - 가이드 적힌 리소스명 `eduelden09-8782-resource` → 실제는 `eduelden-ai-resource`
   - 가이드 적힌 프로젝트명 `eduelden09-8782` → 실제는 `eduelden-ai`
3. ✅ 사용자와 4가지 의사결정 확정 (모델·시작 단계·실행 주체·GitHub repo)
4. ✅ Cowork MCP 레지스트리 검색 — Azure/GitHub/Graph MCP 모두 없음 확인
5. ✅ **Claude Code로 이관 결정** ← **현재 여기**
6. ⏳ Phase 0~8 작업 (아직 시작 안 함)

## 사용자가 확정한 의사결정

| 질문 | 답 |
|---|---|
| 모델 선택 | 가이드 문서에 적힌 모델명 그대로 사용 (사용자가 실제 카탈로그에서 확인했다고 함) — **단, Phase 2 첫 단계에서 재검증** |
| 시작 단계 | Phase 0부터 순서대로 |
| 실행 주체 | MCP 가능하면 Claude가 직접, 안 되면 사용자가 Cloud Shell에서 |
| GitHub repo | `asomi7007/eduelden-ai-deploy` Private 새로 생성 |
| 환경 이관 | Cowork → Claude Code (현재 진행 중) |

## 사용자 환경 (확정)

- OS: Windows
- Azure CLI 설치됨, `az login` 된 상태로 가정
- Azure AI Foundry CLI 설치됨
- GitHub 계정: `asomi7007`
- Azure 권한: 구독 소유자(Owner) 또는 동급
- GitHub 연결 의사: 있음

## Phase별 체크리스트 (Claude Code TodoWrite로 등록할 항목)

### Phase 0 — 사전 준비 점검
- [ ] 0-1. 구독 활성·리소스 그룹 접근 확인 (`az group show`)
- [ ] 0-2. 현재 사용자 RBAC 권한 확인 (Owner 또는 동급)
- [ ] 0-3. AI Foundry 리소스 + **모델 카탈로그 조회** (가이드 모델명 검증)
- [ ] 0-4. 기 배포된 모델 확인
- [ ] 0-5. 학생 계정 샘플(01/25/50) 활성 확인
- [ ] 0-6. 테넌트 ID + 관리자 계정 확인

### Phase 1 — 예산 및 비용 통제
- [ ] 1-1. Cost Management 예산 $800 생성 (RG 범위, Monthly)
- [ ] 1-2. 알림 3단계 (50%/$400, 80%/$640, 95%/$760) → admin@eldensoluton.kr
- [ ] 1-3. 모델별 예산 배분 계획 문서화

### Phase 2 — AI Foundry 모델 배포
- [ ] 2-0. **모델 카탈로그 재확인** (Phase 0-3 결과 기반으로 모델명 최종 확정)
- [ ] 2-1. 모델 A 배포 (고품질, TPM 50K)
- [ ] 2-2. 모델 B 배포 (범용, TPM 100K)
- [ ] 2-3. DeepSeek-V4-Flash × 2 서버리스 배포 (Marketplace 약관 — 수동)
- [ ] 2-4. Playground에서 3개 모델 응답 테스트

### Phase 3 — Entra ID + RBAC
- [ ] 3-1. 학생 계정 확인 (이미 존재함, 50명 전체 검증)
- [ ] 3-2. 보안그룹 `AI-Class-Students-Eduelden` 생성
- [ ] 3-3. 학생 50명을 그룹에 일괄 추가
- [ ] 3-4. Cognitive Services User 역할을 그룹에 할당
- [ ] 3-5. Graph API 앱 `eduelden-github-actions-mailer` 등록
- [ ] 3-6. Mail.Send 권한 추가 + **관리자 동의 클릭(Portal 수동)**

### Phase 4 — APIM 설정
- [ ] 4-1. APIM 인스턴스 `apim-eduelden-ai` 배포 (Developer SKU, ~$50/월)
- [ ] 4-2. OpenAI Proxy API 등록 + 정책 (Rate Limit, Quota, api-key 주입)
- [ ] 4-3. DeepSeek API 등록 + 라운드로빈 정책
- [ ] 4-4. 학생 구독 50개 생성 (`sub-student-01` ~ `sub-student-50`)
- [ ] 4-5. 학생 키 CSV 내보내기 (안전한 위치, 평문 chat 출력 금지)
- [ ] 4-6. 엔드투엔드 테스트 (1명 키로 3개 모델 호출)

### Phase 5 — GitHub Actions 온보딩
- [ ] 5-1. Private repo `asomi7007/eduelden-ai-deploy` 생성
- [ ] 5-2. 배포 스크립트 4종 작성 (`01_deploy_foundry.sh`, `02_manage_keys.sh`, `setup-student.ps1`, `cost-monitor.sh`)
- [ ] 5-3. GitHub Actions 워크플로우 3종 작성 (student-onboarding.yml, key-management.yml, cost-monitor.yml)
- [ ] 5-4. Issue 템플릿 작성 (`student-onboarding.yml`)
- [ ] 5-5. 시크릿 6개 등록 (AZURE_CREDENTIALS, GRAPH_*, SENDER_EMAIL 등)
- [ ] 5-6. 라벨 5개 생성
- [ ] 5-7. 테스트 계정 1명 온보딩 → 이메일 수신 확인

### Phase 6 — 학생 PC 설정 스크립트
- [ ] 6-1. `setup-student.ps1` 완성 (VS Code/Cline 설치, API 설정, 연결 테스트)
- [ ] 6-2. PowerShell 실행 정책 안내 포함
- [ ] 6-3. 수동 설정 대체 가이드 문서

### Phase 7 — 실습 스타터 프로젝트
- [ ] 7-1. `ai-class-starter` repo 준비 (FastAPI 샘플 + 일부러 넣은 버그 + 빈 폴더 옵션)
- [ ] 7-2. README — 4단계 실습 가이드 (분석/버그수정/기능추가/풀앱생성)

### Phase 8 — 모니터링 및 정리
- [ ] 8-1. cost-monitor.yml 매일 09:00 KST 실행
- [ ] 8-2. 학생별 APIM 사용량 조회 스크립트
- [ ] 8-3. 키 일괄 비활성화·재발급 스크립트
- [ ] 8-4. 수업 후 리소스 정리 절차서

### 최종 검증
- [ ] V-1. 테스트 학생 1명 풀 동선 (Issue 신청 → 이메일 → Cline 연결 → 3개 모델 호출)
- [ ] V-2. APIM Rate Limit 동작 확인 (10/분 초과 시 429)
- [ ] V-3. 비용 알림 50% 트리거 시뮬레이션
- [ ] V-4. 키 비활성화 동작 확인

## 시크릿 관리 원칙 (중요)

다음 값들은 **절대로 chat에 평문 출력하지 마세요**:
- `AZURE_CREDENTIALS` (서비스 주체 JSON)
- `GRAPH_CLIENT_SECRET`
- APIM 학생 구독 키 50개
- API Key 1차/2차 키

대신:
- `/tmp/eduelden-secrets/` (Cloud Shell) 또는 로컬 폴더에 파일로 저장
- GitHub Secrets 등록은 `gh secret set NAME --body "$VALUE"` 로 변수 참조
- 사용자에게 보여줄 때는 마지막 4자리만 마스킹해서 확인

## 위험 작업 체크리스트 — 실행 전 사용자 확인 필수

| 작업 | 비용 영향 | 되돌리기 |
|---|---|---|
| APIM 배포 | ~$50/월 시작 | RG 삭제 가능 |
| 모델 배포 | 사용량 과금 | 배포 삭제 가능 |
| 학생 계정 50개 생성 | 라이선스 영향 | 일괄 삭제 가능 |
| RBAC 역할 부여 | 없음 | 회수 가능 |
| GitHub repo 생성 | 없음 | 삭제 가능 |
| Graph 앱 관리자 동의 | 보안 영향 | 동의 철회 가능 |

이 작업 들어가기 직전엔 항상 사용자에게 "지금 X를 실행할게요. 진행할까요?" 확인하세요.

## 참고 — 가이드 문서 원본

사용자 PC에 업로드된 원본:
`Azure_AI_Foundry_바이브코딩_가이드_1차시_2026-5-19-.docx`

가이드의 핵심 모순(가이드 vs 실제):
- 리소스명 불일치 (위 표 참고)
- 모델명이 미래 모델(`gpt-5.5`)로 적혀있어 실제 카탈로그 재확인 필요

## 다음 즉시 액션 (Claude Code 처음 켰을 때)

1. `claude mcp list` 로 Azure/GitHub MCP 연결 상태 확인
2. 안 돼있으면 `setup-claude-code.ps1` 실행해서 MCP 추가
3. `az account show` 로 로그인 상태 확인
4. Phase 0 명령어 묶음 실행 (CLAUDE.md 또는 이 문서의 Phase 0 항목)
5. 결과 사용자와 함께 검증 → Phase 1 진행

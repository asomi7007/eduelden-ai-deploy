---
name: doc-review
description: "문서 품질 점검 하네스. docs/ 폴더의 PRD, INSTALL, USER-GUIDE, README 문서들을 교차 검증하고, 코드와 비교하고, 영한 번역 일치를 확인하고, 빠진 내용을 찾는다. '문서 점검', '문서 검토', '문서 검증', 'doc review', '문서 품질' 등의 키워드가 나오면 이 스킬을 사용할 것."
---

# 문서 품질 점검 오케스트레이터

4명의 전문 검증 에이전트를 팬아웃/팬인 패턴으로 실행하여 문서 품질을 종합 점검한다.

## 실행 모드

에이전트 팀 (fan-out/fan-in). 리더가 4명의 검증 에이전트에게 동시에 작업을 할당하고, 결과를 종합한다.

## 팀 구성

| 역할 | 에이전트 정의 | subagent_type | 산출물 |
|------|-------------|---------------|--------|
| 리더 | `doc-review-leader.md` | general-purpose | `_workspace/05_final_review_report.md` |
| 코드-문서 검증 | `code-doc-verifier.md` | general-purpose | `_workspace/01_code_doc_findings.md` |
| 문서 간 교차 검증 | `cross-doc-verifier.md` | general-purpose | `_workspace/02_cross_doc_findings.md` |
| 영한 번역 검증 | `translation-verifier.md` | general-purpose | `_workspace/03_translation_findings.md` |
| 보충 제안 | `gap-finder.md` | general-purpose | `_workspace/04_gap_suggestions.md` |

## 실행 절차

### Step 1: 준비
```
mkdir -p _workspace
```

### Step 2: 4개 검증 에이전트를 병렬 실행 (fan-out)

각 에이전트를 `Agent` 도구로 스폰한다. 모두 `model: "opus"`, `run_in_background: true`로 실행.

**에이전트 1 — code-doc-verifier**:
```
프롬프트: .claude/agents/code-doc-verifier.md의 역할에 따라 작업을 수행하라.
검증 대상 문서: docs/PRD.md, docs/INSTALL.md, docs/USER-GUIDE.md, README.md
검증 대상 코드: api/src/functions/*.js, .github/workflows/*.yml, scripts/setup-student.ps1, docs/staticwebapp.config.json
결과를 _workspace/01_code_doc_findings.md에 저장하라.
```

**에이전트 2 — cross-doc-verifier**:
```
프롬프트: .claude/agents/cross-doc-verifier.md의 역할에 따라 작업을 수행하라.
검증 대상: docs/PRD.md, docs/INSTALL.md, docs/USER-GUIDE.md, README.md
PRD가 정의 기준이다. 나머지 문서가 PRD와 일치하는지 확인하라.
결과를 _workspace/02_cross_doc_findings.md에 저장하라.
```

**에이전트 3 — translation-verifier**:
```
프롬프트: .claude/agents/translation-verifier.md의 역할에 따라 작업을 수행하라.
검증 대상: 
  - docs/PRD.md ↔ docs/PRD.ko.md
  - docs/INSTALL.md ↔ docs/INSTALL.ko.md
  - docs/USER-GUIDE.md ↔ docs/USER-GUIDE.ko.md
  - README.md (루트, 한국어) ↔ 영문판 존재 여부
결과를 _workspace/03_translation_findings.md에 저장하라.
```

**에이전트 4 — gap-finder**:
```
프롬프트: .claude/agents/gap-finder.md의 역할에 따라 작업을 수행하라.
문서: docs/PRD.md, docs/INSTALL.md, docs/USER-GUIDE.md, README.md
코드: api/src/functions/*.js, .github/workflows/*.yml, scripts/setup-student.ps1
문서에 빠진 중요 정보, 추가 트러블슈팅 시나리오, 보충이 필요한 설명을 찾아라.
결과를 _workspace/04_gap_suggestions.md에 저장하라.
```

### Step 3: 결과 종합 (fan-in)

4개 에이전트가 모두 완료되면:
1. `_workspace/01~04` 파일을 모두 읽는다
2. 중복 제거, 우선순위 분류 (Critical/Important/Nice-to-have)
3. `_workspace/05_final_review_report.md`에 최종 보고서 작성
4. 사용자에게 요약 보고

### Step 4: 수정 반영 (사용자 승인 후)

최종 보고서의 Critical/Important 항목에 대해:
1. 사용자에게 수정 목록을 보여주고 승인 요청
2. 승인받은 항목만 실제 문서에 반영
3. 한국어판도 동시에 수정

## 데이터 흐름

```
[code-doc-verifier]  → _workspace/01_code_doc_findings.md ──┐
[cross-doc-verifier] → _workspace/02_cross_doc_findings.md ──┤
[translation-verifier] → _workspace/03_translation_findings.md ──┤── [리더] → _workspace/05_final_review_report.md
[gap-finder]         → _workspace/04_gap_suggestions.md ──┘
```

## 에러 핸들링

- 에이전트가 실패하면: 해당 에이전트의 결과를 "검증 불가"로 표시하고, 나머지 결과로 보고서 작성
- 파일을 읽을 수 없으면: 해당 파일을 "미존재"로 표시
- 상충 발견 시: 삭제하지 않고 양쪽 값을 병기하여 사용자가 판단

## 테스트 시나리오

### 정상 흐름
1. 4개 에이전트 모두 성공적으로 결과 생성
2. 리더가 결과를 종합하여 보고서 작성
3. 사용자 승인 후 수정 반영

### 에러 흐름
1. 한국어판 파일이 없는 경우 → translation-verifier가 "미존재" 보고 → 리더가 "번역 필요" 항목으로 분류
2. 코드 파일을 읽을 수 없는 경우 → code-doc-verifier가 "검증 불가" 보고 → 리더가 해당 항목 제외하고 보고서 작성

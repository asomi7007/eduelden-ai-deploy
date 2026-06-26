# 06. Copilot CLI에서 repository instructions 만들기

원본 LAB502의 06장은 VS Code Copilot Chat에서 `/create-instructions`를 실행해 `.github/copilot-instructions.md`를 만드는 흐름입니다. Copilot CLI에서는 같은 목적을 `copilot init` 또는 대화형 `/init`으로 수행합니다.

Instructions는 Copilot이 매번 알아야 하는 프로젝트의 기본 규칙입니다. 단발성 프롬프트와 달리, 저장소에 남아 모든 이후 세션의 기본 맥락으로 쓰입니다.

## Instructions가 필요한 이유

Copilot은 코드에서 많은 것을 추론하지만, 다음 정보는 코드만 보고 정확히 알기 어렵습니다.

- 프로젝트 목적과 주요 사용자
- 반드시 지켜야 하는 아키텍처 제약
- 빌드, 실행, 테스트 명령
- 선호하는 라이브러리와 피해야 할 라이브러리
- 파일 구조와 네이밍 규칙
- 도메인 용어
- 수정하면 안 되는 파일이나 배포상 위험한 작업

좋은 instructions는 일반론이 아니라 **이 저장소에만 해당하는 구체적인 규칙**을 담습니다.

## CLI 기준 instruction 파일

| 파일 | 용도 |
|---|---|
| `AGENTS.md` | Codex/Copilot 같은 agent가 프로젝트 시작 시 읽는 작업 규칙 |
| `.github/copilot-instructions.md` | GitHub Copilot이 저장소 단위로 읽는 기본 instruction |
| `.github/instructions/*.instructions.md` | 특정 경로나 언어에만 적용할 세부 instruction |
| 개인 instruction 파일 | 사용자 계정 전체에 적용할 개인 규칙 |

이 저장소에는 이미 `AGENTS.md`가 있습니다. Copilot CLI 실습에서는 `.github/copilot-instructions.md`도 만들어 GitHub Copilot 표준 위치를 같이 사용합니다.

## 실습: `copilot init`으로 instructions 생성

작업 폴더 루트에서 실행합니다.

```powershell
copilot init
```

또는 대화형 세션 안에서 실행합니다.

```powershell
copilot
```

```text
/init
```

`copilot init`은 저장소를 읽고 `.github/copilot-instructions.md` 초안을 생성합니다. 생성 후 반드시 직접 열어 실제 수업/실습 환경에 맞게 고칩니다.

## 예제: 단일 HTML 게임 프로젝트용 보강 프롬프트

원본 LAB502 예제는 Space Invaders 게임을 단일 HTML 파일로 유지하는 제약을 instructions에 넣습니다. CLI에서는 다음처럼 Copilot에게 보강을 요청할 수 있습니다.

```text
@.github/copilot-instructions.md 파일을 업데이트해줘.

이 프로젝트는 Space Invaders 스타일의 실습용 HTML 게임이다.
반드시 하나의 self-contained HTML 파일로 유지해야 한다.
HTML, CSS, JavaScript는 모두 같은 .html 파일 안에 있어야 한다.
빌드 단계, npm 패키지, CDN, 외부 폰트, 외부 이미지 의존성을 추가하지 마라.
실행 방법은 브라우저에서 HTML 파일을 여는 것이다.
```

비대화형으로 실행해야 한다면 다음처럼 쓸 수 있지만, 교육 실습에서는 대화형 세션에서 diff를 보고 승인하는 편이 안전합니다.

```powershell
copilot -i "@.github/copilot-instructions.md 파일을 위 규칙으로 보강해줘."
```

## 검토 체크리스트

생성된 `.github/copilot-instructions.md`가 다음을 포함하는지 확인합니다.

- 프로젝트가 무엇을 만드는지 한 문단으로 설명
- 핵심 제약: 예를 들어 단일 HTML 파일, 외부 의존성 금지
- 실행 방법: 브라우저로 열기, 또는 실제 프로젝트의 실행 명령
- 테스트/검증 방법: 수동 확인, lint, unit test 등
- 스타일 규칙: UI 톤, 네이밍, 파일 배치
- 하지 말아야 할 일: 프레임워크 도입 금지, 파일 분리 금지 등

부족하면 직접 수정하거나 Copilot에게 다시 요청합니다.

```text
@.github/copilot-instructions.md 를 더 구체적으로 다듬어줘.
특히 "빌드 단계 없음", "CDN 금지", "기존 HTML 파일 안에서만 수정" 규칙을 별도 bullet로 명시해줘.
```

## 적용 여부 확인

새 세션을 시작합니다.

```powershell
copilot
```

대화형 세션에서 이전 맥락을 줄이고 싶으면 다음을 입력합니다.

```text
/new
```

간단한 변경을 요청합니다.

```text
@index.html 게임 하단에 "Made at Microsoft Build 2026" 푸터를 작게 추가해줘.
단일 HTML 파일 제약을 지켜줘.
```

변경 결과를 확인합니다.

```text
/diff
```

정상 결과는 다음과 같습니다.

- 기존 `index.html`만 수정됨
- 새 npm 프로젝트나 빌드 설정이 생기지 않음
- 외부 CDN, 이미지, 폰트가 추가되지 않음

만약 Copilot이 새 파일을 만들거나 외부 의존성을 추가하려 한다면 instructions를 더 명확하게 고칩니다.

## 이 저장소용 예시 instruction 문장

아래 문장은 Azure AI Foundry 수업 플랫폼 저장소에 맞는 예시입니다.

```markdown
## Project rules

- 이 저장소는 Azure AI Foundry 기반 50명 실습 환경을 배포/운영하기 위한 코드와 문서다.
- 한국어 사용자 문서와 운영 안내는 한국어로 작성한다.
- 비용이 발생하거나 권한을 바꾸는 Azure 명령은 실행 전에 사용자에게 명령을 보여주고 확인을 받는다.
- 비밀값, API 키, 클라이언트 시크릿은 채팅에 평문으로 출력하지 않는다.
- 학생용 스크립트는 Windows PowerShell 실행을 우선 지원하고, Cloud Shell Bash 호환 여부를 별도로 표시한다.
- 기존 사용자 변경사항을 되돌리지 않는다.
```

## 원본에서 CLI로 바꾼 부분

| 원본 | CLI 변환 |
|---|---|
| VS Code에서 `/create-instructions` 실행 | `copilot init` 또는 `/init` |
| VS Code diff 화면에서 Keep 클릭 | CLI의 변경 diff 확인 후 승인 또는 `/diff` 확인 |
| `#index.html`로 파일 첨부 | `@index.html` 또는 파일 경로를 명확히 언급 |
| 새 Copilot Chat 세션 | `copilot`, `/new`, `copilot --continue`, `copilot --resume` |

[이전: 커스터마이징 둘러보기](05-exploring-copilot-customizations.ko.md) | [다음: skill 작성](07-creating-a-skill.ko.md)

## 참고

- 원본 LAB502 06: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/06-creating-instructions.md>
- Repository custom instructions: <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions>
- Copilot CLI: <https://docs.github.com/copilot/how-tos/copilot-cli>

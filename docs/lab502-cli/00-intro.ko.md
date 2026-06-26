# 00. LAB502 Copilot CLI 실습 소개

이 문서는 Microsoft Build 2026 LAB502 원본의 `00-intro.md`를 **GitHub Copilot CLI 중심**으로 다시 정리한 한국어 버전입니다. 원본은 CLI와 VS Code를 함께 다루지만, 우리 실습은 터미널에서 Copilot CLI를 사용하는 흐름을 기준으로 진행합니다.

## 실습 목표

이 실습에서는 빈 작업 폴더에서 시작해 Copilot CLI로 Space Invaders 스타일의 HTML 게임을 만들고, 플러그인으로 스크린샷을 공유한 뒤, Copilot을 프로젝트에 맞게 커스터마이징하는 방법까지 다룹니다.

배우는 내용은 다음입니다.

- Copilot CLI에 로그인하고 대화형 세션을 사용하는 방법
- plan mode로 작업을 먼저 설계한 뒤 구현하는 방법
- plugin이 skills, agents, hooks, MCP 서버 설정을 묶어 배포하는 방식
- instructions, skills, custom agents, MCP servers, hooks, plugins를 상황에 맞게 선택하는 기준
- 반복 업무를 자연어 요청과 `SKILL.md` 기반 workflow로 바꾸는 방법

## 전체 흐름

| 번호 | 문서 | 목표 |
|---|---|---|
| 00 | [소개](00-intro.ko.md) | 실습 전체 흐름과 커스터마이징 개념 파악 |
| 01 | [환경 설정](01-setting-up-the-environment.ko.md) | 작업 폴더 생성, Git 초기화, Copilot CLI 로그인 |
| 02 | [커뮤니티 plugin 설치](02-installing-the-community-plugin.ko.md) | marketplace 등록, plugin 설치, 설치 결과 확인 |
| 03 | [게임 생성](03-generating-the-space-invaders-game.ko.md) | plan mode로 단일 HTML 게임 생성 |
| 04 | [스크린샷 공유](04-screenshot-sharing.ko.md) | custom agent와 skill로 스크린샷 캡처/업로드 |
| 05 | [커스터마이징 둘러보기](05-exploring-copilot-customizations.ko.md) | CLI에서 instructions, skills, MCP, plugins 확인 |
| 06 | [instructions 작성](06-creating-instructions.ko.md) | `copilot init`으로 repository instructions 생성 |
| 07 | [skill 작성](07-creating-a-skill.ko.md) | `.github/skills/<name>/SKILL.md`와 helper scripts 작성 |
| 08 | [정리](08-recap.ko.md) | 어떤 커스터마이징을 언제 쓸지 결정 기준 정리 |

## 원본과 다른 점

원본은 중간에 Visual Studio Code의 Agent Customizations 화면을 사용합니다. 우리 문서에서는 같은 내용을 다음 CLI 흐름으로 바꿉니다.

| 원본 개념 | 우리 CLI 대응 |
|---|---|
| VS Code Copilot Chat | `copilot` 대화형 세션 |
| Agent Customizations 화면 | `/env`, `/instructions`, `/skills`, `/mcp`, `/plugin` |
| `/create-instructions` | `copilot init` 또는 `/init` |
| `/create-skill` wizard | `.github/skills/<name>/SKILL.md` 생성 요청 |
| `#index.html` 파일 첨부 | `@index.html` 파일 컨텍스트 |
| UI diff Keep | `/diff`와 CLI 승인 흐름 |

## 유의사항

LLM 응답은 매번 완전히 같지 않습니다. 실습 문서의 결과와 Copilot이 실제 생성하는 파일명, UI 문구, 코드 구조가 조금 다를 수 있습니다. 중요한 것은 결과물이 아래 기준을 만족하는지 확인하는 것입니다.

- 게임은 단일 self-contained HTML 파일이어야 합니다.
- 외부 CDN, npm 패키지, 빌드 단계 없이 브라우저에서 바로 열 수 있어야 합니다.
- plugin 설치 후 `/plugin list`, skill 추가 후 `/skills`와 `/skills info`로 확인해야 합니다.
- 자동화된 작업은 하네스로 검증해야 합니다.

## 다음 단계

다음 문서에서 작업 폴더를 만들고 Copilot CLI에 로그인합니다.

[다음: 환경 설정](01-setting-up-the-environment.ko.md)

## 참고

- 원본 LAB502 00: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/00-intro.md>
- GitHub Copilot 문서: <https://docs.github.com/en/copilot>
- GitHub Copilot CLI: <https://docs.github.com/copilot/how-tos/copilot-cli>
- Agents, Skills, Instructions: <https://awesome-copilot.github.com/learning-hub/what-are-agents-skills-instructions/>

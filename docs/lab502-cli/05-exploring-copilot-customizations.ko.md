# 05. Copilot CLI 커스터마이징 둘러보기

원본 LAB502의 05장은 Visual Studio Code의 **Agent Customizations** 화면을 열어 커스터마이징 종류를 둘러보는 흐름입니다. 우리 실습은 **GitHub Copilot CLI**를 기준으로 하므로, 같은 내용을 터미널에서 확인하는 방식으로 바꿉니다.

핵심은 UI 위치가 아니라 Copilot이 읽는 **구성 파일과 확장 포인트**입니다. CLI에서도 instructions, skills, MCP servers, plugins, agents, hooks 같은 커스터마이징 개념은 그대로 쓰되, 확인과 실행은 `copilot` 명령과 대화형 슬래시 명령으로 진행합니다.

## 원본 VS Code 단계와 CLI 대응

| 원본 VS Code 흐름 | Copilot CLI 흐름 |
|---|---|
| Copilot Chat 열기 | 터미널에서 `copilot` 실행 |
| Agent Customizations 화면 열기 | `/env`, `/instructions`, `/skills`, `/mcp`, `/plugin` 확인 |
| Skills 목록 클릭 | `/skills`로 사용 가능한 skill 확인 |
| MCP Servers 탭 확인 | `copilot mcp list` 또는 대화형 `/mcp` |
| Plugins 탭 확인 | `copilot plugin list` 또는 대화형 `/plugin` |
| 기존 대화 세션 선택 | `copilot --continue`, `copilot --resume`, 대화형 `/resume` |
| 원격 세션 제어 | `copilot --remote` 또는 대화형 `/remote` |

## 커스터마이징 구성요소

Copilot 커스터마이징은 여러 작은 구성요소를 조합하는 방식입니다.

| 구성요소 | CLI에서의 의미 | 주로 쓰는 위치 |
|---|---|---|
| Custom instructions | 모든 세션에 들어가는 프로젝트 규칙과 배경지식 | `AGENTS.md`, `.github/copilot-instructions.md` |
| File-based instructions | 특정 파일/경로에만 적용되는 세부 규칙 | `.github/instructions/*.instructions.md` 등 |
| Skills | 반복 업무를 `SKILL.md`와 스크립트/템플릿으로 묶은 작업 단위 | `.github/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md` |
| Custom agents | 특정 역할, 도구, 모델 정책을 가진 전문 에이전트 | repo 또는 개인 agent 설정 |
| MCP servers | 외부 도구/API/데이터를 Copilot 도구로 노출 | `.mcp.json`, `.github/mcp.json`, `~/.copilot/mcp-config.json` |
| Hooks | 세션/도구 실행 전후에 자동 실행되는 결정적 명령 | CLI hook 설정 |
| Plugins | skills, agents, hooks, MCP 등을 묶어 배포하는 패키지 | `copilot plugin install ...` |
| Prompt files | VS Code에서는 slash command로 쓰는 재사용 프롬프트 | CLI에서는 보통 skill 또는 Markdown 프롬프트 문서로 대체 |

> CLI 기준으로 새 반복 업무를 만들 때는 prompt file보다 **skill**을 우선 검토하세요. Skill은 설명(`description`)으로 자동 매칭되고, 스크립트와 템플릿을 함께 넣을 수 있어 CLI 흐름에 더 잘 맞습니다.

## 실습: 현재 CLI 환경 확인

작업 폴더에서 Copilot CLI를 실행합니다.

```powershell
copilot
```

대화형 화면에서 다음 명령을 차례로 입력합니다.

```text
/env
/instructions
/skills
/mcp
/plugin
```

확인할 포인트는 다음과 같습니다.

- `/env`: 현재 작업 폴더, 로드된 instructions, skills, MCP, plugins 개요
- `/instructions`: 어떤 instruction 파일이 적용되는지
- `/skills`: 현재 사용할 수 있는 skills
- `/mcp`: 연결된 MCP 서버와 상태
- `/plugin`: 설치된 plugin과 marketplace

터미널 명령으로도 MCP와 plugin 상태를 확인할 수 있습니다.

```powershell
copilot mcp list
copilot plugin list
```

## 세션 이어가기

원본 05장에는 VS Code의 세션 목록에서 CLI 세션을 볼 수 있다는 설명이 있습니다. CLI 실습에서는 반대로 터미널에서 세션을 이어가는 방식이 중요합니다.

가장 최근 세션을 이어갑니다.

```powershell
copilot --continue
```

세션 목록에서 골라 이어갑니다.

```powershell
copilot --resume
```

세션 ID나 이름을 알고 있으면 직접 지정합니다.

```powershell
copilot --resume=<session-id>
copilot --resume="invaders"
```

GitHub 웹이나 모바일에서 실행 중인 CLI 세션을 제어해야 할 때는 원격 제어를 켭니다.

```powershell
copilot --remote
```

대화형 세션 중에는 다음처럼 토글할 수 있습니다.

```text
/remote
```

## Built-in skill 읽어보기

VS Code 원본에서는 Agent Customizations 화면에서 built-in skill을 클릭해 `SKILL.md`를 읽습니다. CLI에서는 사용 가능한 skill을 먼저 확인하고, 실제 프로젝트 skill을 열어 보는 방식이 더 자연스럽습니다.

```text
/skills
```

특정 skill의 세부 정보를 보려면 다음 형태를 사용합니다.

```text
/skills info <skill-name>
```

새 skill 파일을 추가한 뒤 목록에 바로 보이지 않으면 다시 로드합니다.

```text
/skills reload
```

Skill의 구조는 단순합니다.

```text
some-skill/
  SKILL.md
  scripts/
  references/
  assets/
```

`SKILL.md`는 보통 아래 형태입니다.

```markdown
---
name: invaders-gallery-upload
description: Submit a generated Space Invaders HTML game to the Invaders Gallery.
---

사용자가 게임 업로드를 요청하면 다음 순서로 진행한다.

1. 표시 이름과 HTML 파일명을 확인한다.
2. 파일이 존재하고 200KB 이하인지 확인한다.
3. scripts/upload-game.ps1 또는 scripts/upload-game.sh를 실행한다.
4. 업로드 결과 URL을 사용자에게 알려준다.
```

중요한 부분은 `description`입니다. Copilot은 사용자의 요청과 skill의 설명을 비교해 해당 skill을 쓸지 판단합니다. 설명이 너무 짧거나 모호하면 자동으로 선택되지 않을 수 있습니다.

## 빠진 내용 보강 포인트

원본 05장에서 우리 CLI 문서로 가져올 때 빠지기 쉬운 내용은 다음입니다.

- 커스터마이징은 instructions 하나가 아니라 skills, agents, MCP, hooks, plugins까지 포함하는 전체 체계입니다.
- CLI에서도 세션은 이어서 사용할 수 있습니다. `--continue`, `--resume`, `/resume`을 안내해야 합니다.
- VS Code의 `#index.html` 첨부 흐름은 CLI에서는 `@index.html`처럼 파일 경로를 명시하거나 현재 작업 폴더의 파일명을 정확히 말하는 방식으로 바꿔야 합니다.
- prompt file은 VS Code slash command 경험에 가깝습니다. CLI 실습에서는 반복 업무를 skill로 만드는 편이 더 일관됩니다.
- `gh skill`은 일부 문서에 등장하지만 로컬 `gh` 버전에 따라 없을 수 있습니다. 이 실습에서는 Copilot CLI의 `/skills`와 repo skill 폴더를 기준으로 설명합니다.

## 다음 단계

다음 장에서는 원본 06장의 `/create-instructions` 흐름을 CLI에 맞게 바꿉니다. Copilot CLI에서는 `copilot init` 또는 대화형 `/init`으로 `.github/copilot-instructions.md`를 만들고, 필요한 규칙을 직접 보강합니다.

[이전: 스크린샷 공유](04-screenshot-sharing.ko.md) | [다음: instructions 작성](06-creating-instructions.ko.md)

## 참고

- 원본 LAB502 05: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/05-exploring-copilot-customizations.md>
- GitHub Copilot CLI 문서: <https://docs.github.com/copilot/how-tos/copilot-cli>
- Copilot CLI skill 추가: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills>
- Copilot CLI plugin 문서: <https://docs.github.com/copilot/concepts/agents/copilot-cli/about-cli-plugins>

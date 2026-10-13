# 08. Copilot CLI 커스터마이징 정리

이 장은 원본 LAB502의 recap을 Copilot CLI 기준으로 다시 정리한 것입니다. 원본의 핵심은 Space Invaders 게임을 만든 뒤, instructions와 skill을 통해 Copilot을 프로젝트에 맞게 길들이는 것입니다.

우리 CLI 버전에서의 목표는 다음입니다.

- Copilot CLI 세션을 시작하고 이어갈 수 있다.
- 저장소 instructions를 만들어 매 세션에 프로젝트 규칙을 적용한다.
- skill로 반복 업무를 패키징한다.
- MCP와 plugins가 어디서 연결되는지 이해한다.
- 어떤 상황에 어떤 커스터마이징을 써야 하는지 판단한다.

## 실습에서 한 일

| 단계 | CLI 기준 결과 |
|---|---|
| 환경 확인 | `copilot`, `/env`, `/instructions`, `/skills`, `/mcp`, `/plugin` 사용 |
| 세션 관리 | `copilot --continue`, `copilot --resume`, `/new`, `/resume` 사용 |
| Instructions 생성 | `copilot init` 또는 `/init`으로 `.github/copilot-instructions.md` 생성 |
| Instructions 검증 | 새 세션에서 작은 변경을 요청하고 `/diff`로 확인 |
| Skill 생성 | `.github/skills/<name>/SKILL.md`와 helper scripts 작성 |
| Skill 테스트 | 자연어 요청과 `@파일경로` 컨텍스트로 실행 |
| MCP 확인 | `copilot mcp list`, `/mcp` |
| Plugin 확인 | `copilot plugin list`, `/plugin` |

## 커스터마이징 유형 빠른 참조

| 유형 | 언제 활성화되는가 | CLI에서 어떻게 쓰는가 | 적합한 용도 |
|---|---|---|---|
| Custom instructions | 세션 시작 시 자동 로드 | `AGENTS.md`, `.github/copilot-instructions.md`, `/instructions` | 저장소 전체 규칙, 아키텍처, 금지사항 |
| File-based instructions | 관련 파일/경로가 맥락에 있을 때 | `.instructions.md` + `applyTo` | 언어별/폴더별 규칙 |
| Prompt 문서 | 사용자가 명시적으로 붙여 넣거나 파일로 참조 | `@docs/prompts/foo.md` 또는 직접 입력 | 간단한 반복 프롬프트 |
| Skills | 사용자 의도가 `description`과 맞을 때 | `.github/skills/<name>/SKILL.md`, `/skills` | 여러 단계, 스크립트, 템플릿이 필요한 업무 |
| Tools | Copilot이 작업 수행에 필요하다고 판단할 때 | shell, edit, read, MCP tool 등 | 검색, 파일 수정, 명령 실행 |
| MCP servers | 설정되어 있고 도구가 필요할 때 | `copilot mcp add/list/get`, `.mcp.json` | 외부 API, DB, 브라우저, 사내 시스템 연결 |
| Custom agents | 사용자가 선택하거나 agent가 위임할 때 | `--agent`, `/agent` | 특정 역할/도구 제한이 필요한 세션 |
| Hooks | lifecycle event 발생 시 자동 실행 | hook 설정 | 포맷팅, lint, 보안 차단, 텔레메트리 |
| Plugins | 설치 후 구성요소별 규칙에 따라 활성화 | `copilot plugin install/list` | skills, agents, MCP, hooks 묶음 배포 |

## 어떤 것을 선택할까

| 상황 | 선택 |
|---|---|
| Copilot이 항상 알아야 하는 프로젝트 규칙이 있다 | Custom instructions |
| 특정 폴더나 언어에만 적용되는 규칙이 있다 | File-based instructions |
| 단순한 명령 템플릿을 반복해서 쓰고 싶다 | Prompt 문서 또는 skill |
| 사용자가 자연어로 말하면 알아서 실행할 반복 업무가 있다 | Skill |
| 파일 크기 확인, API 호출처럼 정확해야 하는 절차가 있다 | Skill + helper script |
| 외부 시스템의 최신 데이터를 읽거나 조작해야 한다 | MCP server |
| 특정 업무에만 제한된 도구와 역할을 주고 싶다 | Custom agent |
| 모델이 잊으면 안 되는 자동 검증이 있다 | Hook |
| 팀에 묶음 형태로 배포하고 싶다 | Plugin |

## CLI에서 기억할 명령

```powershell
# 대화형 세션 시작
copilot

# 최근 세션 이어가기
copilot --continue

# 세션 선택해서 이어가기
copilot --resume

# 저장소 instructions 생성
copilot init

# MCP 확인
copilot mcp list

# plugin 확인
copilot plugin list

# 원격 제어 허용
copilot --remote
```

대화형 세션 안에서 자주 쓰는 명령입니다.

```text
/env
/instructions
/skills
/skills reload
/skills info <skill-name>
/mcp
/plugin
/diff
/new
/resume
/remote
/help
```

## 원본 00~08에서 빠지면 안 되는 핵심

다음 항목은 단순 번역 과정에서 빠지기 쉽지만 CLI 실습에도 꼭 필요합니다.

1. 모든 문서 번호와 slug는 원본과 같아야 하며, 우리 문서는 `.ko.md`만 추가합니다.
2. 환경 설정은 VS Code가 아니라 `copilot`, `/login`, `/env`, `@파일경로` 중심으로 안내합니다.
3. Plugin 설치는 `/plugin marketplace ...`, `/plugin install ...`, `/plugin list`로 검증합니다.
4. 게임 생성은 plan mode와 단일 self-contained HTML 제약을 반드시 포함합니다.
5. 스크린샷 공유는 custom agent, Playwright MCP, `share-screenshot` skill 조합으로 설명합니다.
6. 커스터마이징은 instructions만이 아니라 skills, MCP, hooks, plugins까지 포함하는 체계입니다.
7. Instructions는 새 세션에서도 적용되는 지속 맥락입니다.
8. Skill은 사용자가 이름을 몰라도 `description`으로 자동 선택될 수 있어야 합니다.
9. Skill 내부의 결정적 작업은 스크립트로 빼야 합니다.
10. 파일을 정확히 지정해야 하는 작업은 CLI에서 `@index.html`처럼 파일 경로를 명시합니다.
11. 세션 이어가기와 원격 제어는 CLI 수업에서 특히 중요합니다.
12. VS Code UI 단계는 CLI에서 `/env`, `/skills`, `/mcp`, `/plugin`, `copilot mcp list`, `copilot plugin list`로 치환합니다.
13. Prompt file은 VS Code slash command 중심 기능이므로 CLI에서는 skill 또는 Markdown 프롬프트 문서로 대체하는 것이 안전합니다.

## 다음 확장 주제

시간이 남으면 원본 bonus 주제를 CLI 기준으로 이어갈 수 있습니다.

- Copilot cloud agent: CLI에서 작업을 GitHub로 위임하고 PR을 만들게 하는 흐름
- MCP server: `.mcp.json` 또는 `copilot mcp add`로 외부 도구 연결
- Reusable prompt: CLI에서는 `.github/prompts`에 의존하기보다 `docs/prompts/*.md`와 skill을 함께 검토

[이전: skill 작성](07-creating-a-skill.ko.md)

## 참고

- 원본 LAB502 08: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/08-recap.md>
- Copilot CLI: <https://docs.github.com/copilot/how-tos/copilot-cli>
- Copilot CLI skill 추가: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills>
- Copilot CLI plugins: <https://docs.github.com/copilot/concepts/agents/copilot-cli/about-cli-plugins>
- Repository custom instructions: <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions>

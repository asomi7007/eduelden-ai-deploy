# 02. 커뮤니티 plugin 설치

이 문서는 원본 `02-installing-the-community-plugin.md`를 Copilot CLI 기준으로 정리한 한국어 버전입니다. 목표는 LAB502 커뮤니티 marketplace를 등록하고 `space-invaders-makers` plugin을 설치하는 것입니다.

## Plugin이란

Copilot CLI plugin은 여러 커스터마이징 요소를 하나의 설치 단위로 묶습니다.

- skills
- custom agents
- lifecycle hooks
- MCP server configurations
- scripts
- 기타 통합 파일

plugin을 사용하면 팀이나 수업에서 같은 workflow를 쉽게 배포할 수 있습니다. 단, plugin 안의 script는 로컬 shell 권한으로 실행될 수 있으므로 신뢰할 수 있는 출처인지 확인해야 합니다.

## Marketplace 확인

Copilot CLI 대화형 세션을 시작합니다.

```powershell
copilot
```

등록된 marketplace를 확인합니다.

```text
/plugin marketplace list
```

기본 marketplace 외에 LAB502 실습용 marketplace를 추가합니다.

```text
/plugin marketplace add microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows
```

추가한 marketplace에서 plugin 목록을 확인합니다.

```text
/plugin marketplace browse community-hub
```

## Plugin 설치

`space-invaders-makers` plugin을 설치합니다.

```text
/plugin install space-invaders-makers@community-hub
```

설치 결과를 확인합니다.

```text
/plugin list
```

정상 기준은 `space-invaders-makers@community-hub`가 설치 목록에 보이는 것입니다.

## 설치 후 확인할 것

plugin이 설치되면 뒤 실습에서 사용할 구성요소가 추가됩니다.

| 구성요소 | 역할 |
|---|---|
| `web-screenshotter` custom agent | 로컬 HTML 또는 URL을 브라우저로 열고 스크린샷 캡처 |
| `share-screenshot` skill | 캡처한 이미지를 LAB502 Community Hub에 업로드 |
| Playwright MCP 설정 | 브라우저 자동화 도구 제공 |
| hooks | 세션/프롬프트/도구 사용 이벤트를 telemetry로 전송 |

다음 명령으로 확인합니다.

```text
/agent
/skills
/plugin list
```

새 skill이 바로 보이지 않으면 reload합니다.

```text
/skills reload
```

## 보안 메모

plugin은 편리하지만 실행 권한이 큽니다. 설치 전후에 다음을 확인하세요.

- plugin 출처가 신뢰 가능한지
- `SKILL.md`가 어떤 행동을 지시하는지
- `scripts/`가 어떤 API나 파일에 접근하는지
- hooks가 어떤 이벤트를 어디로 전송하는지

실습용 plugin은 LAB502 Community Hub와 연동하기 위한 목적입니다.

## 다음 단계

다음 문서에서는 plan mode로 단일 HTML Space Invaders 게임을 생성합니다.

[이전: 환경 설정](01-setting-up-the-environment.ko.md) | [다음: 게임 생성](03-generating-the-space-invaders-game.ko.md)

## 참고

- 원본 LAB502 02: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/02-installing-the-community-plugin.md>
- Copilot CLI plugins: <https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins>
- Plugin 설치: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing>
- Awesome Copilot plugins: <https://awesome-copilot.github.com/learning-hub/installing-and-using-plugins/>

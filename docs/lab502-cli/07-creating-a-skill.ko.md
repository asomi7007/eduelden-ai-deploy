# 07. Copilot CLI에서 재사용 가능한 agent skill 만들기

원본 LAB502의 07장은 VS Code에서 `/create-skill`을 실행해 Space Invaders 게임을 갤러리에 업로드하는 skill을 만드는 흐름입니다. Copilot CLI에서는 같은 개념을 **프로젝트 skill 폴더와 `SKILL.md`**로 구현합니다.

Skill은 instructions보다 한 단계 구체적인 커스터마이징입니다. Instructions가 "항상 알아야 할 규칙"이라면, skill은 "특정 의도가 보이면 실행할 절차"입니다.

## Skill의 기본 구조

```text
.github/
  skills/
    invaders-gallery-upload/
      SKILL.md
      scripts/
        upload-game.ps1
        upload-game.sh
      references/
        openapi-summary.md
```

`SKILL.md`는 두 부분으로 구성합니다.

```markdown
---
name: invaders-gallery-upload
description: Submit a generated Space Invaders HTML game to the Invaders Gallery when the user asks to share or upload their game.
---

사용자가 게임 공유, 갤러리 업로드, 제출을 요청하면 이 skill을 사용한다.

필수 입력:
- 표시 이름
- 업로드할 HTML 파일 경로

절차:
1. 파일이 존재하는지 확인한다.
2. 파일 크기가 200KB 이하인지 확인한다.
3. 운영체제에 맞는 helper script를 실행한다.
4. 업로드 결과와 갤러리 URL을 사용자에게 알려준다.
```

## 좋은 skill의 조건

- `description`이 실제 사용자 표현을 포함해야 합니다. 예: "share my game", "upload to gallery", "submit generated HTML game"
- 반복되는 검증은 Markdown에만 쓰지 말고 스크립트로 옮깁니다.
- API endpoint, 파일 크기 제한, 필수 입력은 명확히 적습니다.
- 긴 참고자료는 `references/`, 실행 코드는 `scripts/`, 템플릿은 `assets/`로 분리합니다.
- 사용자에게 매번 slash command를 기억하게 하지 말고, 자연어 요청으로도 skill이 선택되게 작성합니다.

## 실습: CLI에서 skill 생성 요청

CLI 대화형 세션을 시작합니다.

```powershell
copilot
```

다음 프롬프트를 입력합니다.

```text
프로젝트 skill을 만들어줘.

목표:
- 사용자가 Space Invaders HTML 게임을 Invaders Gallery에 업로드해 달라고 요청하면 자동으로 사용할 skill
- skill 위치는 .github/skills/invaders-gallery-upload/
- SKILL.md와 scripts/upload-game.ps1, scripts/upload-game.sh를 포함
- 사용자는 표시 이름과 HTML 파일명을 제공해야 함
- HTML 파일은 200KB 이하여야 함
- 실제 HTTP 업로드는 SKILL.md 안에서 직접 하지 말고 helper script가 수행해야 함
- API 형태는 http://localhost:1345/api/openapi.json 를 참고해 결정

생성 후 어떤 파일을 만들었는지 요약하고, 테스트 방법도 알려줘.
```

생성된 변경은 `/diff`로 확인합니다.

```text
/diff
```

## PowerShell helper script 예시

아래는 skill에 넣을 수 있는 PowerShell 스크립트의 예시입니다. 실제 API 필드명은 OpenAPI spec을 읽고 맞춥니다.

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$true)]
    [string]$DisplayName,

    [string]$BaseUrl = "http://localhost:1345"
)

if (-not (Test-Path -LiteralPath $FilePath)) {
    throw "HTML file not found: $FilePath"
}

$item = Get-Item -LiteralPath $FilePath
if ($item.Length -gt 200KB) {
    throw "HTML file is larger than 200KB: $($item.Length) bytes"
}

$html = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
$body = @{
    displayName = $DisplayName
    html = $html
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/api/gallery/submissions" `
    -ContentType "application/json" `
    -Body $body

$response | ConvertTo-Json -Depth 10
```

## Bash helper script 예시

```bash
#!/usr/bin/env bash
set -euo pipefail

FILE_PATH="${1:?Usage: upload-game.sh <file-path> <display-name> [base-url]}"
DISPLAY_NAME="${2:?Usage: upload-game.sh <file-path> <display-name> [base-url]}"
BASE_URL="${3:-http://localhost:1345}"

if [[ ! -f "$FILE_PATH" ]]; then
  echo "HTML file not found: $FILE_PATH" >&2
  exit 1
fi

SIZE=$(wc -c < "$FILE_PATH")
if [[ "$SIZE" -gt 204800 ]]; then
  echo "HTML file is larger than 200KB: $SIZE bytes" >&2
  exit 1
fi

HTML=$(python -c 'import json, pathlib, sys; print(json.dumps(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")))' "$FILE_PATH")
NAME=$(python -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$DISPLAY_NAME")

curl -sS \
  -X POST "$BASE_URL/api/gallery/submissions" \
  -H "Content-Type: application/json" \
  -d "{\"displayName\":$NAME,\"html\":$HTML}"
```

> 위 endpoint와 JSON 필드는 예시입니다. 실습 서버가 제공하는 `http://localhost:1345/api/openapi.json`를 읽고 실제 endpoint에 맞춰야 합니다.

## Skill 사용 테스트

새 세션을 열어 이전 생성 프롬프트의 맥락을 줄입니다.

```text
/new
```

자연어로 요청합니다.

```text
내 게임을 Invaders Gallery에 업로드해줘.
파일은 @index.html 이고 표시 이름은 "홍길동의 Space Invaders"야.
```

정상 흐름은 다음입니다.

1. Copilot이 skill 설명과 사용자 의도를 매칭합니다.
2. `@index.html` 파일 존재 여부와 크기를 확인합니다.
3. Windows이면 `upload-game.ps1`, Bash 환경이면 `upload-game.sh`를 실행합니다.
4. 성공 응답과 갤러리 확인 URL을 알려줍니다.

만약 skill이 자동으로 선택되지 않으면 `SKILL.md`의 `description`을 넓힙니다.

```markdown
description: Upload, submit, publish, or share a generated Space Invaders HTML game to the Invaders Gallery when the user asks to share their game.
```

## CLI에서 명시적으로 skill을 확인하기

대화형 세션에서 skill 목록을 확인합니다.

```text
/skills
```

새로 만든 skill이 바로 보이지 않으면 reload를 실행합니다.

```text
/skills reload
```

목록에 보이면 상세 정보를 확인합니다.

```text
/skills info invaders-gallery-upload
```

사용 가능한 skill이 목록에 없다면 다음을 확인합니다.

- 폴더가 `.github/skills/<skill-name>/SKILL.md` 형태인지
- `SKILL.md` front matter에 `name`과 `description`이 있는지
- 저장소 루트에서 Copilot CLI를 실행했는지
- `/skills reload`를 실행했는지

## 원본에서 CLI로 바꾼 부분

| 원본 | CLI 변환 |
|---|---|
| VS Code `/create-skill` wizard | Copilot CLI에 skill 파일 생성을 프롬프트로 요청 |
| 파일 선택 `#index.html` | CLI 프롬프트에서 `@index.html` 사용 |
| VS Code diff Keep | `/diff`로 변경 확인 후 승인 |
| 갤러리 확인 | 브라우저에서 `http://localhost:1345/gallery` 열기 |

[이전: instructions 작성](06-creating-instructions.ko.md) | [다음: 정리](08-recap.ko.md)

## 참고

- 원본 LAB502 07: <https://github.com/microsoft/Build26-LAB502-make-github-copilot-work-your-way-custom-tools-context-and-workflows/blob/main/docs/07-creating-a-skill.md>
- Agent skills 개념: <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>
- Copilot CLI skill 추가: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills>
- Copilot CLI: <https://docs.github.com/copilot/how-tos/copilot-cli>

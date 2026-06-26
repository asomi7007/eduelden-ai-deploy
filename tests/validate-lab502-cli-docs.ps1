[CmdletBinding()]
param(
    [switch]$CheckExternalLinks
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$docDir = Join-Path $repoRoot 'docs\lab502-cli'
$assetDir = Join-Path $docDir 'assets'
$failures = [System.Collections.Generic.List[string]]::new()

$expectedCliAssets = @(
    'copilog-in-terminal.png',
    'copilot-cli-git-status-execution-result.png',
    'copilot-asking-clarification.png',
    'copilot-cli-plan-ready-review.png',
    'msbld26-themed-space-invaders.png',
    'copilot-cli-task-complete.png'
)

$expectedNumberedDocs = @(
    @{
        Number = '00'
        Original = '00-intro.md'
        Local = '00-intro.ko.md'
    },
    @{
        Number = '01'
        Original = '01-setting-up-the-environment.md'
        Local = '01-setting-up-the-environment.ko.md'
    },
    @{
        Number = '02'
        Original = '02-installing-the-community-plugin.md'
        Local = '02-installing-the-community-plugin.ko.md'
    },
    @{
        Number = '03'
        Original = '03-generating-the-space-invaders-game.md'
        Local = '03-generating-the-space-invaders-game.ko.md'
    },
    @{
        Number = '04'
        Original = '04-screenshot-sharing.md'
        Local = '04-screenshot-sharing.ko.md'
    },
    @{
        Number = '05'
        Original = '05-exploring-copilot-customizations.md'
        Local = '05-exploring-copilot-customizations.ko.md'
    },
    @{
        Number = '06'
        Original = '06-creating-instructions.md'
        Local = '06-creating-instructions.ko.md'
    },
    @{
        Number = '07'
        Original = '07-creating-a-skill.md'
        Local = '07-creating-a-skill.ko.md'
    },
    @{
        Number = '08'
        Original = '08-recap.md'
        Local = '08-recap.ko.md'
    }
)

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Assert-FileContains {
    param(
        [string]$FilePath,
        [string[]]$Needles
    )

    $text = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
    foreach ($needle in $Needles) {
        if (-not $text.Contains($needle)) {
            Add-Failure "$([IO.Path]::GetFileName($FilePath)) is missing required text: $needle"
        }
    }
}

$checks = @(
    @{
        File = 'README.ko.md'
        Required = @(
            '00-intro.ko.md',
            '01-setting-up-the-environment.ko.md',
            '02-installing-the-community-plugin.ko.md',
            '03-generating-the-space-invaders-game.ko.md',
            '04-screenshot-sharing.ko.md',
            '05-exploring-copilot-customizations.ko.md',
            '06-creating-instructions.ko.md',
            '07-creating-a-skill.ko.md',
            '08-recap.ko.md',
            'copilot init',
            'copilot mcp list',
            'copilot plugin list',
            '@index.html',
            '## 리소스 연결',
            '## 리소스 연결도',
            'Copilot CLI skills',
            '## 원본 CLI 이미지',
            'copilog-in-terminal.png',
            'copilot-cli-task-complete.png',
            '원본 번호/slug',
            '검증 하네스'
        )
    },
    @{
        File = '00-intro.ko.md'
        Required = @(
            '00',
            'GitHub Copilot CLI',
            'plan mode',
            'instructions',
            'skills',
            'MCP servers',
            'plugins',
            '@index.html'
        )
    },
    @{
        File = '01-setting-up-the-environment.ko.md'
        Required = @(
            'git init',
            'copilot update',
            'copilot',
            '/login',
            '/env',
            '! git status',
            '@index.html',
            'assets/copilog-in-terminal.png',
            'assets/copilot-cli-git-status-execution-result.png'
        )
    },
    @{
        File = '02-installing-the-community-plugin.ko.md'
        Required = @(
            '/plugin marketplace list',
            '/plugin marketplace add',
            '/plugin marketplace browse community-hub',
            '/plugin install space-invaders-makers@community-hub',
            '/plugin list',
            '/skills reload',
            'space-invaders-makers'
        )
    },
    @{
        File = '03-generating-the-space-invaders-game.ko.md'
        Required = @(
            '/plan',
            'single HTML',
            '/model',
            '/diff',
            'start .\index.html',
            'Playwright MCP',
            'share-screenshot',
            'assets/copilot-asking-clarification.png',
            'assets/copilot-cli-plan-ready-review.png',
            'assets/msbld26-themed-space-invaders.png',
            'assets/copilot-cli-task-complete.png'
        )
    },
    @{
        File = '04-screenshot-sharing.ko.md'
        Required = @(
            '/agent',
            'web-screenshotter',
            'Playwright MCP',
            'share-screenshot',
            '@index.html',
            '/skills info share-screenshot',
            'http://localhost:1345'
        )
    },
    @{
        File = '05-exploring-copilot-customizations.ko.md'
        Required = @(
            '/env',
            '/instructions',
            '/skills',
            '/mcp',
            '/plugin',
            '/skills reload',
            '/skills info <skill-name>',
            'copilot mcp list',
            'copilot plugin list',
            'copilot --continue',
            'copilot --resume',
            'copilot --remote'
        )
    },
    @{
        File = '06-creating-instructions.ko.md'
        Required = @(
            'copilot init',
            '/init',
            '.github/copilot-instructions.md',
            '@index.html',
            '/diff',
            'AGENTS.md'
        )
    },
    @{
        File = '07-creating-a-skill.ko.md'
        Required = @(
            '.github/skills/',
            'SKILL.md',
            'scripts/upload-game.ps1',
            'scripts/upload-game.sh',
            '/skills reload',
            '/skills info invaders-gallery-upload',
            '@index.html',
            '200KB'
        )
    },
    @{
        File = '08-recap.ko.md'
        Required = @(
            'copilot init',
            'copilot mcp list',
            'copilot plugin list',
            '/skills reload',
            '/skills info <skill-name>',
            'Custom instructions',
            'MCP servers',
            'Plugins',
            '원본 00~08'
        )
    }
)

if (-not (Test-Path -LiteralPath $docDir)) {
    Add-Failure "Documentation directory does not exist: $docDir"
} else {
    foreach ($asset in $expectedCliAssets) {
        $assetPath = Join-Path $assetDir $asset
        if (-not (Test-Path -LiteralPath $assetPath)) {
            Add-Failure "Missing expected copied CLI asset: $asset"
            continue
        }

        if ((Get-Item -LiteralPath $assetPath).Length -le 0) {
            Add-Failure "Copied CLI asset is empty: $asset"
        }
    }

    foreach ($doc in $expectedNumberedDocs) {
        if (-not $doc.Original.StartsWith($doc.Number)) {
            Add-Failure "Original mapping has wrong number prefix: $($doc.Original)"
        }

        if (-not $doc.Local.StartsWith($doc.Number)) {
            Add-Failure "Local mapping has wrong number prefix: $($doc.Local)"
        }

        $expectedLocalBase = [IO.Path]::GetFileNameWithoutExtension($doc.Original) + '.ko.md'
        if ($doc.Local -ne $expectedLocalBase) {
            Add-Failure "Local document name must preserve original slug and add .ko.md only. Expected $expectedLocalBase, got $($doc.Local)"
        }

        $path = Join-Path $docDir $doc.Local
        if (-not (Test-Path -LiteralPath $path)) {
            Add-Failure "Missing numbered document matching original $($doc.Original): $($doc.Local)"
        }
    }

    foreach ($check in $checks) {
        $path = Join-Path $docDir $check.File
        if (-not (Test-Path -LiteralPath $path)) {
            Add-Failure "Missing expected documentation file: $($check.File)"
            continue
        }

        Assert-FileContains -FilePath $path -Needles $check.Required
    }

    foreach ($file in Get-ChildItem -LiteralPath $docDir -Filter '*.md') {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        foreach ($match in [regex]::Matches($text, '\[[^\]]+\]\(([^)#][^)]*\.ko\.md)(#[^)]*)?\)')) {
            $target = $match.Groups[1].Value
            if ($target.StartsWith('http://') -or $target.StartsWith('https://')) {
                continue
            }

            $targetPath = Join-Path $file.DirectoryName $target
            if (-not (Test-Path -LiteralPath $targetPath)) {
                Add-Failure "$($file.Name) has broken local link: $target"
            }
        }

        foreach ($match in [regex]::Matches($text, '!\[[^\]]*\]\(([^)#]+)(#[^)]*)?\)')) {
            $target = $match.Groups[1].Value
            if ($target.StartsWith('http://') -or $target.StartsWith('https://')) {
                continue
            }

            $targetPath = Join-Path $file.DirectoryName $target
            if (-not (Test-Path -LiteralPath $targetPath)) {
                Add-Failure "$($file.Name) has broken image link: $target"
            }
        }
    }
}

$bannedVsCodeProcedureText = @(
    'Click **Keep**',
    'Open **Visual Studio Code**',
    'Authorize Visual Studio Code',
    'Chat: Open Customizations',
    'Command Palette',
    'Activity Bar',
    'Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>I',
    'Copilot icon in the bottom-right'
)

if (Test-Path -LiteralPath $docDir) {
    foreach ($file in Get-ChildItem -LiteralPath $docDir -Filter '*.md') {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        foreach ($banned in $bannedVsCodeProcedureText) {
            if ($text.Contains($banned)) {
                Add-Failure "$($file.Name) still contains VS Code procedure text: $banned"
            }
        }
    }
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
    Add-Failure 'npx is not available; cannot run markdownlint-cli2.'
} else {
    Push-Location $repoRoot
    try {
        & npx markdownlint-cli2 --config .markdownlint.json 'docs/lab502-cli/**/*.md'
        if ($LASTEXITCODE -ne 0) {
            Add-Failure "markdownlint-cli2 failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

if ($CheckExternalLinks -and (Test-Path -LiteralPath $docDir)) {
    $urlSet = [System.Collections.Generic.HashSet[string]]::new()

    foreach ($file in Get-ChildItem -LiteralPath $docDir -Filter '*.md') {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8

        foreach ($match in [regex]::Matches($text, '<(https?://[^>]+)>')) {
            $urlSet.Add($match.Groups[1].Value) | Out-Null
        }

        foreach ($match in [regex]::Matches($text, '\[[^\]]+\]\((https?://[^)]+)\)')) {
            $urlSet.Add($match.Groups[1].Value) | Out-Null
        }
    }

    $urls = $urlSet | Sort-Object

    foreach ($url in $urls) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 20
            if ([int]$response.StatusCode -ge 400) {
                Add-Failure "External link returned HTTP $($response.StatusCode): $url"
            }
        } catch {
            try {
                $response = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 5 -TimeoutSec 20
                if ([int]$response.StatusCode -ge 400) {
                    Add-Failure "External link returned HTTP $($response.StatusCode): $url"
                }
            } catch {
                Add-Failure "External link check failed: $url ($($_.Exception.Message))"
            }
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "LAB502 CLI docs harness failed:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "LAB502 CLI docs harness passed." -ForegroundColor Green

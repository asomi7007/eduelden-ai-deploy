# Requires PowerShell 7, Azure CLI and Node.js. Cloud Shell: pwsh -File ./scripts/deploy-workshop-routing.ps1
param([switch]$Apply, [switch]$SmokeTest)

$ErrorActionPreference = 'Stop'
$env:PYTHONIOENCODING = 'utf-8'
$repoRoot = Split-Path -Parent $PSScriptRoot
$planJson = & node (Join-Path $repoRoot 'infra\workshop-routing.js')
if ($LASTEXITCODE -ne 0) { throw 'Routing generation failed.' }
$plan = $planJson | ConvertFrom-Json
[xml]$policyXml = $plan.policy
$apimSubscription = '08bfa8d7-3cb6-42d6-8214-18e784777a56'
$apimRoot = "https://management.azure.com/subscriptions/$apimSubscription/resourceGroups/rg-eduelden-hub/providers/Microsoft.ApiManagement/service/apim-eduelden-ai-v2"
$apiPolicyUrl = "$apimRoot/apis/foundry-openai-v1/policies/policy?api-version=2024-05-01"
$secondaryNamedValue = 'workshop-secondary-key'

foreach ($model in $plan.models) {
    $routes = $plan.assignments.($model.id) | Select-Object -First 40
    $primaryCount = @($routes | Where-Object tenant -eq primary).Count
    Write-Host "$($model.id): first 40 students -> primary $primaryCount, secondary $(40 - $primaryCount)"
}
if ($Apply) {
    Write-Host 'Plan: verify existing deployments; back up API policy; store a secret Named Value; PUT secondary backend; PUT API policy.'
} elseif ($SmokeTest) {
    Write-Host 'Smoke test only: no APIM configuration is changed.'
}
Write-Host 'No resource creation, role changes, key rotation, subscription key changes, or emails.'
if (-not $Apply -and -not $SmokeTest) {
    Write-Host 'Preview only. Use -Apply to change APIM, or -SmokeTest to check the deployed gateway.'
    return
}

function Get-ArmHeaders([string]$Subscription) {
    $token = & az account get-access-token --subscription $Subscription --resource https://management.azure.com --query accessToken -o tsv --only-show-errors
    if ($LASTEXITCODE -ne 0 -or -not $token) { throw "Authentication failed for subscription $Subscription." }
    return @{ Authorization = "Bearer $token" }
}

function Invoke-Arm([string]$Method, [string]$Url, [hashtable]$Headers, $Body = $null) {
    $options = @{ Method = $Method; Uri = $Url; Headers = $Headers; TimeoutSec = 60 }
    if ($null -ne $Body) {
        $options.ContentType = 'application/json; charset=utf-8'
        $options.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20 -Compress))
    }
    try { return Invoke-RestMethod @options }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        throw "ARM $Method failed (HTTP $status). Request and credential bodies are not logged."
    }
}

$armHeaders = Get-ArmHeaders $apimSubscription
if ($Apply) {
    foreach ($tenantName in @('primary', 'secondary')) {
        $tenant = $plan.tenants.$tenantName
        $headers = Get-ArmHeaders $tenant.subscriptionId
        $accountRoot = "https://management.azure.com/subscriptions/$($tenant.subscriptionId)/resourceGroups/$($tenant.resourceGroup)/providers/Microsoft.CognitiveServices/accounts/$($tenant.account)"
        foreach ($model in $plan.models) {
            $name = $model.deployments.$tenantName
            $deployment = Invoke-Arm GET "$accountRoot/deployments/${name}?api-version=2025-06-01" $headers
            if ($deployment.properties.provisioningState -ne 'Succeeded' -or $deployment.properties.model.name -cne $model.id) {
                throw "Deployment is not ready or model differs: $tenantName / $name."
            }
            foreach ($kind in @('token', 'request')) {
                $rate = @($deployment.properties.rateLimits | Where-Object { $_.key -eq $kind -and $_.renewalPeriod -eq 60 })
                $expected = if ($kind -eq 'token') { $model.tpm.$tenantName } else { $model.rpm.$tenantName }
                if ($rate.Count -ne 1 -or $rate[0].count -ne $expected) {
                    throw "Quota differs for $tenantName / $name / $kind. Recalculate assignment before applying."
                }
            }
        }
    }

    $priorPolicy = Invoke-Arm GET $apiPolicyUrl $armHeaders
    $backupFolder = Join-Path $repoRoot '.secrets'
    [IO.Directory]::CreateDirectory($backupFolder) | Out-Null
    $backupPath = Join-Path $backupFolder ("workshop-policy-backup-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    [IO.File]::WriteAllText($backupPath, ($priorPolicy | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    Write-Host "Prior API policy backed up: $backupPath"
    $primaryBackend = Invoke-Arm GET "$apimRoot/backends/$($plan.tenants.primary.backendId)?api-version=2024-05-01" $armHeaders
    if ($primaryBackend.properties.url.TrimEnd('/') -ne $plan.tenants.primary.baseUrl) {
        throw 'Primary backend URL differs; existing backend was not changed.'
    }
    $secondary = $plan.tenants.secondary
    $secondaryHeaders = Get-ArmHeaders $secondary.subscriptionId
    $secondaryAccount = "https://management.azure.com/subscriptions/$($secondary.subscriptionId)/resourceGroups/$($secondary.resourceGroup)/providers/Microsoft.CognitiveServices/accounts/$($secondary.account)"
    $keyResponse = Invoke-Arm POST "$secondaryAccount/listKeys?api-version=2025-06-01" $secondaryHeaders
    if (-not $keyResponse.key1) { throw 'Secondary resource key unavailable.' }
    Invoke-Arm PUT "$apimRoot/namedValues/${secondaryNamedValue}?api-version=2024-05-01" $armHeaders @{
        properties = @{ displayName = $secondaryNamedValue; secret = $true; value = $keyResponse.key1 }
    } | Out-Null
    $keyResponse = $null
    Invoke-Arm PUT "$apimRoot/backends/$($secondary.backendId)?api-version=2024-05-01" $armHeaders @{
        properties = @{
            protocol = 'http'; url = $secondary.baseUrl
            credentials = @{ header = @{ 'api-key' = @("{{$secondaryNamedValue}}") } }
            tls = @{ validateCertificateChain = $true; validateCertificateName = $true }
        }
    } | Out-Null
    $backend = Invoke-Arm GET "$apimRoot/backends/$($secondary.backendId)?api-version=2024-05-01" $armHeaders
    if ($backend.properties.url -ne $secondary.baseUrl -or $backend.properties.credentials.header.'api-key'[0] -ne "{{$secondaryNamedValue}}") {
        throw 'Secondary backend verification failed; policy was not applied.'
    }
    Invoke-Arm PUT $apiPolicyUrl $armHeaders @{ properties = @{ format = 'rawxml'; value = $plan.policy } } | Out-Null
    $saved = Invoke-Arm GET $apiPolicyUrl $armHeaders
    if ($saved.properties.value -notmatch 'tenant-route' -or $saved.properties.value -notmatch 'gpt-5.4-mini-1') {
        throw "Saved routing policy verification failed. Prior policy backup: $backupPath"
    }
    Write-Host 'APIM policy saved. Existing student keys are unchanged. Allow gateway configuration to propagate.'
}

if ($SmokeTest) {
    Start-Sleep -Seconds 30
    foreach ($studentId in @('01', '02')) {
        $key = Invoke-Arm POST "$apimRoot/subscriptions/sub-student-${studentId}/listSecrets?api-version=2024-05-01" $armHeaders
        if (-not $key.primaryKey) { throw "Student key unavailable: $studentId." }
        $headers = @{ 'Ocp-Apim-Subscription-Key' = $key.primaryKey }
        foreach ($model in $plan.models) {
            $route = @($plan.assignments.($model.id) | Where-Object studentId -eq $studentId)[0].tenant
            foreach ($mode in @('text', 'tool', 'stream')) {
                $body = @{ model = $model.id; messages = @(@{ role = 'user'; content = 'Reply with OK.' }); max_completion_tokens = 128 }
                if ($mode -eq 'stream') { $body.stream = $true }
                if ($mode -eq 'tool') {
                    $body.messages[0].content = 'Call get_room with room workshop.'
                    $body.tools = @(@{ type = 'function'; function = @{
                        name = 'get_room'; description = 'Get a synthetic workshop room.'
                        parameters = @{ type = 'object'; properties = @{ room = @{ type = 'string' } }; required = @('room') }
                    } })
                    $body.tool_choice = @{ type = 'function'; function = @{ name = 'get_room' } }
                }
                $response = Invoke-WebRequest -Method POST -Uri 'https://apim-eduelden-ai-v2.azure-api.net/openai/v1/chat/completions' `
                    -Headers $headers -ContentType 'application/json; charset=utf-8' `
                    -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 12 -Compress))) `
                    -SkipHttpErrorCheck -TimeoutSec 150
                if ($response.StatusCode -ne 200) {
                    throw "Smoke test failed: student $studentId / $($model.id) / $mode HTTP $($response.StatusCode). Retry-After: $($response.Headers['Retry-After']). Not resent."
                }
                if ($response.Headers['X-Workshop-Tenant'][0] -ne $route) {
                    throw "Incorrect tenant route: $studentId / $($model.id). Configuration might still be propagating; not resent."
                }
                if ($mode -eq 'stream') {
                    if ($response.Content -notmatch 'data: \[DONE\]' -or $response.Content -notmatch '"content"\s*:\s*"[^"]+') {
                        throw 'Streaming response did not contain text and DONE.'
                    }
                } else {
                    $completion = $response.Content | ConvertFrom-Json
                    if ($completion.model -notmatch $model.responseModelPattern) { throw 'Unexpected response model.' }
                    $message = $completion.choices[0].message
                    if ($mode -eq 'tool') {
                        if ($message.tool_calls[0].function.name -ne 'get_room') { throw 'Expected tool call missing.' }
                        $arguments = $message.tool_calls[0].function.arguments | ConvertFrom-Json
                        if ($arguments.room -ne 'workshop') { throw 'Tool arguments differ.' }
                    } elseif ([string]::IsNullOrWhiteSpace($message.content)) { throw 'Expected visible text missing.' }
                }
                Write-Host "PASS student $studentId / $($model.id) / $mode / tenant $route"
                Start-Sleep -Seconds 2
            }
        }
        $key = $null
        $headers = $null
    }
}

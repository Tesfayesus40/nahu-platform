# CLI-only deploy of nahu-admin-web to Railway staging.
#
# Why this exists:
#   railway up uploads the monorepo and Railway reads /railway.toml from the
#   archive root. That file is owned by nahu-api (Nest Dockerfile). There is no
#   CLI flag to pick a different config file, so we temporarily replace the root
#   railway.toml for this upload only, then restore it.
#
# Usage (from repo root, linked to nahu-platform-api / staging):
#   powershell -File scripts/deploy-admin-web-staging.ps1
#   powershell -File scripts/deploy-admin-web-staging.ps1 -Detach

param(
  [switch]$Detach,
  [string]$Service = "nahu-admin-web"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ApiConfig = Join-Path $Root "railway.toml"
$ApiBackup = Join-Path $Root "railway.api.toml.bak"
$AdminConfigSource = Join-Path $Root "apps\admin-web\railway.toml"

if (-not (Test-Path $AdminConfigSource)) {
  throw "Missing $AdminConfigSource"
}
if (-not (Test-Path $ApiConfig)) {
  throw "Missing $ApiConfig"
}

# Literal here-string (@' '@) — do NOT use @" "@.
# Expandable here-strings treat backtick as escape (`r = CR), which corrupts TOML.
$AdminRootConfig = @'
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/admin-web/Dockerfile"

[deploy]
healthcheckPath = "/login"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
'@

function Write-Utf8NoBomLfFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  # Railway's TOML parser rejects CR (0x0d). Normalize to LF and write UTF-8 without BOM.
  $normalized = ($Content -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd("`n") + "`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $normalized, $utf8NoBom)
}

Write-Host "Backing up API railway.toml -> railway.api.toml.bak"
Copy-Item -Force $ApiConfig $ApiBackup

try {
  Write-Host "Writing Admin Web railway.toml at repo root for this upload (UTF-8 no BOM, LF)"
  Write-Utf8NoBomLfFile -Path $ApiConfig -Content $AdminRootConfig

  # Sanity check: file must start with [build], not stray text from escaping/logging.
  $written = [System.IO.File]::ReadAllText($ApiConfig)
  if (-not $written.StartsWith("[build]")) {
    throw "Temporary railway.toml is invalid (does not start with [build]). Contents:`n$written"
  }
  if ($written.Contains([char]0x0D)) {
    throw "Temporary railway.toml still contains CR (0x0d)."
  }

  $upArgs = @("up", "--service", $Service)
  if ($Detach) { $upArgs += "--detach" }

  Write-Host ("Running: railway " + ($upArgs -join " "))
  & railway @upArgs
  if ($LASTEXITCODE -ne 0) {
    throw "railway up failed with exit code $LASTEXITCODE"
  }

  Write-Host "Deploy requested. Build logs must show @nahu-platform/admin-web (not @nahu-platform/api)."
}
finally {
  if (Test-Path $ApiBackup) {
    Write-Host "Restoring API railway.toml"
    Move-Item -Force $ApiBackup $ApiConfig
  }
}

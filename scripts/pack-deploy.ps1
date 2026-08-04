# Build a deploy zip (source only — no node_modules, .next, secrets, or PEMs).
# Upload the zip to the server, extract, then npm ci && npm run build && serve.
#
#   npm run pack:deploy
#   → dist/octivate-deploy-YYYYMMDD-HHmm.zip

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$OutDir = Join-Path $RepoRoot "dist"
$ZipPath = Join-Path $OutDir "octivate-deploy-$Stamp.zip"
$Stage = Join-Path $env:TEMP "octivate-pack-$Stamp"

$ExcludeDirNames = @(
  "node_modules",
  ".next",
  "out",
  "dist",
  "coverage",
  ".git",
  ".vercel",
  "data"
)

$ExcludeFilePatterns = @(
  "*.pem",
  "*.key",
  "*.pfx",
  "*.p12",
  ".env",
  ".env.local",
  ".env.production",
  "*.tsbuildinfo",
  ".DS_Store"
)

Write-Host "[pack] Staging from $RepoRoot"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function ShouldSkipDir([string]$Name) {
  return $ExcludeDirNames -contains $Name
}

function ShouldSkipFile([string]$Name) {
  foreach ($pat in $ExcludeFilePatterns) {
    if ($Name -like $pat) { return $true }
  }
  # keep .env.example
  if ($Name -eq "meta.json" -and $_.FullName -match "[\\/]certs[\\/]") { return $true }
  return $false
}

Get-ChildItem -Path $RepoRoot -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    if (ShouldSkipDir $_.Name) {
      Write-Host "[pack] skip dir  $($_.Name)"
      return
    }
    Copy-Item -Path $_.FullName -Destination (Join-Path $Stage $_.Name) -Recurse -Force
  } else {
    if (ShouldSkipFile $_.Name) {
      Write-Host "[pack] skip file $($_.Name)"
      return
    }
    Copy-Item -Path $_.FullName -Destination (Join-Path $Stage $_.Name) -Force
  }
}

# Strip PEMs / local data that may have been copied inside certs/ or nested
Get-ChildItem -Path $Stage -Recurse -File -Force -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Extension -in @(".pem", ".key", ".pfx", ".p12") -or
    $_.Name -eq "meta.json" -and $_.DirectoryName -match "[\\/]certs[\\/]" -or
    $_.Name -match "^\.env" -and $_.Name -ne ".env.example"
  } |
  ForEach-Object {
    Write-Host "[pack] strip $($_.FullName.Substring($Stage.Length + 1))"
    Remove-Item -Force $_.FullName
  }

# Ensure certs folder scaffold exists in the zip
$CertKeep = Join-Path $Stage "certs\octivate.io"
New-Item -ItemType Directory -Force -Path $CertKeep | Out-Null
if (-not (Test-Path (Join-Path $CertKeep ".gitkeep"))) {
  Set-Content -Path (Join-Path $CertKeep ".gitkeep") -Value ""
}

if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $ZipPath -Force

Remove-Item -Recurse -Force $Stage

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "[pack] Ready: $ZipPath ($sizeMb MB)"
Write-Host "[pack] On the server:"
Write-Host "  1. Expand zip"
Write-Host "  2. copy .env.example .env   # set OCTIVATE_API_KEY"
Write-Host "  3. npm ci"
Write-Host "  4. npm run build"
Write-Host "  5. npx next start -H 127.0.0.1 -p 3000"
Write-Host "  6. npm run serve:prod       # auto SSL + HTTP/HTTPS"

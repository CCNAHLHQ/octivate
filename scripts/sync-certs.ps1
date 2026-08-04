# Sync Let's Encrypt PEMs from WSL Certbot into repo-relative certs/<domain>/.
# Run elevated if needed. Schedule after `wsl sudo certbot renew`.

param(
  [string]$Domain = "octivate.io",
  [string]$WslDistro = "Ubuntu",
  [string]$DestRoot = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $DestRoot) {
  $DestRoot = Join-Path $RepoRoot "certs"
}

$dest = Join-Path $DestRoot $Domain
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$wslLive = "/etc/letsencrypt/live/$Domain"

Write-Host "Copying certs from WSL ($WslDistro) $wslLive → $dest"

wsl -d $WslDistro -- sudo cp "$wslLive/fullchain.pem" "/mnt/c/Windows/Temp/octivate-fullchain.pem"
wsl -d $WslDistro -- sudo cp "$wslLive/privkey.pem" "/mnt/c/Windows/Temp/octivate-privkey.pem"
wsl -d $WslDistro -- sudo chmod 644 /mnt/c/Windows/Temp/octivate-fullchain.pem /mnt/c/Windows/Temp/octivate-privkey.pem

Copy-Item -Force "C:\Windows\Temp\octivate-fullchain.pem" (Join-Path $dest "fullchain.pem")
Copy-Item -Force "C:\Windows\Temp\octivate-privkey.pem" (Join-Path $dest "privkey.pem")

Write-Host "Synced into repo certs/ (relative):"
Get-ChildItem $dest | Format-Table Name, Length, LastWriteTime

Write-Host "Restart the Octivate Node service so TLS reloads."

param([string]$Go = 'go')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  New-Item -ItemType Directory -Force dist | Out-Null
  $previous = @{}
  foreach ($key in @('GOOS','GOARCH','CGO_ENABLED')) { $previous[$key] = [Environment]::GetEnvironmentVariable($key) }
  $env:CGO_ENABLED = '0'
  $env:GOARCH = 'amd64'
  $env:GOOS = 'linux'
  & $Go build -mod=vendor -trimpath -ldflags '-s -w' -o dist/ziling-server-linux-amd64 .
  if ($LASTEXITCODE -ne 0) { throw 'Linux build failed' }
  $env:GOOS = 'windows'
  & $Go build -mod=vendor -trimpath -ldflags '-s -w' -o dist/ziling-server-windows-amd64.exe .
  if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }
  $releaseDir = Join-Path $PSScriptRoot 'dist/release'
  New-Item -ItemType Directory -Force $releaseDir | Out-Null
  Copy-Item -LiteralPath 'dist/ziling-server-linux-amd64','ziling-coop.service','nginx-wss.conf.example','README.md','THIRD-PARTY-NOTICES.txt' -Destination $releaseDir -Force
  $hash = (Get-FileHash -LiteralPath 'dist/ziling-server-linux-amd64' -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText((Join-Path $releaseDir 'SHA256SUMS'), $hash + "  ziling-server-linux-amd64`n", [System.Text.UTF8Encoding]::new($false))
  $version = & $Go version
  [System.IO.File]::WriteAllText((Join-Path $releaseDir 'BUILD-INFO.txt'), $version + "`nGOOS=linux GOARCH=amd64 CGO_ENABLED=0`nProtocol: ziling-coop-1`n", [System.Text.UTF8Encoding]::new($false))
  $releaseFiles = @('ziling-server-linux-amd64','ziling-coop.service','nginx-wss.conf.example','README.md','THIRD-PARTY-NOTICES.txt','SHA256SUMS','BUILD-INFO.txt') | ForEach-Object { Join-Path $releaseDir $_ }
  Compress-Archive -LiteralPath $releaseFiles -DestinationPath 'dist/ziling-coop-linux-amd64.zip' -Force
  Get-FileHash dist/ziling-server-* -Algorithm SHA256 | Select-Object Hash,Path
} finally {
  foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key]) }
  Pop-Location
}

param(
  [string]$Version = "1.7.2"
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = $appRoot
$outDir = Join-Path $repoRoot "bin"
$outFile = Join-Path $outDir "Pico.exe"
$iconResource = Join-Path $appRoot "rsrc_windows_amd64.syso"

if (!(Test-Path -LiteralPath $iconResource)) {
  throw "缺少 Windows 图标资源: $iconResource"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Push-Location $appRoot
try {
  & go mod download github.com/jchv/go-webview2
  & go build -trimpath -ldflags "-H=windowsgui -s -w -X main.version=$Version" -o $outFile .
  if ($LASTEXITCODE -ne 0) { throw "Pico.exe 构建失败" }
} finally {
  Pop-Location
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outFile).Hash
$size = (Get-Item -LiteralPath $outFile).Length
Write-Output "已生成: $outFile"
Write-Output ("大小: {0:N0} bytes" -f $size)
Write-Output "SHA256: $hash"

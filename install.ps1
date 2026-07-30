$ErrorActionPreference = 'Stop'
$sourceDir = Split-Path -Parent $PSCommandPath
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }

foreach ($command in 'node', 'rtk') {
  if ($command -eq 'rtk' -and -not (Get-Command $command -ErrorAction SilentlyContinue)) {
    $cargo = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $cargo) { throw 'rtk needs cargo' }
    & $cargo.Source install rtk
    if ($LASTEXITCODE -ne 0) { throw 'rtk install failed' }
    if (-not (Get-Command rtk -ErrorAction SilentlyContinue)) { throw 'rtk install failed' }
  } elseif ($command -eq 'node' -and -not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw 'node is required'
  }
}

function Install-File([string]$source, [string]$target) {
  & node (Join-Path $sourceDir 'scripts\install-file.js') $source $target
  if ($LASTEXITCODE -ne 0) { throw "install failed: $source" }
}

Install-File (Join-Path $sourceDir 'skills\ponytail\SKILL.md') (Join-Path $codexDir 'skills\ponytail\SKILL.md')
Install-File (Join-Path $sourceDir 'skills\caveman\SKILL.md') (Join-Path $codexDir 'skills\caveman\SKILL.md')
Install-File (Join-Path $sourceDir 'hooks\workstyle.js') (Join-Path $codexDir 'hooks\workstyle.js')
Install-File (Join-Path $sourceDir 'hooks.json') (Join-Path $codexDir 'hooks.json')
Install-File (Join-Path $sourceDir 'RTK.md') (Join-Path $codexDir 'RTK.md')
& node (Join-Path $sourceDir 'scripts\disable-ponytail.js') (Join-Path $codexDir 'config.toml')
if ($LASTEXITCODE -ne 0) { throw 'ponytail hook disable failed' }
Write-Output 'installed. trust the hook in /hooks, then start a new session.'

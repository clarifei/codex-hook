$ErrorActionPreference = 'Stop'
$sourceDir = Split-Path -Parent $PSCommandPath
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }

foreach ($command in 'node', 'rtk') {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "$command is required" }
}

if ($env:PONYTAIL_SKILL_PATH) {
  $ponytail = Test-Path -LiteralPath $env:PONYTAIL_SKILL_PATH -PathType Leaf
} else {
  $root = Join-Path $codexDir 'plugins\cache\ponytail\ponytail'
  $ponytail = Get-ChildItem -Path $root -Recurse -Filter SKILL.md -ErrorAction SilentlyContinue |
    Where-Object FullName -like '*\skills\ponytail\SKILL.md' |
    Select-Object -First 1
}
if (-not $ponytail) { throw 'ponytail skill is required' }

if ($env:CAVEMAN_SKILL_PATH) {
  $caveman = Test-Path -LiteralPath $env:CAVEMAN_SKILL_PATH -PathType Leaf
} else {
  $caveman = @(
    (Join-Path $codexDir 'skills\caveman\SKILL.md'),
    (Join-Path $HOME '.agents\skills\caveman\SKILL.md')
  ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $caveman) { throw 'caveman skill is required' }

New-Item -ItemType Directory -Force -Path (Join-Path $codexDir 'hooks') | Out-Null
Copy-Item -Force (Join-Path $sourceDir 'hooks\workstyle.js') (Join-Path $codexDir 'hooks\workstyle.js')
Copy-Item -Force (Join-Path $sourceDir 'hooks.json') (Join-Path $codexDir 'hooks.json')
Copy-Item -Force (Join-Path $sourceDir 'RTK.md') (Join-Path $codexDir 'RTK.md')
Write-Output 'installed. trust the hook in /hooks, then start a new session.'

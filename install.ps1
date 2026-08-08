$ErrorActionPreference = 'Stop'
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ("codex-hook-" + [guid]::NewGuid())
$archive = Join-Path $tempDir 'codex-hook.zip'
$url = 'https://github.com/clarifei/codex-hook/archive/refs/heads/main.zip'

if (-not (Get-Command deno -ErrorAction SilentlyContinue)) { throw 'deno is required' }

try {
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  Invoke-WebRequest -Uri $url -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $tempDir
  & deno run --allow-all --config (Join-Path $tempDir 'codex-hook-main\deno.json') (Join-Path $tempDir 'codex-hook-main\scripts\install.ts') @args
  $code = $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue
}

exit $code

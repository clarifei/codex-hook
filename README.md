# codex-hook

personal bootstrap notes for my global codex setup: caveman or beeline, ponytail, rtk, codebase memory, wigolo, and
optional skills.

## fresh-machine checklist

- deno for the installer and hooks.
- bun only for the interactive tui; `--yes` keeps installation deno-only.
- node 20-25 for the configured mcp servers.
- network access during installation.

headroom is intentionally not installed by this repository. on a fresh machine, install it before selecting its checkbox
or `--headroom`:

```sh
uv tool install headroom-ai
```

## install

linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

the interactive flow is workstyle, headroom, then optional skills. commands worth remembering:

```sh
./install.sh --headroom --yes
./install.sh --no-headroom --yes
./install.sh beeline --with matt-pocock
```

## headroom notes

expected flow when headroom is enabled:

1. the installer routes the active Afterinput provider to the loopback bridge at `127.0.0.1:8788`.
2. the codex `SessionStart` hook runs on startup, resume, clear, and compaction. its `ensure` command starts the bridge
   and `headroom proxy` at `127.0.0.1:8787` only when needed.
3. the bridge compresses Responses tool output through Headroom, then forwards the request and OAuth to Afterinput.

the bridge maps `HEADROOM_PROJECT` (or the launch directory from `PWD`) to Headroom's `/p/<project>` route, so the
dashboard separates lifetime savings per project. code navigation stays owned by the existing `codebase-memory-mcp`; the
shared Headroom proxy intentionally does not start another code graph, Serena, memory layer, or MCP server.

normal workflow is still just starting codex. the bridge does not need a manual command, and `headroom wrap codex`
should not be used for this Afterinput setup. failures and timeouts pass the original request through unchanged.
`--no-headroom` restores direct Afterinput routing.

```sh
headroom dashboard
curl --fail --silent http://127.0.0.1:8788/health
```

`headroom dashboard` opens the dashboard served by the running proxy. `deno task headroom` is the shortcut for enabling
the bridge directly from this checkout without rerunning the full installer. `headroom doctor` still reports Codex as
unwrapped because its detector does not know about this custom Afterinput bridge; bridge health and dashboard savings
are the relevant checks here.

## installer notes

the tui discovers optional skills upstream, caches the catalog for one hour, detects existing installs, and preserves
edited files during uninstall.

```sh
./install.sh --yes
./install.sh baseline --all
./install.sh --uninstall tanstack-query
./install.sh --refresh --yes
```

`baseline` aliases `caveman`. `--with` and `--uninstall` accept collection or skill ids; `--all` selects every optional
skill and `--with=` clears the optional selection.

## development

```sh
deno task check
deno task test
deno task tui:smoke
```

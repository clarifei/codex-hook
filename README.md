# codex-hook

a small global hook installer for codex. this is built around my personal
setup: caveman, ponytail, rtk, codebase memory mcp, and wigolo. beeline is the
alternate workstyle.

## quick start

linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

the installer asks for a workstyle, then optional skills.

## requirements

- deno runs the installer and hooks.
- bun is only needed for the interactive tui. use `--yes` for a deno-only install.
- node 20-25 is needed by the configured mcp commands.
- network access is required during installation.

## optional skills

- matt pocock: choose engineering or productivity
- emil kowalski: design engineering and motion
- deno: runtime, deploy, frontend, migration, and sandbox
- hono and elysiajs
- matteo collina: fastify and skill optimizer
- better auth: auth features and security
- vercel react: best practices and view transitions
- tanstack: choose individual skills in its submenu

the optional list is fetched from the official repos on each run, with the local list as offline fallback.
installed skills are detected locally, marked `ok` beside their name, and selected automatically.
in the tui, choose `uninstall installed skills` to remove only the skills you mark.
the state file is generated on the first install at `~/.codex/.codex-hook/skills.json`.

## commands

```sh
./install.sh --yes
./install.sh beeline --with matt-pocock
./install.sh baseline --all
./install.sh --uninstall tanstack-query
./install.sh --refresh --yes
```

`baseline` is an alias for `caveman`. `--with` accepts a collection or leaf
skill, for example `--with matt-pocock,deno` or
`--with tanstack-query,react-view-transitions`. `--all` selects every leaf
skill. `--with=` clears optional skills.
reruns use the local managed cache when files are unchanged; use `--refresh` to
check upstream skill changes.

uninstall accepts the same collection or leaf ids. it updates
`~/.codex/.codex-hook/skills.json`, keeps unrelated skills, and preserves files
you edited.

## personal setup note

this project is focused on my personal codex setup, not a universal installer.
if it works on my machine and not on yours, that is probably a you problem. adjust
the manifest and defaults to match your environment.

## files

```text
~/.codex/
|-- .codex-hook/skills.json  generated managed skill state
|-- skills/                  discoverable skills
|-- hooks/                   codex hooks
|-- config.toml              mcp configuration
|-- hooks.json
`-- RTK.md
```

## local checks

```sh
deno task check
deno task test
deno task tui:smoke
```

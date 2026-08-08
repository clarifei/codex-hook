# codex-hook

A small global hook installer for Codex. New installs include Caveman,
Ponytail, RTK, Codebase Memory MCP, and Wigolo. Beeline is the alternate
workstyle.

## Quick start

Linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

Windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

The installer asks for a workstyle, then optional skills.

## Requirements

- Deno runs the installer and hooks.
- Bun is only needed for the interactive TUI. Use `--yes` for a Deno-only install.
- Node 20-25 is needed by the configured MCP commands.
- Network access is required during installation.

## Optional skills

- Matt Pocock: engineering and productivity
- Emil Kowalski: design engineering and motion
- Deno: runtime, Deploy, Frontend, migration, and Sandbox
- Hono and ElysiaJS
- Matteo Collina: Fastify and Skill Optimizer
- Better Auth: auth features and security
- Vercel React: Best Practices and View Transitions
- TanStack: choose individual skills in its submenu

Installed skills are detected from the local Codex directory. They show as
`[ok]` and are selected automatically. In the TUI, choose `Uninstall installed
skills` to remove only the skills you mark.

## Commands

```sh
./install.sh --yes
./install.sh beeline --with matt-pocock
./install.sh baseline --all
./install.sh --uninstall tanstack-query
```

`baseline` is an alias for `caveman`. `--with` accepts a collection or leaf
skill, for example `--with matt-pocock,deno` or
`--with tanstack-query,react-view-transitions`. `--all` selects every leaf
skill. `--with=` clears optional skills.

Uninstall accepts the same collection or leaf IDs. It updates
`~/.codex/.codex-hook/skills.json`, keeps unrelated skills, and preserves files
you edited.

## Files

```text
~/.codex/
|-- .codex-hook/skills.json  managed skill state
|-- skills/                  discoverable skills
|-- hooks/                   Codex hooks
|-- config.toml              MCP configuration
|-- hooks.json
`-- RTK.md
```

## Local checks

```sh
deno task check
deno task test
deno task tui:smoke
```

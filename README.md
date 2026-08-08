# codex-hook

One global hook with a baseline-first installer. New installs use Caveman,
Ponytail, RTK, Codebase Memory MCP, and Wigolo. Beeline is available as the
alternate workstyle.

The installer and hooks run on Deno. Interactive selection uses OpenTUI's
supported Bun renderer; pass `--yes` when Bun is unavailable. Network access is
required. The configured MCP commands use `npx`, so keep Node 20-25 available
for Wigolo's current `better-sqlite3` dependency.

Linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

Windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

The TUI first asks for a workstyle, then shows the optional collections:

- Workstyle: Caveman (default) or Beeline
- Matt Pocock engineering and productivity skills
- Emil Kowalski design engineering and motion skills

Enter advances or activates an action. Space toggles an optional collection.
Escape goes back, while `Cancel` and Ctrl-C leave the installation unchanged.

For automation, arguments skip the TUI:

```sh
./install.sh --yes
./install.sh beeline --with matt-pocock
./install.sh baseline --all
```

`baseline` is an alias for `caveman`. Use `--with matt-pocock,emil-kowalski`,
`--all`, or `--with=` to select, install all, or clear optional collections.

Installed files stay within Codex's discovery layout:

```text
~/.codex/
|-- .codex-hook/
|   `-- skills.json          managed-file ownership and selected collections
|-- hooks/
|   |-- lib/
|   `-- workstyle.ts
|-- skills/                  one discoverable directory per skill
|-- config.toml              Codebase Memory and Wigolo MCP entries
|-- hooks.json
`-- RTK.md
```

The managed state lets reruns remove deselected or upstream-deleted files
without touching unrelated skills. A managed file changed by the user is
preserved. Upstream files with unchanged Git blob hashes are not downloaded
again, and duplicate skill targets fail before writes.

The installer preserves an existing native Codebase Memory MCP command.
Otherwise it configures `npx -y codebase-memory-mcp`; Wigolo uses
`npx -y wigolo`. Verify Wigolo with `npx wigolo doctor`.

Run local checks with:

```sh
deno task check
deno task test
deno task tui:smoke
```

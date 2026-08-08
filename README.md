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
- Deno (Deno, Deploy, Frontend, Migrate to Deno, and Sandbox)
- Hono and ElysiaJS
- Matteo Collina (Fastify and Skill Optimizer)
- Better Auth (authentication features and security)
- Vercel React (Best Practices and View Transitions)
- TanStack (individual ecosystem skills)

Enter advances or activates an action. Space toggles a skill. Collections with
multiple skills open a second, focused list. Escape or `Back` returns to the
previous list, while `Cancel` and Ctrl-C leave the installation unchanged.
Locally installed skills are marked `[ok]` and selected automatically. Choose
`Uninstall installed skills` to remove only the checked local skills.

For automation, arguments skip the TUI:

```sh
./install.sh --yes
./install.sh beeline --with matt-pocock
./install.sh baseline --all
./install.sh --uninstall tanstack-query
```

`baseline` is an alias for `caveman`. Use collection IDs such as
`--with matt-pocock,deno` to select a collection, or leaf IDs such as
`--with tanstack-query,react-view-transitions` to select individual skills.
`--all` installs every listed leaf skill; `--with=` with no value clears all
optional skills. `--uninstall` removes selected installed skills only; modified
managed files are preserved.

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

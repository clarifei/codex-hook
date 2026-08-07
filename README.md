# codex hook

one global hook. ponytail full, beeline full by default (caveman optional), rtk enforced.

needs `node` and network. installer gets rtk from `rtk-ai/rtk`, then syncs every skill from both upstream repos direct from the source files.

linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

the installer accepts `beeline` (default) or `caveman`; it removes the other skill family before finishing. In an interactive terminal, press Enter after reading the summary; then trust the hook in `/hooks` and start a new session.

```sh
./install.sh beeline
./install.sh caveman
```

```powershell
./install.ps1 beeline
./install.ps1 caveman
```

skills: every current selected-style, ponytail, and Wigolo skill. The installer also configures Wigolo MCP as `npx -y wigolo`, alongside the local `codebase-memory` skill (https://github.com/DeusData/codebase-memory-mcp).

Wigolo requires Node 20-25 for its current `better-sqlite3` dependency. Verify the setup with `npx wigolo doctor`; Node 26 is not supported by that native dependency yet.

unchanged upstream files are skipped by their source blob hash. different files replace the local copy. ponytail bundled hook stays disabled; this hook owns startup.

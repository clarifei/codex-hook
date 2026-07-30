# codex hook

one global hook. ponytail full, caveman full, rtk enforced.

needs `node` and network. installer gets rtk from `rtk-ai/rtk`, then syncs every skill from both upstream repos direct from the source files.

linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

the installer prints a summary and next steps. In an interactive terminal, press Enter after reading it; then trust the hook in `/hooks` and start a new session.

skills: every current caveman and ponytail skill, including review, audit, help, debt, gain, compress, and cavecrew.

unchanged upstream files are skipped by their source blob hash. different files replace the local copy. ponytail bundled hook stays disabled; this hook owns startup.

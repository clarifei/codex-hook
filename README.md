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

then trust hook in `/hooks` and start a new session.

skills: every current caveman and ponytail skill, including review, audit, help, debt, gain, compress, and cavecrew.

each upstream file uses sha-256. same hash skips. different hash replaces. ponytail bundled hook stays disabled; this hook owns startup.

# codex hook

one global hook. ponytail full, caveman full, rtk enforced.

needs `node`, `rtk`, ponytail, and caveman first. installer stops with an error when one is missing.

linux:

```sh
sh ./install.sh
```

windows:

```powershell
.\install.ps1
```

then trust hook in `/hooks` and start a new session.

disable ponytail bundled hook in `/plugins`. this hook reads ponytail skill directly, so running both duplicates context.

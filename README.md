# codex hook

one global hook. ponytail full, caveman full, rtk enforced.

needs `node`. installer installs `rtk` with cargo when needed, installs bundled ponytail and caveman skills, and disables ponytail bundled hook.

linux:

```sh
sh ./install.sh
```

windows:

```powershell
.\install.ps1
```

then trust hook in `/hooks` and start a new session.

each file uses sha-256. same hash skips. different hash replaces with bundled source.

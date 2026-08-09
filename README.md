# codex-hook

a small global hook installer for codex. this is built around my personal setup: caveman, ponytail, rtk, codebase memory
mcp, and wigolo. beeline is the alternate workstyle.

## quick start

linux:

```sh
curl --fail --silent --show-error --location https://raw.githubusercontent.com/clarifei/codex-hook/main/install.sh | sh
```

windows:

```powershell
irm https://raw.githubusercontent.com/clarifei/codex-hook/main/install.ps1 | iex
```

the installer asks for a workstyle, headroom, then optional skills.

## requirements

- deno runs the installer and hooks.
- bun is only needed for the interactive tui. use `--yes` for a deno-only install.
- node 20-25 is needed by the configured mcp commands.
- headroom is not installed automatically. before enabling its checkbox, run `uv tool install headroom-ai`.
- network access is required during installation.

## optional skills

the menu discovers `SKILL.md` files from the official matt pocock, emil kowalski, deno, hono, elysiajs, matteo collina,
better auth, vercel react, and tanstack repos. nested upstream collections stay as a submenu, so new skills appear
without an installer update.

the optional catalog is fetched from official repos, cached locally for one hour, and has an offline fallback. use
`--refresh` to fetch now. installed skills are detected locally, marked `ok` beside their name, and selected
automatically. in the tui, choose `uninstall installed skills` to remove only the skills you mark. the state file is
generated on the first install at `~/.codex/.codex-hook/skills.json`.

managed skills use `~/.codex/skills/<collection>/`: the primary skill is `SKILL.md`; variants use subfolders.

## commands

```sh
./install.sh --yes
./install.sh beeline --with matt-pocock
./install.sh baseline --all
./install.sh --uninstall tanstack-query
./install.sh --refresh --yes
./install.sh --headroom --yes
./install.sh --no-headroom --yes
deno task headroom
headroom dashboard
```

`baseline` is an alias for `caveman`. `--with` accepts a collection or leaf skill, for example `--with matt-pocock,deno`
or `--with tanstack-query,react-view-transitions`. `--all` selects every leaf skill. `--with=` clears optional skills.
reruns use the local managed cache when files are unchanged; use `--refresh` to check upstream skill changes.

uninstall accepts the same collection or leaf ids. it updates `~/.codex/.codex-hook/skills.json`, keeps unrelated
skills, and preserves files you edited.

the headroom checkbox or `--headroom` routes Afterinput through a loopback bridge. session hooks start the bridge and
proxy automatically; do not use `headroom wrap codex`. `--no-headroom` restores direct Afterinput routing. the bridge
compresses tool output, keeps OAuth away from Headroom, and fails open when compression is unavailable. run
`deno task headroom` to enable it directly from this checkout. run `headroom dashboard` to open savings at
`127.0.0.1:8787`.

## personal setup note

this project is focused on my personal codex setup, not a universal installer. if it works on my machine and not on
yours, that is probably a you problem. adjust the manifest and defaults to match your environment.

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

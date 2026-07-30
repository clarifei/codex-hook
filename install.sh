#!/usr/bin/env sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
codex_dir=${CODEX_HOME:-"$HOME/.codex"}

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
if ! command -v rtk >/dev/null 2>&1; then
  command -v cargo >/dev/null 2>&1 || { echo "rtk needs cargo" >&2; exit 1; }
  cargo install rtk
  command -v rtk >/dev/null 2>&1 || { echo "rtk install failed" >&2; exit 1; }
fi

install_file() { node "$source_dir/scripts/install-file.js" "$1" "$2"; }
install_file "$source_dir/skills/ponytail/SKILL.md" "$codex_dir/skills/ponytail/SKILL.md"
install_file "$source_dir/skills/caveman/SKILL.md" "$codex_dir/skills/caveman/SKILL.md"
install_file "$source_dir/hooks/workstyle.js" "$codex_dir/hooks/workstyle.js"
install_file "$source_dir/hooks.json" "$codex_dir/hooks.json"
install_file "$source_dir/RTK.md" "$codex_dir/RTK.md"
node "$source_dir/scripts/disable-ponytail.js" "$codex_dir/config.toml"

echo "installed. trust the hook in /hooks, then start a new session."

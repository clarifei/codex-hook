#!/usr/bin/env sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
codex_dir=${CODEX_HOME:-"$HOME/.codex"}

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v rtk >/dev/null 2>&1 || { echo "rtk is required" >&2; exit 1; }

if [ -n "${PONYTAIL_SKILL_PATH:-}" ]; then
  [ -f "$PONYTAIL_SKILL_PATH" ] || { echo "ponytail skill is required" >&2; exit 1; }
elif ! find "$codex_dir/plugins/cache/ponytail/ponytail" -path '*/skills/ponytail/SKILL.md' -type f -print -quit 2>/dev/null | grep -q .; then
  echo "ponytail skill is required" >&2
  exit 1
fi

if [ -n "${CAVEMAN_SKILL_PATH:-}" ]; then
  [ -f "$CAVEMAN_SKILL_PATH" ] || { echo "caveman skill is required" >&2; exit 1; }
elif [ ! -f "$codex_dir/skills/caveman/SKILL.md" ] && [ ! -f "$HOME/.agents/skills/caveman/SKILL.md" ]; then
  echo "caveman skill is required" >&2
  exit 1
fi

mkdir -p "$codex_dir/hooks"
cp "$source_dir/hooks/workstyle.js" "$codex_dir/hooks/workstyle.js"
cp "$source_dir/hooks.json" "$codex_dir/hooks.json"
cp "$source_dir/RTK.md" "$codex_dir/RTK.md"
echo "installed. trust the hook in /hooks, then start a new session."

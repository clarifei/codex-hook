#!/usr/bin/env sh
set -eu

archive_url=https://github.com/clarifei/codex-hook/archive/refs/heads/main.tar.gz
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

command -v deno >/dev/null 2>&1 || { echo "deno is required" >&2; exit 1; }

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$archive_url" | tar -xzf - -C "$temp_dir" --strip-components=1
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$archive_url" | tar -xzf - -C "$temp_dir" --strip-components=1
else
  echo "curl or wget is required" >&2
  exit 1
fi

if [ "$#" -eq 0 ] && [ -t 1 ] && [ -r /dev/tty ]; then
  deno run --allow-all --config "$temp_dir/deno.json" "$temp_dir/scripts/install.ts" </dev/tty
else
  deno run --allow-all --config "$temp_dir/deno.json" "$temp_dir/scripts/install.ts" "$@"
fi

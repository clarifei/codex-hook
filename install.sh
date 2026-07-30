#!/usr/bin/env sh
set -eu

archive_url=https://github.com/clarifei/codex-hook/archive/refs/heads/main.tar.gz
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$archive_url" | tar -xzf - -C "$temp_dir" --strip-components=1
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$archive_url" | tar -xzf - -C "$temp_dir" --strip-components=1
else
  echo "curl or wget is required" >&2
  exit 1
fi

node "$temp_dir/scripts/install.js" "$@"

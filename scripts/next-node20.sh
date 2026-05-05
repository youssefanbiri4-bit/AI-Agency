#!/usr/bin/env bash
set -euo pipefail

required_major=20
required_minor=9

node_supports_next() {
  local candidate="$1"

  "$candidate" -e "
    const [major, minor] = process.versions.node.split('.').map(Number);
    process.exit(major > $required_major || (major === $required_major && minor >= $required_minor) ? 0 : 1);
  " >/dev/null 2>&1
}

run_next() {
  local node_bin="$1"
  shift

  exec "$node_bin" node_modules/next/dist/bin/next "$@"
}

if command -v node >/dev/null 2>&1 && node_supports_next "$(command -v node)"; then
  run_next "$(command -v node)" "$@"
fi

for candidate in "$HOME"/.npm/_npx/*/node_modules/node/bin/node; do
  if [ -x "$candidate" ] && node_supports_next "$candidate"; then
    run_next "$candidate" "$@"
  fi
done

echo "Next.js requires Node.js >=20.9.0, but no compatible Node binary was found." >&2
echo "Install Node 20 or newer, then run this command again." >&2
exit 1

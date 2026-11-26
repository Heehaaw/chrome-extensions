#!/usr/bin/env bash
# Packages each <name>/extension folder into artifacts/input/<name>-0.0.0-dev.zip, with manifest.json
# at the ZIP root so the extracted folder can be loaded unpacked as-is. Release preparation promotes
# these tested ZIPs with scripts/release.js; release tags are the version source of truth.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/artifacts/input"
rm -rf "$out"
mkdir -p "$out"

for manifest in "$root"/*/extension/manifest.json; do
  dir=$(dirname "$manifest")
  name=$(basename "$(dirname "$dir")")
  version=$(bun --print "(await Bun.file(process.argv[1]).json()).version_name" "$manifest")
  if [[ "$version" != "0.0.0-dev" ]]; then
    echo "$manifest: version_name must stay 0.0.0-dev; release preparation sets the version." >&2
    exit 1
  fi
  # -X drops platform-specific extra attributes for reproducible archives.
  (cd "$dir" && zip -qrX "$out/$name-$version.zip" . -x '.*')
  echo "$out/$name-$version.zip"
done

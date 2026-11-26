#!/usr/bin/env bash
# Packages each <name>/extension folder into artifacts/<name>-<version>.zip, with manifest.json
# at the ZIP root so the extracted folder can be loaded unpacked as-is.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/artifacts"
rm -rf "$out"
mkdir -p "$out"

for manifest in "$root"/*/extension/manifest.json; do
  dir=$(dirname "$manifest")
  name=$(basename "$(dirname "$dir")")
  version=$(node -p 'require(process.argv[1]).version' "$manifest")
  # -X drops platform-specific extra attributes for reproducible archives.
  (cd "$dir" && zip -qrX "$out/$name-$version.zip" . -x '.*')
  echo "$out/$name-$version.zip"
done

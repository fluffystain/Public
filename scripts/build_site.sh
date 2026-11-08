#!/usr/bin/env bash
# Assembles the static web app into a directory ready for GitHub Pages.
# Usage: scripts/build_site.sh [out-dir]   (default: _site)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/_site}"
rm -rf "$OUT"
mkdir -p "$OUT/data/news"
cp -R "$ROOT/web/." "$OUT/"
cp "$ROOT/data/countries.json" "$OUT/data/countries.json"
touch "$OUT/.nojekyll"
echo "Site assembled in $OUT"

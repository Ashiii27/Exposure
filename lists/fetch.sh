#!/usr/bin/env bash
#
# Exposure — fetch open tracker lists.
#
# Downloads the raw upstream lists into lists/build/raw/ (gitignored).
# The normalizers + merge step (src/) turn them into the merged index.
# Attribution for each source is written to build/raw/attribution.json and
# must be carried into anything we publish from this data (docs/LEGAL.md).
#
# LICENSING (checked 2026-10-01 — see docs/LEGAL.md):
#   - Disconnect services.json: CC BY-NC-SA 4.0
#   - EasyPrivacy: dual GPLv3 / CC BY-SA 3.0
#   Neither may be committed to this MIT-licensed repo; that is why the
#   output directory is gitignored.
#
# DDG Tracker Radar is NOT fetched here yet: it is stored as ~5000
# per-company JSON files, too many requests for a naive fetch.
# Phase 2 selects a curated subset (top entities by prevalence).
#
set -euo pipefail

cd "$(dirname "$0")"

RAW_DIR="build/raw"
mkdir -p "$RAW_DIR"

fetch () {
  local url="$1" out="$2"
  echo "→ $(basename "$out")"
  curl --fail --retry 3 --max-time 120 --location --silent --show-error "$url" > "$out"
}

fetch \
  "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json" \
  "$RAW_DIR/disconnect-services.json"

fetch \
  "https://easylist.to/easylist/easyprivacy.txt" \
  "$RAW_DIR/easyprivacy.txt"

cat > "$RAW_DIR/attribution.json" <<'EOF'
{
  "fetchedAt": "PLACEHOLDER",
  "sources": [
    {
      "file": "disconnect-services.json",
      "url": "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json",
      "license": "CC BY-NC-SA 4.0",
      "licenseUrl": "https://github.com/disconnectme/disconnect-tracking-protection"
    },
    {
      "file": "easyprivacy.txt",
      "url": "https://easylist.to/easylist/easyprivacy.txt",
      "license": "GPLv3 or CC BY-SA 3.0 (dual)",
      "licenseUrl": "https://easylist.to/pages/licence.html"
    }
  ]
}
EOF

# stamp the real fetch time
sed -i "s/PLACEHOLDER/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "$RAW_DIR/attribution.json"

echo "done:"
ls -la "$RAW_DIR"

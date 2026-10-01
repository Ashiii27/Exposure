#!/usr/bin/env bash
#
# Exposure — one-shot development setup (Kali Linux / any Linux or macOS).
#
#   ./scripts/setup.sh     (or: npm run setup)
#
# Prerequisites: git, curl, Node >= 20 (use nvm: `nvm install 22`).
#
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

say "Checking Node version"
node --version
if ! node -e 'process.exit(process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; then
  echo "Node >= 20 is required. On Kali, use nvm:" >&2
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" >&2
  echo "  nvm install 22" >&2
  exit 1
fi

say "Installing workspace dependencies"
npm install

say "Fetching tracker lists ( licences: never committed; see lists/fetch.sh )"
if bash lists/fetch.sh; then
  echo "lists fetched into lists/build/raw (gitignored)"
else
  echo "!! list fetch failed (offline?) — tests do not need the lists; continuing"
fi

say "Installing the Playwright Chromium browser (needed from Phase 1)"
if npm ls playwright --workspace=scanner >/dev/null 2>&1 || [ -d node_modules/playwright ]; then
  npx playwright install chromium
  echo "If system libraries are missing on Kali, run: npx playwright install-deps chromium (sudo)"
else
  echo "playwright not installed yet (arrives in Phase 1) — skipping browser download"
fi

say "Verifying the toolchain"
npm run lint
npm run typecheck
npm test
npm run build

say "Setup complete"

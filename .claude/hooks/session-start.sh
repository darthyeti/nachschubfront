#!/bin/bash
# Prepares a Claude Code cloud session: dev dependencies, the Chromium that
# Playwright expects, and the full git history. Does nothing on a developer's
# own machine (CLAUDE_CODE_REMOTE is unset there).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm ci only when the lock file or this script changed since the last
# successful install. The hash file lives in node_modules, so it goes with it.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm ci --no-audit --no-fund
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json > "$hashes" || rm -f "$hashes"
fi

# Chromium for tests/input.mjs and tests/offline.mjs. The cloud image usually
# ships the matching build already; install only when Playwright cannot find it.
if ! node -e "const p=require('playwright').chromium.executablePath(); require('fs').accessSync(p)" 2>/dev/null; then
  npx playwright install --with-deps chromium
fi

# The history is part of the documentation (docs/PROGRESS.md points at git log).
if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  git fetch --quiet --unshallow || true
fi

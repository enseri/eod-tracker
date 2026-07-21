#!/usr/bin/env bash
#
# One-command release: commit → push → deploy to Vercel.
#
#   ./scripts/release.sh "v2.7.0 — my message"
#
# One-time setup (do these ONCE, then this script just works):
#   1. GitHub auth:   brew install gh && gh auth login   (GitHub.com → HTTPS → browser)
#   2. Vercel CLI:    npm i -g vercel && vercel login
#
set -e
cd "$(dirname "$0")/.."

MSG="${1:-Release}"

# Clear any stale git lock from a crashed/interrupted git process.
if [ -f .git/index.lock ]; then
  echo "→ Removing stale .git/index.lock"
  rm -f .git/index.lock
fi

echo "→ Running checks (npm test)"
npm test

echo "→ Staging changes"
git add -A

if git diff --cached --quiet; then
  echo "→ Nothing to commit — skipping commit/push"
else
  echo "→ Committing: $MSG"
  git commit -m "$MSG"
  echo "→ Pushing to origin main"
  git push origin main
fi

echo "→ Deploying to Vercel (production)"
vercel --prod

echo "✓ Done. Verify: https://eod-tracker-ecru.vercel.app/api/version"
